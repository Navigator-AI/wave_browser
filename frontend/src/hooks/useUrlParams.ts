/**
 * Hook for parsing URL parameters for server/fsdb connection
 * 
 * Supports format: ?server=host:port&fsdb=/path/to/file.fsdb
 */

import { useMemo } from 'react';

export interface UrlConnectionParams {
  server: string | null;   // host:port format
  host: string | null;     // just the host
  port: number | null;     // just the port
  fsdb: string | null;     // fsdb file path
  backendUrl: string | null; // full backend URL
}

export function useUrlParams(): UrlConnectionParams {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const server = params.get('server');
    const fsdb = params.get('fsdb');
    
    let host: string | null = null;
    let port: number | null = null;
    let backendUrl: string | null = null;
    
    if (server) {
      // Support full URL format: ?server=https://example.com
      if (server.startsWith('http://') || server.startsWith('https://')) {
        try {
          const parsed = new URL(server);
          host = parsed.hostname;
          port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
          backendUrl = parsed.origin;
        } catch {
          host = null;
          port = null;
          backendUrl = null;
        }
      } else {
        // Legacy format: ?server=host:port or ?server=host
        const parts = server.split(':');
        host = parts[0] || null;
        port = parts[1] ? parseInt(parts[1], 10) : 8000; // Default port 8000

        if (host) {
          backendUrl = `http://${host}:${port}`;
        }
      }
    }
    
    return {
      server,
      host,
      port,
      fsdb,
      backendUrl,
    };
  }, []);
}

/**
 * Build a URL with server/fsdb params
 */
export function buildConnectionUrl(host: string, port: number, fsdb?: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('server', `${host}:${port}`);
  if (fsdb) {
    url.searchParams.set('fsdb', fsdb);
  }
  return url.toString();
}

/**
 * Clear URL params (for disconnect)
 */
export function clearConnectionUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('server');
  url.searchParams.delete('fsdb');
  window.history.replaceState({}, '', url.toString());
}
