"""
File Browser Service - Local and remote (SFTP) file browsing
"""

import os
import stat
from datetime import datetime
from pathlib import Path
from typing import Optional
import paramiko

from app.models import BrowseResponse, FileEntry
from app.services.ssh_config import parse_ssh_config
from app.services.ssh_pool import ssh_pool


# File extensions we care about for waveform databases
WAVEFORM_EXTENSIONS = {'.kdb', '.fsdb', '.vcd', '.wlf'}


async def browse_local(path: str) -> BrowseResponse:
    """
    Browse local filesystem.
    Returns directories and waveform database files.
    """
    # Expand ~ and resolve path
    expanded_path = os.path.expanduser(path)
    resolved_path = Path(expanded_path).resolve()
    
    if not resolved_path.exists():
        raise FileNotFoundError(f"Path does not exist: {path}")
    
    if not resolved_path.is_dir():
        raise ValueError(f"Path is not a directory: {path}")
    
    entries: list[FileEntry] = []
    
    try:
        for item in sorted(resolved_path.iterdir()):
            try:
                # Skip broken symlinks
                if item.is_symlink() and not item.exists():
                    continue
                
                # is_dir() follows symlinks automatically
                is_dir = item.is_dir()
                
                # Only include directories and waveform files
                if is_dir or item.suffix.lower() in WAVEFORM_EXTENSIONS:
                    # Use stat() which follows symlinks
                    item_stat = item.stat()
                    entries.append(FileEntry(
                        name=item.name,
                        path=str(item),
                        is_dir=is_dir,
                        size=item_stat.st_size if not is_dir else None,
                        modified=datetime.fromtimestamp(item_stat.st_mtime).isoformat()
                    ))
            except PermissionError:
                # Skip files we can't access
                continue
            except OSError:
                continue
    except PermissionError:
        raise PermissionError(f"Cannot access directory: {path}")
    
    # Calculate parent path
    parent = str(resolved_path.parent) if resolved_path.parent != resolved_path else None
    
    return BrowseResponse(
        path=str(resolved_path),
        entries=entries,
        parent=parent
    )


async def browse_remote(host_name: str, path: str) -> BrowseResponse:
    """
    Browse remote filesystem via SFTP.
    Returns directories and waveform database files.
    """
    # Get host configuration
    hosts = parse_ssh_config()
    host_config = None
    for h in hosts:
        if h.name == host_name:
            host_config = h
            break
    
    if not host_config:
        raise ValueError(f"Unknown host: {host_name}")
    
    # Get or create SSH connection from pool
    ssh_client = await ssh_pool.get_connection(host_config)
    sftp = ssh_client.open_sftp()
    
    try:
        # Expand ~ on remote
        if path.startswith('~'):
            # Get home directory via SSH
            stdin, stdout, stderr = ssh_client.exec_command('echo $HOME')
            home_dir = stdout.read().decode().strip()
            path = path.replace('~', home_dir, 1)
        
        # Normalize path
        if not path:
            path = '/'
        
        # List directory
        entries: list[FileEntry] = []
        
        try:
            items = sftp.listdir_attr(path)
        except IOError as e:
            raise FileNotFoundError(f"Cannot access path: {path}")
        
        for item in sorted(items, key=lambda x: x.filename):
            full_path = f"{path.rstrip('/')}/{item.filename}"
            
            # Check if it's a symlink
            is_link = stat.S_ISLNK(item.st_mode)
            is_dir = stat.S_ISDIR(item.st_mode)
            
            # If symlink, follow it to determine if target is a directory
            if is_link:
                try:
                    # stat() follows symlinks, lstat() doesn't
                    target_stat = sftp.stat(full_path)
                    is_dir = stat.S_ISDIR(target_stat.st_mode)
                except IOError:
                    # Broken symlink - skip it
                    continue
            
            # Get file extension
            ext = os.path.splitext(item.filename)[1].lower()
            
            # Only include directories and waveform files
            if is_dir or ext in WAVEFORM_EXTENSIONS:
                entries.append(FileEntry(
                    name=item.filename,
                    path=full_path,
                    is_dir=is_dir,
                    size=item.st_size if not is_dir else None,
                    modified=datetime.fromtimestamp(item.st_mtime).isoformat() if item.st_mtime else None
                ))
        
        # Calculate parent path
        parent = os.path.dirname(path.rstrip('/')) or '/'
        if parent == path:
            parent = None
        
        return BrowseResponse(
            path=path,
            entries=entries,
            parent=parent
        )
    
    finally:
        sftp.close()
