# Wave Browser Launcher Service

The launcher service acts as a bridge between the browser-based frontend and local/remote waveform backends. It handles:

- **SSH config parsing** - Discovers available remote hosts from `~/.ssh/config`
- **File browsing** - Local and remote (SFTP) filesystem navigation
- **SSH tunnel management** - Creates tunnels to reach remote backends
- **Backend deployment** - Automatically deploys backend code to remote machines
- **Connection tracking** - Manages multiple simultaneous connections

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Tab 1    │  │ Tab 2    │  │ Tab 3    │                      │
│  │ local db │  │ remote A │  │ remote B │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
└───────┼─────────────┼─────────────┼────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Launcher Service (localhost:8080)                              │
│  - Parses ~/.ssh/config                                         │
│  - Browses local and remote files (SFTP)                       │
│  - SSH tunnels to remote machines                               │
│  - Spawns/manages backend instances                             │
└───────┬─────────────┬─────────────┬────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
   Local Backend   Remote A      Remote B
   (port 8081)     via SSH       via SSH
                   (port 8082)   (port 8083)
```

## Quick Start

### Windows
```batch
cd launcher
start_launcher.bat
```

### Linux/macOS
```bash
cd launcher
./start_launcher.sh
```

Or manually:
```bash
cd launcher
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

## API Endpoints

### Hosts
- `GET /api/hosts` - List available hosts (local + SSH config)
- `GET /api/hosts/{name}` - Get details of a specific host

### File Browsing
- `GET /api/files/browse?host=local&path=~` - Browse local filesystem
- `GET /api/files/browse?host=myserver&path=/data` - Browse remote via SFTP

### Connections
- `GET /api/connections` - List active connections
- `POST /api/connections` - Create a new connection
  ```json
  {
    "host": "local",  // or SSH host name
    "db_path": "/path/to/waveforms.fsdb"
  }
  ```
- `GET /api/connections/{id}` - Get connection details
- `DELETE /api/connections/{id}` - Close a connection

## SSH Configuration

The launcher reads your `~/.ssh/config` file to discover available hosts. Example config:

```
Host myserver
    HostName server.example.com
    User engineer
    IdentityFile ~/.ssh/id_rsa

Host devbox
    HostName 192.168.1.100
    User root
    Port 2222
```

## Remote Backend Deployment

When connecting to a remote host for the first time, the launcher will:
1. Create `~/.wave_browser_backend/` on the remote
2. Copy the backend code via SFTP
3. Install Python dependencies with pip
4. Start the backend on a free port
5. Create an SSH tunnel to that port

Subsequent connections reuse the deployed backend.

## Requirements

### Local Machine
- Python 3.9+
- SSH client with key-based authentication configured

### Remote Machines
- Python 3.9+ with pip
- SSH server
- Free ports for backend servers

## Troubleshooting

### Launcher not starting
Check that port 8080 is free:
```bash
netstat -an | grep 8080
```

### SSH connection fails
Verify you can connect manually:
```bash
ssh myserver
```

### Remote backend fails to start
Check the remote log:
```bash
ssh myserver cat /tmp/wave_backend_*.log
```
