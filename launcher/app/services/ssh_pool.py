"""
SSH Connection Pool - Manages persistent SSH connections
"""

import asyncio
from typing import Dict, Optional
import paramiko

from app.models import SSHHost


class SSHPool:
    """
    Maintains a pool of SSH connections to avoid reconnecting for each operation.
    """
    
    def __init__(self):
        self._connections: Dict[str, paramiko.SSHClient] = {}
        self._lock = asyncio.Lock()
    
    async def get_connection(self, host: SSHHost) -> paramiko.SSHClient:
        """
        Get or create an SSH connection to the specified host.
        Connections are cached by host name.
        """
        async with self._lock:
            # Check if we have an active connection
            if host.name in self._connections:
                client = self._connections[host.name]
                # Verify connection is still alive
                if client.get_transport() and client.get_transport().is_active():
                    return client
                else:
                    # Connection died, remove it
                    try:
                        client.close()
                    except:
                        pass
                    del self._connections[host.name]
            
            # Create new connection
            client = await self._create_connection(host)
            self._connections[host.name] = client
            return client
    
    async def _create_connection(self, host: SSHHost) -> paramiko.SSHClient:
        """Create a new SSH connection"""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Build connection kwargs
        connect_kwargs = {
            'hostname': host.hostname,
            'port': host.port,
            'timeout': 30,
        }
        
        if host.user:
            connect_kwargs['username'] = host.user
        
        if host.identity_file:
            connect_kwargs['key_filename'] = host.identity_file
        else:
            # Let paramiko use default keys and ssh-agent
            connect_kwargs['look_for_keys'] = True
            connect_kwargs['allow_agent'] = True
        
        # Run blocking connect in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: client.connect(**connect_kwargs)
        )
        
        return client
    
    async def close_connection(self, host_name: str):
        """Close a specific connection"""
        async with self._lock:
            if host_name in self._connections:
                try:
                    self._connections[host_name].close()
                except:
                    pass
                del self._connections[host_name]
    
    async def close_all(self):
        """Close all connections"""
        async with self._lock:
            for client in self._connections.values():
                try:
                    client.close()
                except:
                    pass
            self._connections.clear()


# Global SSH pool instance
ssh_pool = SSHPool()
