/**
 * Session dialog for opening databases
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, X, AlertCircle } from 'lucide-react';
import { sessionsApi, ApiError, filesApi } from '../api';
import { useWaveformStore } from '../store';
import { sessionLogger } from '../utils/logging';

// Default path to example KDB (RTL source files)
const DEFAULT_DESIGN_DB = '/u/avidan/workspaces/wave_browser/example/rtl/counter.v /u/avidan/workspaces/wave_browser/example/rtl/tb_counter.v';

interface SessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionDialog({ isOpen, onClose }: SessionDialogProps) {
  const [designDb, setDesignDb] = useState(DEFAULT_DESIGN_DB);
  const [waveDb, setWaveDb] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [designUploadFiles, setDesignUploadFiles] = useState<FileList | null>(null);
  const [waveUploadFiles, setWaveUploadFiles] = useState<FileList | null>(null);
  const [isUploadingDesign, setIsUploadingDesign] = useState(false);
  const [isUploadingWave, setIsUploadingWave] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSimulateOption, setShowSimulateOption] = useState(false);
  const { setCurrentSession } = useWaveformStore();
  const queryClient = useQueryClient();

  const createSession = useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: (data) => {
      sessionLogger.info('Session created successfully', data.session);
      setCurrentSession(data.session);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      onClose();
    },
    onError: (error) => {
      sessionLogger.error('Failed to create session', error as Error);
    },
  });

  if (!isOpen) return null;

  // Format error message for display
  const getErrorMessage = () => {
    if (!createSession.error) return null;
    
    const error = createSession.error;
    if (error instanceof ApiError) {
      return error.message;
    }
    return (error as Error).message || 'Unknown error occurred';
  };

  const getSimulationErrorMessage = (error: unknown): string => {
    const e = error as {
      message?: unknown;
      detail?: unknown;
      details?: { detail?: unknown };
      response?: { data?: { detail?: unknown } };
    };

    const detail = e?.response?.data?.detail ?? e?.details?.detail ?? e?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
    if (typeof e?.message === 'string' && e.message.trim().length > 0) {
      return e.message;
    }
    return 'Simulation failed';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sessionLogger.info('Opening database', { designDb, waveDb: waveDb || undefined });
    const hasDesignDb = Boolean(designDb.trim());
    const wavePath = (waveDb || '').trim().toLowerCase();
    const v = !hasDesignDb && wavePath.endsWith('.vcd') ? 'vcd' : 'verdi';
    createSession.mutate({
      vendor: v,
      wave_db: waveDb || undefined,
      design_db: designDb || undefined,
    });
  };

  const handleUploadDesign = async () => {
    if (!designUploadFiles || designUploadFiles.length === 0) return;
    setIsUploadingDesign(true);
    setUploadError(null);
    setShowSimulateOption(false);
    try {
      const res = await filesApi.uploadDesign(designUploadFiles);
      const paths = res.files.map(f => f.path).filter(Boolean);
      if (paths.length > 0) {
        // Check if any files are Verilog source files
        const hasVerilogSource = Array.from(designUploadFiles).some(f => 
          f.name.toLowerCase().endsWith('.v') || 
          f.name.toLowerCase().endsWith('.sv') ||
          f.name.toLowerCase().endsWith('.vh') || 
          f.name.toLowerCase().endsWith('.svh')
        );
        
        if (hasVerilogSource) {
          setShowSimulateOption(true);
        }
        
        // Backend verdi_adapter supports space-separated file lists for design_db.
        setDesignDb(paths.join(' '));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Design upload failed');
    } finally {
      setIsUploadingDesign(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!designUploadFiles || designUploadFiles.length === 0) return;
    setIsSimulating(true);
    setUploadError(null);
    try {
      sessionLogger.info('Running Verilog simulation', { files: Array.from(designUploadFiles).map(f => f.name) });
      const res = await filesApi.simulate(designUploadFiles);
      const vcdPath = res.files[0]?.path;
      if (vcdPath) {
        sessionLogger.info('Simulation completed, opening VCD', { vcdPath });
        setWaveDb(vcdPath);
        setDesignDb(''); // Clear design DB since we now have waveform
        setShowSimulateOption(false);
        createSession.mutate({
          vendor: 'vcd',
          wave_db: vcdPath,
        });
      } else {
        setUploadError('Simulation completed but no VCD path returned');
      }
    } catch (err) {
      const e = err as { response?: unknown };
      console.error('Simulation error:', e?.response || err);
      const errorMsg = getSimulationErrorMessage(err);
      setUploadError(errorMsg);
      sessionLogger.error('Simulation failed', errorMsg);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleUploadWave = async () => {
    if (!waveUploadFiles || waveUploadFiles.length === 0) return;
    setIsUploadingWave(true);
    setUploadError(null);
    try {
      const res = await filesApi.uploadWave(waveUploadFiles);
      const first = res.files[0];
      if (first?.path) {
        setWaveDb(first.path);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Wave upload failed');
    } finally {
      setIsUploadingWave(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-wave-panel border border-wave-border rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-wave-border">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-wave-accent" />
            <h2 className="font-medium">Open Design Database</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-wave-border rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Design Database (KDB / RTL files)
            </label>
            <input
              type="text"
              value={designDb}
              onChange={(e) => setDesignDb(e.target.value)}
              placeholder="/path/to/design.kdb or /path/to/file1.v /path/to/file2.v"
              className="w-full px-3 py-2 bg-wave-bg border border-wave-border rounded text-sm focus:outline-none focus:border-wave-accent font-mono text-xs"
            />
            <p className="mt-1 text-xs text-wave-text/50">
              Path to KDB, RTL directory, or space-separated list of Verilog files
            </p>

            <div className="mt-3 pt-3 border-t border-wave-border/70">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="file"
                  multiple
                  accept=".v,.sv,.vh,.svh,.kdb,.f"
                  className="text-xs"
                  disabled={isUploadingDesign || isSimulating}
                  onChange={(e) => setDesignUploadFiles(e.target.files)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUploadDesign}
                    disabled={!designUploadFiles || designUploadFiles.length === 0 || isUploadingDesign || isSimulating}
                    className="px-3 py-2 text-sm rounded bg-wave-accent text-wave-bg hover:bg-wave-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingDesign ? 'Uploading...' : 'Upload RTL/KDB'}
                  </button>
                  {showSimulateOption && (
                    <button
                      type="button"
                      onClick={handleRunSimulation}
                      disabled={isSimulating || isUploadingDesign}
                      className="px-3 py-2 text-sm rounded bg-amber-600 text-amber-50 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate VCD waveforms by running Verilog simulation"
                    >
                      {isSimulating ? 'Simulating...' : '▶ Simulate'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-wave-accent hover:underline"
          >
            {showAdvanced ? '▼ Hide Advanced' : '▶ Show Advanced Options'}
          </button>

          {showAdvanced && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Waveform Database (FSDB/VCD) - Optional
              </label>
              <input
                type="text"
                value={waveDb}
                onChange={(e) => setWaveDb(e.target.value)}
                placeholder="/path/to/waves.fsdb or /path/to/waves.vcd"
                className="w-full px-3 py-2 bg-wave-bg border border-wave-border rounded text-sm focus:outline-none focus:border-wave-accent font-mono text-xs"
              />

              <div className="mt-3 pt-3 border-t border-wave-border/70">
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="file"
                    multiple={false}
                    accept=".fsdb,.vcd"
                    className="text-xs"
                    disabled={isUploadingWave}
                    onChange={(e) => setWaveUploadFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={handleUploadWave}
                    disabled={!waveUploadFiles || waveUploadFiles.length === 0 || isUploadingWave}
                    className="px-3 py-2 text-sm rounded bg-wave-accent text-wave-bg hover:bg-wave-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingWave ? 'Uploading...' : 'Upload FSDB/VCD'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded border border-red-400/20">
              <div>
                <div className="font-medium">Upload failed</div>
                <div className="text-red-300/80 mt-1">{uploadError}</div>
              </div>
            </div>
          )}

          {createSession.error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded border border-red-400/20">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Failed to open database</div>
                <div className="text-red-300/80 mt-1">{getErrorMessage()}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-wave-border rounded hover:bg-wave-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSession.isPending || (!designDb && !waveDb)}
              className="px-4 py-2 text-sm bg-wave-accent text-wave-bg rounded hover:bg-wave-accent/80 disabled:opacity-50"
            >
              {createSession.isPending ? 'Opening...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
