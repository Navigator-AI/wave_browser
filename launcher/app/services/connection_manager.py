"""
Connection Manager - Manages backend connections to waveform databases

This is the core service that:
1. Starts local backend processes
2. Deploys and starts remote backends via SSH
3. Creates SSH tunnels for remote backends
4. Tracks all active connections
"""

import asyncio
import os
import subprocess
import sys
import uuid
import socket
import logging
from pathlib import Path
from typing import Dict, Optional
import paramiko

from app.models import ConnectionInfo, HostType, SSHHost
from app.services.ssh_config import parse_ssh_config
from app.services.ssh_pool import ssh_pool

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# Port range for local backends and tunnels
PORT_RANGE_START = 8081
PORT_RANGE_END = 8199

# Path to the backend source (relative to launcher)
BACKEND_SOURCE_DIR = Path(__file__).parent.parent.parent.parent / "backend"

# Remote directory where we'll deploy the backend
REMOTE_BACKEND_DIR = "~/.wave_browser_backend"


def find_free_port(start: int = PORT_RANGE_START, end: int = PORT_RANGE_END) -> int:
    """Find a free port in the given range"""
    for port in range(start, end):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"No free ports in range {start}-{end}")


class ConnectionManager:
    """Manages all active connections to waveform backends"""
    
    def __init__(self):
        self._connections: Dict[str, ConnectionInfo] = {}
        self._processes: Dict[str, subprocess.Popen] = {}  # Local backend processes
        self._tunnels: Dict[str, paramiko.Channel] = {}    # SSH tunnel channels
        self._lock = asyncio.Lock()
    
    def list_connections(self) -> list[ConnectionInfo]:
        """List all active connections"""
        return list(self._connections.values())
    
    def get_connection(self, connection_id: str) -> Optional[ConnectionInfo]:
        """Get a specific connection by ID"""
        return self._connections.get(connection_id)
    
    async def create_connection(self, host: str, db_path: str) -> ConnectionInfo:
        """
        Create a new connection to a waveform database.
        
        For local:
        - Start a backend process on a free port
        
        For remote:
        - Ensure backend is deployed on remote
        - Start backend process on remote
        - Create SSH tunnel to remote backend
        """
        logger.info(f"Creating connection: host={host}, db_path={db_path}")
        async with self._lock:
            connection_id = str(uuid.uuid4())[:8]
            local_port = find_free_port()
            logger.info(f"Connection {connection_id}: allocated port {local_port}")
            
            if host == "local":
                connection = await self._create_local_connection(
                    connection_id, db_path, local_port
                )
            else:
                connection = await self._create_remote_connection(
                    connection_id, host, db_path, local_port
                )
            
            self._connections[connection_id] = connection
            logger.info(f"Connection {connection_id}: created successfully")
            return connection
    
    async def _create_local_connection(
        self, 
        connection_id: str, 
        db_path: str, 
        port: int
    ) -> ConnectionInfo:
        """Start a local backend process"""
        
        # Build command to start backend
        backend_main = BACKEND_SOURCE_DIR / "app" / "main.py"
        
        # Use current Python interpreter
        python_exe = sys.executable
        
        env = os.environ.copy()
        env['WAVEFORM_DB_PATH'] = db_path
        env['UVICORN_PORT'] = str(port)
        
        # Start backend process
        process = subprocess.Popen(
            [python_exe, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
            cwd=str(BACKEND_SOURCE_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        
        self._processes[connection_id] = process
        
        # Wait a bit for server to start
        await asyncio.sleep(1)
        
        # Check if process is still running
        if process.poll() is not None:
            stderr = process.stderr.read().decode() if process.stderr else ""
            raise RuntimeError(f"Backend failed to start: {stderr}")
        
        return ConnectionInfo(
            id=connection_id,
            host="local",
            host_type=HostType.LOCAL,
            db_path=db_path,
            backend_url=f"http://127.0.0.1:{port}",
            local_port=port,
            status="ready"
        )
    
    async def _create_remote_connection(
        self,
        connection_id: str,
        host_name: str,
        db_path: str,
        local_port: int
    ) -> ConnectionInfo:
        """Deploy backend to remote, start it, and create tunnel"""
        logger.info(f"Connection {connection_id}: creating remote connection to {host_name}")
        
        # Get host config
        hosts = parse_ssh_config()
        host_config = None
        for h in hosts:
            if h.name == host_name:
                host_config = h
                break
        
        if not host_config:
            raise ValueError(f"Unknown host: {host_name}")
        
        logger.info(f"Connection {connection_id}: connecting to SSH {host_config.hostname}")
        ssh_client = await ssh_pool.get_connection(host_config)
        
        # Step 1: Ensure backend is deployed on remote
        logger.info(f"Connection {connection_id}: deploying backend to remote")
        await self._deploy_backend_to_remote(ssh_client)
        
        # Step 2: Find a free port on the remote
        logger.info(f"Connection {connection_id}: finding free port on remote")
        remote_port = await self._find_remote_free_port(ssh_client)
        logger.info(f"Connection {connection_id}: remote port = {remote_port}")
        
        # Step 3: Start backend on remote
        logger.info(f"Connection {connection_id}: starting backend on remote")
        await self._start_remote_backend(ssh_client, db_path, remote_port)
        
        # Step 4: Create SSH tunnel from local_port to remote_port
        logger.info(f"Connection {connection_id}: creating SSH tunnel {local_port} -> {remote_port}")
        transport = ssh_client.get_transport()
        channel = transport.open_channel(
            'direct-tcpip',
            ('127.0.0.1', remote_port),
            ('127.0.0.1', local_port)
        )
        
        # Start tunnel forwarder thread
        tunnel_task = asyncio.create_task(
            self._tunnel_forwarder(local_port, channel)
        )
        
        self._tunnels[connection_id] = channel
        
        return ConnectionInfo(
            id=connection_id,
            host=host_name,
            host_type=HostType.REMOTE,
            db_path=db_path,
            backend_url=f"http://127.0.0.1:{local_port}",
            local_port=local_port,
            status="ready"
        )
    
    async def _deploy_backend_to_remote(self, ssh_client: paramiko.SSHClient):
        """
        Deploy the backend code to the remote machine if not already present.
        Uses rsync-like approach with SFTP.
        """
        logger.info("Deploying backend to remote...")
        sftp = ssh_client.open_sftp()
        
        try:
            # Get home directory
            stdin, stdout, stderr = ssh_client.exec_command('echo $HOME')
            home_dir = stdout.read().decode().strip()
            remote_dir = f"{home_dir}/.wave_browser_backend"
            
            # Check if backend exists and has correct version
            needs_deploy = False
            needs_deps = False
            
            try:
                sftp.stat(f"{remote_dir}/app/main.py")
                logger.info("Backend files exist on remote")
                # Check if uvicorn is available
                stdin, stdout, stderr = ssh_client.exec_command('python3 -c "import uvicorn" 2>&1')
                exit_status = stdout.channel.recv_exit_status()
                if exit_status != 0:
                    logger.info("uvicorn not installed, will install dependencies")
                    needs_deps = True
            except IOError:
                logger.info("Backend not found on remote, will deploy")
                needs_deploy = True
                needs_deps = True
            
            if needs_deploy:
                # Create remote directory
                logger.info(f"Creating remote directory: {remote_dir}")
                ssh_client.exec_command(f'mkdir -p {remote_dir}')
                await asyncio.sleep(0.5)
                
                # Copy backend files
                local_backend = BACKEND_SOURCE_DIR
                logger.info(f"Copying backend from {local_backend}")
                await self._copy_directory_to_remote(sftp, local_backend, remote_dir)
            
            if needs_deps:
                # Install dependencies using python3 -m pip for better compatibility
                logger.info("Installing dependencies on remote...")
                
                # First check if pip is available
                stdin, stdout, stderr = ssh_client.exec_command('python3 -m pip --version 2>&1')
                pip_output = stdout.read().decode()
                pip_status = stdout.channel.recv_exit_status()
                logger.info(f"pip check: status={pip_status}, output={pip_output.strip()}")
                
                if pip_status != 0:
                    raise RuntimeError(f"pip not available on remote: {pip_output}")
                
                install_cmd = f'cd {remote_dir} && python3 -m pip install -r requirements.txt --user 2>&1'
                logger.info(f"Running: {install_cmd}")
                stdin, stdout, stderr = ssh_client.exec_command(install_cmd)
                output = stdout.read().decode()
                exit_status = stdout.channel.recv_exit_status()
                logger.info(f"pip install: status={exit_status}, output={output[:500] if output else 'empty'}")
                
                if exit_status != 0:
                    logger.error(f"Dependency install failed: {output}")
                    raise RuntimeError(f"Failed to install dependencies: {output}")
                
                # Verify uvicorn is now available
                stdin, stdout, stderr = ssh_client.exec_command('python3 -c "import uvicorn; print(uvicorn.__file__)" 2>&1')
                verify_output = stdout.read().decode()
                verify_status = stdout.channel.recv_exit_status()
                logger.info(f"uvicorn verify: status={verify_status}, output={verify_output.strip()}")
                
                if verify_status != 0:
                    raise RuntimeError(f"uvicorn still not importable after install: {verify_output}")
                
                logger.info("Dependencies installed successfully")
        
        finally:
            sftp.close()
    
    async def _copy_directory_to_remote(self, sftp, local_path: Path, remote_path: str):
        """Recursively copy a directory to remote via SFTP"""
        
        # Create remote directory
        try:
            sftp.mkdir(remote_path)
        except IOError:
            pass  # Already exists
        
        for item in local_path.iterdir():
            if item.name.startswith('.') or item.name == '__pycache__':
                continue
            
            remote_item = f"{remote_path}/{item.name}"
            
            if item.is_dir():
                await self._copy_directory_to_remote(sftp, item, remote_item)
            else:
                sftp.put(str(item), remote_item)
    
    async def _find_remote_free_port(self, ssh_client: paramiko.SSHClient) -> int:
        """Find a free port on the remote machine"""
        # Use Python one-liner to find free port
        cmd = '''python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()"'''
        stdin, stdout, stderr = ssh_client.exec_command(cmd)
        port_str = stdout.read().decode().strip()
        return int(port_str)
    
    async def _start_remote_backend(
        self, 
        ssh_client: paramiko.SSHClient, 
        db_path: str, 
        port: int
    ):
        """Start the backend process on the remote machine"""
        # Get home directory for remote backend path
        stdin, stdout, stderr = ssh_client.exec_command('echo $HOME')
        home_dir = stdout.read().decode().strip()
        remote_dir = f"{home_dir}/.wave_browser_backend"
        
        # Start backend in background with nohup
        # Include ~/.local/bin in PATH for user-installed packages
        cmd = f'''cd {remote_dir} && \
            export PATH="$HOME/.local/bin:$PATH" && \
            WAVEFORM_DB_PATH="{db_path}" \
            nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port {port} \
            > /tmp/wave_backend_{port}.log 2>&1 &'''
        
        logger.info(f"Starting remote backend on port {port}")
        ssh_client.exec_command(cmd)
        
        # Wait for server to start
        await asyncio.sleep(2)
        
        # Verify it's running
        check_cmd = f'curl -s http://127.0.0.1:{port}/api/health || echo "FAILED"'
        stdin, stdout, stderr = ssh_client.exec_command(check_cmd)
        result = stdout.read().decode().strip()
        
        if "FAILED" in result:
            # Try to get error log
            stdin, stdout, stderr = ssh_client.exec_command(f'cat /tmp/wave_backend_{port}.log')
            log = stdout.read().decode()
            raise RuntimeError(f"Remote backend failed to start: {log}")
    
    async def _tunnel_forwarder(self, local_port: int, channel: paramiko.Channel):
        """Forward traffic between local port and SSH channel"""
        # Create local socket server
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(('127.0.0.1', local_port))
        server.listen(5)
        server.setblocking(False)
        
        loop = asyncio.get_event_loop()
        
        while True:
            try:
                client, addr = await loop.sock_accept(server)
                # Handle client in background
                asyncio.create_task(self._handle_tunnel_client(client, channel))
            except:
                break
    
    async def _handle_tunnel_client(self, client: socket.socket, channel: paramiko.Channel):
        """Handle a single client connection through the tunnel"""
        # This is simplified - real implementation would need proper async handling
        try:
            while True:
                data = client.recv(4096)
                if not data:
                    break
                channel.send(data)
                
                response = channel.recv(4096)
                if response:
                    client.sendall(response)
        finally:
            client.close()
    
    async def close_connection(self, connection_id: str) -> bool:
        """Close a connection and cleanup resources"""
        async with self._lock:
            if connection_id not in self._connections:
                return False
            
            connection = self._connections[connection_id]
            
            # Stop local process if applicable
            if connection_id in self._processes:
                process = self._processes[connection_id]
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                del self._processes[connection_id]
            
            # Close tunnel if applicable
            if connection_id in self._tunnels:
                try:
                    self._tunnels[connection_id].close()
                except:
                    pass
                del self._tunnels[connection_id]
            
            # For remote connections, try to stop the remote backend
            if connection.host_type == HostType.REMOTE:
                try:
                    hosts = parse_ssh_config()
                    host_config = next((h for h in hosts if h.name == connection.host), None)
                    if host_config:
                        ssh_client = await ssh_pool.get_connection(host_config)
                        # Find and kill the remote backend process by port
                        port = connection.local_port  # We'd need to track remote port too
                        ssh_client.exec_command(
                            f"pkill -f 'uvicorn.*--port {port}' || true"
                        )
                except:
                    pass
            
            del self._connections[connection_id]
            return True
    
    async def cleanup_all(self):
        """Cleanup all connections on shutdown"""
        for conn_id in list(self._connections.keys()):
            await self.close_connection(conn_id)
        await ssh_pool.close_all()


# Global connection manager instance
connection_manager = ConnectionManager()
