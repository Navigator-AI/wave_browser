"""
Connections router - Manage backend connections to waveform databases
"""

from fastapi import APIRouter, HTTPException
from app.models import ConnectionRequest, ConnectionResponse, ConnectionInfo
from app.services.connection_manager import connection_manager

router = APIRouter()


@router.get("", response_model=list[ConnectionInfo])
async def list_connections():
    """List all active connections"""
    return connection_manager.list_connections()


@router.post("", response_model=ConnectionResponse)
async def create_connection(request: ConnectionRequest):
    """
    Create a new connection to a waveform database.
    
    This will:
    1. For local: start a backend process pointing to the db_path
    2. For remote: 
       - SSH to the host
       - Deploy/start the backend on the remote
       - Create an SSH tunnel to the remote backend
    
    Returns the connection info with the local URL to access the backend.
    """
    try:
        connection = await connection_manager.create_connection(
            host=request.host,
            db_path=request.db_path
        )
        return ConnectionResponse(connection=connection)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create connection: {str(e)}")


@router.get("/{connection_id}", response_model=ConnectionInfo)
async def get_connection(connection_id: str):
    """Get details of a specific connection"""
    connection = connection_manager.get_connection(connection_id)
    if not connection:
        raise HTTPException(status_code=404, detail=f"Connection '{connection_id}' not found")
    return connection


@router.delete("/{connection_id}")
async def delete_connection(connection_id: str):
    """
    Close and cleanup a connection.
    
    This will:
    - Stop the backend process (local or remote)
    - Close SSH tunnels if applicable
    """
    success = await connection_manager.close_connection(connection_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Connection '{connection_id}' not found")
    return {"status": "closed", "id": connection_id}
