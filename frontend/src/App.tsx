/**
 * Main application component
 * 
 * Supports URL parameters for direct connection:
 *   ?server=host:port     - Connect to backend at host:port
 *   ?server=host:port&fsdb=/path/to/file.fsdb - Connect and open specific file
 */

import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FolderOpen, Database, Play, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { HierarchyPanel } from './components/HierarchyPanel';
import { WaveformViewer } from './components/WaveformViewer';
import { SessionDialog } from './components/SessionDialog';
import { OpenDialog } from './components/OpenDialog';
import { LogPanel, LogEntry } from './components/LogPanel';
import { CodePanel } from './components/CodePanel';
import { useWaveformStore } from './store';
import { setBackendUrl, sessionsApi } from './api';
import { useUrlParams, buildConnectionUrl, clearConnectionUrl, useCodePanel } from './hooks';

// Version for debugging - update when making changes
const APP_VERSION = 'v0.4.0-dev';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  },
});

interface ServerConnection {
  host: string;
  port: number;
  backendUrl: string;
}

function AppContent() {
  const { currentSession, isDemoMode, loadDemoMode, setCurrentSession } = useWaveformStore();
  const urlParams = useUrlParams();
  const codePanel = useCodePanel();
  
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Add a log entry
  const addLog = useCallback((level: LogEntry['level'], message: string, details?: string) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
      details,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Connect to server
  const connectToServer = useCallback(async (host: string, port: number) => {
    const backendUrl = `http://${host}:${port}`;
    setBackendUrl(backendUrl);
    setConnection({ host, port, backendUrl });
    setConnectionError(null);
    addLog('info', `Connecting to ${host}:${port}...`);

    // Verify connection with health check
    try {
      const response = await fetch(`${backendUrl}/health`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      addLog('success', `Connected to backend at ${host}:${port}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setConnectionError(message);
      addLog('error', `Failed to connect: ${message}`);
      return false;
    }
  }, [addLog]);

  // Open a database file
  const openDatabase = useCallback(async (fsdbPath: string) => {
    if (!connection) {
      addLog('error', 'Not connected to a server');
      return;
    }

    setIsLoading(true);
    addLog('info', `Opening database: ${fsdbPath}`);

    try {
      const response = await sessionsApi.create({
        vendor: 'verdi',
        wave_db: fsdbPath,
      });
      
      addLog('success', 'Session created successfully');
      addLog('info', `Time range: ${response.session.min_time} - ${response.session.max_time} ${response.session.time_unit}`);
      
      setCurrentSession(response.session);
      
      // Update URL to include fsdb path
      const newUrl = buildConnectionUrl(connection.host, connection.port, fsdbPath);
      window.history.replaceState({}, '', newUrl);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Failed to open database', errorMsg);
      setShowSessionDialog(true);
    } finally {
      setIsLoading(false);
    }
  }, [connection, addLog, setCurrentSession]);

  // Handle URL params on mount
  useEffect(() => {
    const initFromUrl = async () => {
      if (urlParams.host && urlParams.port) {
        const connected = await connectToServer(urlParams.host, urlParams.port);
        
        if (connected && urlParams.fsdb) {
          await openDatabase(urlParams.fsdb);
        }
      } else {
        // No URL params, load demo mode
        loadDemoMode();
      }
    };

    initFromUrl();
  }, []); // Only run on mount

  // Handle disconnect
  const handleDisconnect = () => {
    setConnection(null);
    setCurrentSession(null);
    setConnectionError(null);
    clearConnectionUrl();
    loadDemoMode();
    addLog('info', 'Disconnected from server');
  };

  // Handle retry connection
  const handleRetryConnection = () => {
    if (urlParams.host && urlParams.port) {
      connectToServer(urlParams.host, urlParams.port).then(connected => {
        if (connected && urlParams.fsdb) {
          openDatabase(urlParams.fsdb);
        }
      });
    }
  };

  // Handle open from dialog
  const handleOpenFromDialog = (fsdbPath: string) => {
    setShowOpenDialog(false);
    openDatabase(fsdbPath);
  };

  return (
    <div className="h-screen flex flex-col bg-wave-bg text-wave-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-wave-border bg-wave-panel">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-wave-accent">Wave Browser</h1>
          <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded font-mono">{APP_VERSION}</span>
          
          {/* Connection status */}
          {!connection && isDemoMode && (
            <span className="text-xs text-yellow-400 px-2 py-1 bg-yellow-400/20 rounded border border-yellow-400/30">
              DEMO MODE
            </span>
          )}
          {connection && !connectionError && (
            <span className="text-xs text-green-400 px-2 py-1 bg-green-400/20 rounded border border-green-400/30 flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              {connection.host}:{connection.port}
            </span>
          )}
          {connectionError && (
            <span className="text-xs text-red-400 px-2 py-1 bg-red-400/20 rounded border border-red-400/30 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Connection Error
              <button
                onClick={handleRetryConnection}
                className="ml-1 p-0.5 hover:bg-red-400/30 rounded"
                title="Retry connection"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </span>
          )}
          
          {/* Current file */}
          {currentSession && !isDemoMode && (
            <span className="text-xs text-wave-text/70 px-2 py-1 bg-wave-bg rounded">
              {currentSession.wave_db?.split('/').pop() || currentSession.design_db?.split('/').pop() || 'Session'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {connection && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
              title="Disconnect"
            >
              <WifiOff className="w-4 h-4" />
              Disconnect
            </button>
          )}
          {!isDemoMode && !connection && (
            <button
              onClick={() => loadDemoMode()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-wave-border text-wave-text rounded hover:bg-wave-border/80"
              title="Load Demo"
            >
              <Play className="w-4 h-4" />
              Demo
            </button>
          )}
          {connection && !connectionError && (
            <button
              onClick={() => setShowOpenDialog(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-wave-accent text-wave-bg rounded hover:bg-wave-accent/80"
            >
              <FolderOpen className="w-4 h-4" />
              Open Database
            </button>
          )}
        </div>
      </header>

      {/* Connection instructions if no server */}
      {!connection && !isDemoMode && (
        <div className="bg-wave-panel/50 border-b border-wave-border px-4 py-3">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-wave-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No server connection</p>
              <p className="text-wave-text/70 mt-1">
                Start a backend server and add URL parameters to connect:
              </p>
              <code className="block mt-2 px-3 py-2 bg-wave-bg rounded text-xs font-mono text-wave-accent">
                ?server=hostname:8000&fsdb=/path/to/file.fsdb
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Hierarchy */}
          <div className="w-80 border-r border-wave-border flex-shrink-0 overflow-hidden">
            <HierarchyPanel onViewCode={codePanel.viewCode} />
          </div>

          {/* Right panel - Waveform Viewer + Code Panel */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <WaveformViewer />
            </div>
            {/* Code Panel (collapsible) */}
            <CodePanel
              location={codePanel.location}
              content={codePanel.content}
              isLoading={codePanel.isLoading}
              error={codePanel.error}
              onClose={codePanel.close}
            />
          </div>
        </div>

        {/* Log panel */}
        <LogPanel logs={logs} onClear={clearLogs} isLoading={isLoading} />
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-1 text-xs text-wave-text/70 border-t border-wave-border bg-wave-panel">
        <div className="flex items-center gap-4">
          {currentSession ? (
            <>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                {currentSession.vendor}
              </span>
              <span>
                Time: {currentSession.min_time} - {currentSession.max_time} {currentSession.time_unit}
              </span>
            </>
          ) : (
            <span>No database open</span>
          )}
        </div>
        <div>
          Wave Browser {APP_VERSION}
        </div>
      </footer>

      {/* Dialogs */}
      <SessionDialog
        isOpen={showSessionDialog}
        onClose={() => setShowSessionDialog(false)}
      />
      
      <OpenDialog
        isOpen={showOpenDialog}
        onClose={() => setShowOpenDialog(false)}
        onOpen={handleOpenFromDialog}
        serverInfo={connection ? { host: connection.host, port: connection.port } : null}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
