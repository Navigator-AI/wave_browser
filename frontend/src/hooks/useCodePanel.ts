/**
 * Hook for managing code panel state and actions
 */

import { useState, useCallback } from 'react';
import { useWaveformStore } from '../store';
import { DEMO_SOURCE_LOCATIONS, DEMO_SOURCE_FILES } from '../demo/demoSourceCode';
import type { CodeLocation } from '../store/waveformStore';

export interface UseCodePanelReturn {
  location: CodeLocation | null;
  content: string | null;
  isLoading: boolean;
  error: string | null;
  viewCode: (itemPath: string) => void;
  close: () => void;
}

export function useCodePanel(): UseCodePanelReturn {
  const { isDemoMode, codeLocation, setCodeLocation } = useWaveformStore();
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewCode = useCallback(async (itemPath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      if (isDemoMode) {
        // Use demo source locations
        const sourceLocation = DEMO_SOURCE_LOCATIONS[itemPath];
        
        if (!sourceLocation) {
          setError(`No source location for: ${itemPath}`);
          setIsLoading(false);
          return;
        }

        const file = DEMO_SOURCE_FILES[sourceLocation.file];
        if (!file) {
          setError(`Source file not found: ${sourceLocation.file}`);
          setIsLoading(false);
          return;
        }

        setCodeLocation({
          filePath: sourceLocation.file,
          line: sourceLocation.line,
          label: sourceLocation.label,
        });
        setContent(file.content);
      } else {
        // In real mode, would need to get source location from backend
        // For now, just show error
        setError('Code viewing not yet implemented for real mode');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load code';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode, setCodeLocation]);

  const close = useCallback(() => {
    setCodeLocation(null);
    setContent(null);
    setError(null);
  }, [setCodeLocation]);

  return {
    location: codeLocation,
    content,
    isLoading,
    error,
    viewCode,
    close,
  };
}
