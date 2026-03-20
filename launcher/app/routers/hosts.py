"""
Hosts router - SSH config parsing and host management
"""

from fastapi import APIRouter, HTTPException
from app.models import SSHHost
from app.services.ssh_config import parse_ssh_config

router = APIRouter()


@router.get("", response_model=list[SSHHost])
async def list_hosts():
    """
    List available hosts from ~/.ssh/config.
    Also includes a virtual "local" entry for local connections.
    """
    try:
        hosts = parse_ssh_config()
        # Add local as first option
        local_host = SSHHost(
            name="local",
            hostname="localhost",
            user=None,
            port=0
        )
        return [local_host] + hosts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse SSH config: {str(e)}")


@router.get("/{host_name}", response_model=SSHHost)
async def get_host(host_name: str):
    """Get details of a specific host"""
    if host_name == "local":
        return SSHHost(name="local", hostname="localhost", user=None, port=0)
    
    hosts = parse_ssh_config()
    for host in hosts:
        if host.name == host_name:
            return host
    
    raise HTTPException(status_code=404, detail=f"Host '{host_name}' not found")
