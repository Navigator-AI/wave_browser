/**
 * FileBrowser Component
 * 
 * A file browser that can navigate local or remote filesystems.
 * Only shows directories and waveform database files (.kdb, .fsdb).
 */

import { useState, useEffect, useCallback } from 'react';
import { browseFiles, FileEntry } from '../api/launcherClient';

interface FileBrowserProps {
  host: string;
  onFileSelect: (path: string) => void;
  onCancel: () => void;
}

export function FileBrowser({ host, onFileSelect, onCancel }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>('~');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await browseFiles(host, path);
      setCurrentPath(response.path);
      setEntries(response.entries);
      setParentPath(response.parent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    loadDirectory('~');
  }, [loadDirectory]);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      loadDirectory(entry.path);
    } else {
      onFileSelect(entry.path);
    }
  };

  const handleGoUp = () => {
    if (parentPath) {
      loadDirectory(parentPath);
    }
  };

  const formatSize = (size: number | null): string => {
    if (size === null) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  };

  const getIcon = (entry: FileEntry): string => {
    if (entry.is_dir) return '📁';
    if (entry.name.endsWith('.kdb')) return '🗃️';
    if (entry.name.endsWith('.fsdb')) return '🗃️';
    if (entry.name.endsWith('.vcd')) return '📊';
    return '📄';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header with path and navigation */}
      <div className="flex items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
        <button
          onClick={handleGoUp}
          disabled={!parentPath}
          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⬆️ Up
        </button>
        <div className="flex-1 px-3 py-1 bg-gray-700 rounded font-mono text-sm overflow-x-auto">
          {currentPath}
        </div>
        <button
          onClick={() => loadDirectory(currentPath)}
          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
        >
          🔄 Refresh
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400">{error}</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">No files or folders here</div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800 sticky top-0">
              <tr className="text-left text-sm text-gray-400">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 w-24">Size</th>
                <th className="px-3 py-2 w-28">Modified</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  className="hover:bg-gray-800 cursor-pointer border-b border-gray-800"
                >
                  <td className="px-3 py-2">
                    <span className="mr-2">{getIcon(entry)}</span>
                    {entry.name}
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-sm">
                    {formatSize(entry.size)}
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-sm">
                    {formatDate(entry.modified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with actions */}
      <div className="flex justify-end gap-2 p-3 bg-gray-800 border-t border-gray-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
