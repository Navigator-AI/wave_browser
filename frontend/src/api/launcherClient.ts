/**
 * Launcher API Client
 * 
 * Client for communicating with the launcher service that manages
 * local and remote backend connections.
 */

const LAUNCHER_URL = 'http://localhost:8080';

// Types

export interface SSHHost {
  name: string;
  hostname: string;
  user: string | null;
  port: number;
  identity_file: string | null;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  modified: string | null;
}

export interface BrowseResponse {
  path: string;
  entries: FileEntry[];
  parent: string | null;
}

export interface ConnectionInfo {
  id: string;
  host: string;
  host_type: 'local' | 'remote';
  db_path: string;
  backend_url: string;
  local_port: number;
  status: 'connecting' | 'ready' | 'error';
  error: string | null;
}

// API Functions

/**
 * Check if the launcher service is running
 */
export async function checkLauncherHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LAUNCHER_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of available hosts (local + SSH config entries)
 */
export async function getHosts(): Promise<SSHHost[]> {
  const response = await fetch(`${LAUNCHER_URL}/api/hosts`);
  if (!response.ok) {
    throw new Error(`Failed to get hosts: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Browse files on a host
 */
export async function browseFiles(host: string, path: string = '~'): Promise<BrowseResponse> {
  const params = new URLSearchParams({ host, path });
  const response = await fetch(`${LAUNCHER_URL}/api/files/browse?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to browse: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create a connection to a waveform database
 */
export async function createConnection(host: string, dbPath: string): Promise<ConnectionInfo> {
  console.log('[launcherClient] Creating connection:', { host, dbPath });
  
  const response = await fetch(`${LAUNCHER_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, db_path: dbPath }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    const errorMessage = errorData.detail || `Failed to create connection: ${response.status}`;
    console.error('[launcherClient] Connection failed:', errorMessage, errorData);
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  console.log('[launcherClient] Connection created:', data);
  return data.connection;
}

/**
 * Get list of active connections
 */
export async function getConnections(): Promise<ConnectionInfo[]> {
  const response = await fetch(`${LAUNCHER_URL}/api/connections`);
  if (!response.ok) {
    throw new Error(`Failed to get connections: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Close a connection
 */
export async function closeConnection(connectionId: string): Promise<void> {
  const response = await fetch(`${LAUNCHER_URL}/api/connections/${connectionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to close connection: ${response.statusText}`);
  }
}
