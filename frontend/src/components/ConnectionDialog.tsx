/**
 * ConnectionDialog Component
 * 
 * A dialog for opening waveform databases from local or remote hosts.
 * 
 * Flow:
 * 1. User clicks "Open" button
 * 2. Dialog shows list of hosts (local + SSH hosts from ~/.ssh/config)
 * 3. User selects a host or recent file
 * 4. If host selected, file browser shows for that host
 * 5. User selects a .kdb or .fsdb file
 * 6. Connection is established, dialog closes
 */

import { useState, useEffect } from 'react';
import { Clock, FolderOpen } from 'lucide-react';
import {
  checkLauncherHealth,
  getHosts,
  createConnection,
  SSHHost,
  ConnectionInfo,
} from '../api/launcherClient';
import { FileBrowser } from './FileBrowser';

// Recent file entry
interface RecentFile {
  host: string;
  path: string;
  timestamp: number;
}

// LocalStorage key for recent files
const RECENT_FILES_KEY = 'wave-browser-recent-files';
const MAX_RECENT_FILES = 5;

// Get recent files from localStorage
function getRecentFiles(): RecentFile[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

// Save a file to recent history
function addRecentFile(host: string, path: string): void {
  const recent = getRecentFiles();
  
  // Remove duplicate if exists
  const filtered = recent.filter(r => !(r.host === host && r.path === path));
  
  // Add to front
  filtered.unshift({ host, path, timestamp: Date.now() });
  
  // Keep only MAX_RECENT_FILES
  const trimmed = filtered.slice(0, MAX_RECENT_FILES);
  
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(trimmed));
}

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: ConnectionInfo) => void;
}

type DialogStep = 'launcher-check' | 'host-select' | 'file-browse' | 'connecting';

export function ConnectionDialog({ isOpen, onClose, onConnect }: ConnectionDialogProps) {
  const [step, setStep] = useState<DialogStep>('launcher-check');
  const [hosts, setHosts] = useState<SSHHost[]>([]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // Load recent files on mount
  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  // Check launcher health on open
  useEffect(() => {
    if (isOpen) {
      checkLauncher();
      setRecentFiles(getRecentFiles());
    }
  }, [isOpen]);

  const checkLauncher = async () => {
    setStep('launcher-check');
    setError(null);
    
    const healthy = await checkLauncherHealth();
    
    if (healthy) {
      loadHosts();
    } else {
      setError('Launcher service not running. Please start it with: cd launcher && uvicorn app.main:app --port 8080');
    }
  };

  const loadHosts = async () => {
    try {
      const hostList = await getHosts();
      setHosts(hostList);
      setStep('host-select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hosts');
    }
  };

  const handleHostSelect = (hostName: string) => {
    setSelectedHost(hostName);
    setStep('file-browse');
  };

  const handleFileSelect = async (filePath: string) => {
    if (!selectedHost) return;
    
    setStep('connecting');
    setError(null);
    
    try {
      console.log('[ConnectionDialog] Creating connection:', { host: selectedHost, path: filePath });
      const connection = await createConnection(selectedHost, filePath);
      console.log('[ConnectionDialog] Connection created:', connection);
      // Save to recent files on success
      addRecentFile(selectedHost, filePath);
      setRecentFiles(getRecentFiles());
      onConnect(connection);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
      console.error('[ConnectionDialog] Connection failed:', errorMsg);
      setError(errorMsg);
      setStep('file-browse');
    }
  };

  // Handle selecting a recent file directly
  const handleRecentSelect = async (recent: RecentFile) => {
    setSelectedHost(recent.host);
    setStep('connecting');
    setError(null);
    
    try {
      const connection = await createConnection(recent.host, recent.path);
      // Update timestamp in recent files
      addRecentFile(recent.host, recent.path);
      setRecentFiles(getRecentFiles());
      onConnect(connection);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setStep('host-select');
    }
  };

  const handleBack = () => {
    if (step === 'file-browse') {
      setSelectedHost(null);
      setStep('host-select');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-[700px] h-[500px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {step === 'file-browse' && (
              <button
                onClick={handleBack}
                className="px-2 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600"
              >
                ← Back
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-100">
              {step === 'launcher-check' && 'Checking Launcher...'}
              {step === 'host-select' && 'Select Host'}
              {step === 'file-browse' && `Browse Files - ${selectedHost}`}
              {step === 'connecting' && 'Connecting...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Launcher check */}
          {step === 'launcher-check' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              {!error ? (
                <>
                  <div className="animate-spin text-4xl">⏳</div>
                  <div className="text-gray-400">Checking launcher service...</div>
                </>
              ) : (
                <>
                  <div className="text-red-400 text-center px-8">{error}</div>
                  <button
                    onClick={checkLauncher}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}

          {/* Host selection */}
          {step === 'host-select' && (
            <div className="p-4 overflow-auto h-full">
              {error && (
                <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded">
                  {error}
                </div>
              )}

              {/* Recent files section */}
              {recentFiles.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2 text-gray-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Recent Files</span>
                  </div>
                  <div className="grid gap-1.5">
                    {recentFiles.map((recent, idx) => (
                      <button
                        key={`${recent.host}-${recent.path}-${idx}`}
                        onClick={() => handleRecentSelect(recent)}
                        className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700 text-left transition-colors border border-gray-700/50"
                      >
                        <div className="text-lg flex-shrink-0">
                          {recent.host === 'local' ? '💻' : '🌐'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-100 truncate font-mono">
                            {recent.path.split('/').pop()}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {recent.host}: {recent.path}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hosts section */}
              <div className="mb-2 text-gray-400 text-sm flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <span>Browse Host</span>
              </div>
              <div className="grid gap-2">
                {hosts.map((host) => (
                  <button
                    key={host.name}
                    onClick={() => handleHostSelect(host.name)}
                    className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 text-left transition-colors"
                  >
                    <div className="text-2xl">
                      {host.name === 'local' ? '💻' : '🌐'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-100">{host.name}</div>
                      <div className="text-sm text-gray-400">
                        {host.name === 'local' 
                          ? 'Local filesystem' 
                          : `${host.user ? `${host.user}@` : ''}${host.hostname}${host.port !== 22 ? `:${host.port}` : ''}`
                        }
                      </div>
                    </div>
                    <div className="text-gray-500">→</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File browser */}
          {step === 'file-browse' && selectedHost && (
            <div className="flex flex-col h-full">
              {error && (
                <div className="m-2 p-3 bg-red-900/50 text-red-300 rounded text-sm">
                  <strong>Connection Error:</strong> {error}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <FileBrowser
                  host={selectedHost}
                  onFileSelect={handleFileSelect}
                  onCancel={onClose}
                />
              </div>
            </div>
          )}

          {/* Connecting */}
          {step === 'connecting' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="animate-spin text-4xl">⏳</div>
              <div className="text-gray-400">
                {selectedHost === 'local' 
                  ? 'Starting local backend...'
                  : 'Connecting to remote host and starting backend...'}
              </div>
              {error && (
                <div className="text-red-400 text-center px-8 mt-4">{error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
