/**
 * Server File Browser - browses files on the connected backend server
 */

import { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, Home, HardDrive, ArrowLeft, Loader2 } from 'lucide-react';
import { filesApi } from '../api';
import type { FileEntry, FileListResponse } from '../api/types';

interface ServerFileBrowserProps {
  onSelect: (path: string) => void;
  extensions?: string[];  // e.g., ['.fsdb', '.vcd']
}

export function ServerFileBrowser({ onSelect, extensions = ['.fsdb', '.vcd', '.kdb'] }: ServerFileBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [roots, setRoots] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load filesystem roots on mount
  useEffect(() => {
    loadRoots();
    loadDirectory();
  }, []);

  const loadRoots = async () => {
    try {
      const rootEntries = await filesApi.getRoots();
      setRoots(rootEntries);
    } catch (err) {
      console.error('Failed to load roots:', err);
    }
  };

  const loadDirectory = async (path?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response: FileListResponse = await filesApi.list(path);
      setCurrentPath(response.path);
      setParent(response.parent || null);
      setEntries(response.entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load directory';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      loadDirectory(entry.path);
    } else {
      // Check if file matches allowed extensions
      const hasValidExtension = extensions.some(ext => 
        entry.name.toLowerCase().endsWith(ext.toLowerCase())
      );
      
      if (hasValidExtension) {
        onSelect(entry.path);
      }
    }
  };

  const goUp = () => {
    if (parent) {
      loadDirectory(parent);
    }
  };

  const goHome = () => {
    loadDirectory();
  };

  const formatSize = (size?: number): string => {
    if (size === undefined) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSelectable = (entry: FileEntry): boolean => {
    if (entry.is_dir) return true;
    return extensions.some(ext => entry.name.toLowerCase().endsWith(ext.toLowerCase()));
  };

  return (
    <div className="flex flex-col h-full bg-wave-bg rounded border border-wave-border">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-wave-border bg-wave-panel">
        <button
          onClick={goUp}
          disabled={!parent}
          className="p-1.5 rounded hover:bg-wave-border disabled:opacity-30 disabled:cursor-not-allowed"
          title="Go up"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={goHome}
          className="p-1.5 rounded hover:bg-wave-border"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        
        {/* Quick access roots */}
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-wave-border">
          {roots.map((root) => (
            <button
              key={root.path}
              onClick={() => loadDirectory(root.path)}
              className="px-2 py-1 text-xs rounded hover:bg-wave-border flex items-center gap-1"
            >
              <HardDrive className="w-3 h-3" />
              {root.name}
            </button>
          ))}
        </div>
      </div>

      {/* Current path */}
      <div className="px-3 py-1.5 text-xs text-wave-text/70 bg-wave-panel/50 border-b border-wave-border font-mono truncate">
        {currentPath || 'Loading...'}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-wave-accent" />
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-sm">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-wave-text/50 text-sm text-center">
            Directory is empty
          </div>
        ) : (
          <div className="divide-y divide-wave-border/30">
            {entries.map((entry) => {
              const selectable = isSelectable(entry);
              
              return (
                <button
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  disabled={!selectable}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    selectable 
                      ? 'hover:bg-wave-border/50 cursor-pointer' 
                      : 'opacity-40 cursor-default'
                  }`}
                >
                  {/* Icon */}
                  {entry.is_dir ? (
                    <Folder className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  ) : (
                    <File className={`w-4 h-4 flex-shrink-0 ${
                      extensions.some(ext => entry.name.endsWith(ext)) 
                        ? 'text-wave-accent' 
                        : 'text-wave-text/50'
                    }`} />
                  )}
                  
                  {/* Name */}
                  <span className="flex-1 truncate text-sm">
                    {entry.name}
                  </span>
                  
                  {/* Size or folder indicator */}
                  {entry.is_dir ? (
                    <ChevronRight className="w-4 h-4 text-wave-text/30 flex-shrink-0" />
                  ) : (
                    <span className="text-xs text-wave-text/50 flex-shrink-0">
                      {formatSize(entry.size)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 text-xs text-wave-text/50 bg-wave-panel/50 border-t border-wave-border">
        Select a waveform file ({extensions.join(', ')})
      </div>
    </div>
  );
}
