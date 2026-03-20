"""
SSH Config Parser - Reads and parses ~/.ssh/config
"""

import os
import re
from pathlib import Path
from typing import Optional
from app.models import SSHHost


def parse_ssh_config() -> list[SSHHost]:
    """
    Parse ~/.ssh/config and return a list of host configurations.
    
    Handles common SSH config directives:
    - Host: the alias name
    - HostName: the actual hostname/IP
    - User: username
    - Port: SSH port
    - IdentityFile: path to private key
    """
    config_path = Path.home() / ".ssh" / "config"
    
    if not config_path.exists():
        return []
    
    hosts: list[SSHHost] = []
    current_host: Optional[dict] = None
    
    with open(config_path, 'r') as f:
        for line in f:
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse key-value pairs
            match = re.match(r'^(\S+)\s+(.+)$', line)
            if not match:
                continue
            
            key = match.group(1).lower()
            value = match.group(2).strip()
            
            if key == 'host':
                # Save previous host if exists
                if current_host and current_host.get('name'):
                    # Skip wildcard hosts
                    if '*' not in current_host['name'] and '?' not in current_host['name']:
                        hosts.append(_dict_to_host(current_host))
                
                # Start new host
                current_host = {'name': value}
            
            elif current_host is not None:
                if key == 'hostname':
                    current_host['hostname'] = value
                elif key == 'user':
                    current_host['user'] = value
                elif key == 'port':
                    try:
                        current_host['port'] = int(value)
                    except ValueError:
                        pass
                elif key == 'identityfile':
                    # Expand ~ in path
                    current_host['identity_file'] = os.path.expanduser(value)
    
    # Don't forget the last host
    if current_host and current_host.get('name'):
        if '*' not in current_host['name'] and '?' not in current_host['name']:
            hosts.append(_dict_to_host(current_host))
    
    return hosts


def _dict_to_host(d: dict) -> SSHHost:
    """Convert a dict to SSHHost, using name as hostname if not specified"""
    return SSHHost(
        name=d['name'],
        hostname=d.get('hostname', d['name']),
        user=d.get('user'),
        port=d.get('port', 22),
        identity_file=d.get('identity_file')
    )
