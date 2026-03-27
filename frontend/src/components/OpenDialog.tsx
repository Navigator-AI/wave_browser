/**
 * Open Database Dialog
 * 
 * Simple dialog for opening a database file from the connected backend server.
 * Server connection is handled via URL parameters (?server=host:port).
 */

import { useState } from 'react';
import { X, Database } from 'lucide-react';
import { ServerFileBrowser } from './ServerFileBrowser';
import { filesApi } from '../api';

interface OpenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (fsdbPath: string) => void;
  serverInfo?: { host: string; port: number } | null;
}

export function OpenDialog({ isOpen, onClose, onOpen, serverInfo }: OpenDialogProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  const handleOpen = () => {
    if (selectedPath) {
      onOpen(selectedPath);
      setSelectedPath(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      console.log('Uploading files:', files.map((f) => f.name));
      const res = await filesApi.uploadPaths(files);
      if (res.files.length > 0) {
        setSelectedPath(res.files.join(' '));
      } else {
        setUploadError('Upload succeeded but no file path returned.');
      }
    } catch (err) {
      const e = err as {
        response?: { data?: { detail?: unknown } };
        details?: { detail?: unknown };
        message?: unknown;
      };
      console.error('Simulation error:', e?.response?.data || err);
      const detail = e?.response?.data?.detail ?? e?.details?.detail;
      const message = typeof detail === 'string' && detail.trim().length > 0
        ? detail
        : typeof e?.message === 'string' && e.message.trim().length > 0
          ? e.message
          : 'Upload failed';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedPath(null);
    setFiles([]);
    setUploadError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-wave-panel rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col border border-wave-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-wave-border">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-wave-accent" />
            <h2 className="text-lg font-semibold">Open Waveform Database</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-wave-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server info */}
        {serverInfo && (
          <div className="px-4 py-2 bg-wave-bg/50 border-b border-wave-border text-sm">
            <span className="text-wave-text/70">Connected to:</span>{' '}
            <span className="text-wave-accent font-mono">
              {serverInfo.host}:{serverInfo.port}
            </span>
          </div>
        )}

        {/* File browser */}
        <div className="flex-1 min-h-0 p-4">
          <div className="h-[400px]">
            <ServerFileBrowser onSelect={handleSelect} />
          </div>

          {/* Upload option */}
          <div className="mt-4 pt-3 border-t border-wave-border">
            <div className="flex items-center justify-between gap-3">
              <input
                type="file"
                multiple
                accept=".v,.vcd,.fsdb"
                className="text-xs"
                disabled={isUploading}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={files.length === 0 || isUploading}
                className="px-3 py-2 text-sm rounded bg-wave-accent text-wave-bg hover:bg-wave-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 text-xs text-wave-text/80 space-y-1">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>- {file.name}</li>
                ))}
              </ul>
            )}
            {uploadError && (
              <div className="mt-2 text-xs text-red-400">
                {uploadError}
              </div>
            )}
          </div>
        </div>

        {/* Selected file */}
        {selectedPath && (
          <div className="px-4 py-2 bg-wave-accent/10 border-t border-wave-border">
            <span className="text-sm text-wave-text/70">Selected:</span>{' '}
            <span className="text-sm font-mono text-wave-accent">{selectedPath}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-wave-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded bg-wave-border hover:bg-wave-border/80"
          >
            Cancel
          </button>
          <button
            onClick={handleOpen}
            disabled={!selectedPath}
            className="px-4 py-2 text-sm rounded bg-wave-accent text-wave-bg hover:bg-wave-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
