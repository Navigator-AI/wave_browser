/**
 * Main waveform viewer component
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, Bookmark, Search } from 'lucide-react';
import { WaveformCanvas } from './WaveformCanvas';
import { waveformApi } from '../../api';
import { useWaveformStore } from '../../store';

export function WaveformViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [searchValue, setSearchValue] = useState('');
  const [showMarkerInput, setShowMarkerInput] = useState(false);
  const [newMarkerName, setNewMarkerName] = useState('');
  
  const {
    currentSession,
    displayedSignals,
    removeSignal,
    waveformData,
    setWaveformData,
    viewStart,
    viewEnd,
    setViewRange,
    cursorTime,
    setCursorTime,
    isDemoMode,
    markers,
    addMarker,
    selectedSignal,
    signalGroups,
  } = useWaveformStore();

  // Calculate canvas height based on signals and groups
  const calculateCanvasHeight = useCallback(() => {
    const RULER_HEIGHT = 24;
    const SIGNAL_HEIGHT = 30;
    const GROUP_HEADER_HEIGHT = 22;
    
    // Build signal to group mapping
    const signalToGroup = new Map<string, typeof signalGroups[0]>();
    signalGroups.forEach(g => {
      g.signalPaths.forEach(p => signalToGroup.set(p, g));
    });
    
    let height = RULER_HEIGHT;
    const renderedGroups = new Set<string>();
    
    displayedSignals.forEach((signal) => {
      const group = signalToGroup.get(signal.path);
      
      if (group && !renderedGroups.has(group.id)) {
        height += GROUP_HEADER_HEIGHT;
        renderedGroups.add(group.id);
      }
      
      if (!group || !group.collapsed) {
        height += SIGNAL_HEIGHT;
      }
    });
    
    return Math.max(400, height + 30);
  }, [displayedSignals, signalGroups]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: calculateCanvasHeight(),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [displayedSignals.length, signalGroups, calculateCanvasHeight]);

  // Fetch waveform data for displayed signals (skip in demo mode)
  const signalsToFetch = displayedSignals.filter(s => !waveformData[s.path]);
  
  useQuery({
    queryKey: ['waveformBatch', currentSession?.id, signalsToFetch.map(s => s.path), viewStart, viewEnd],
    queryFn: async () => {
      if (!currentSession || signalsToFetch.length === 0) return null;
      
      const result = await waveformApi.getWaveformsBatch(currentSession.id, {
        signal_paths: signalsToFetch.map(s => s.path),
        start_time: viewStart,
        end_time: viewEnd,
      });
      
      Object.entries(result.waveforms).forEach(([path, data]) => {
        setWaveformData(path, data);
      });
      
      return result;
    },
    enabled: !!currentSession && signalsToFetch.length > 0 && !isDemoMode,
  });

  const handleZoomIn = () => {
    const center = (viewStart + viewEnd) / 2;
    const range = (viewEnd - viewStart) / 2;
    setViewRange(
      Math.round(center - range * 0.5),
      Math.round(center + range * 0.5)
    );
  };

  const handleZoomOut = () => {
    const center = (viewStart + viewEnd) / 2;
    const range = (viewEnd - viewStart) / 2;
    setViewRange(
      Math.max(0, Math.round(center - range * 2)),
      Math.round(center + range * 2)
    );
  };

  const handleFitAll = () => {
    if (currentSession) {
      setViewRange(currentSession.min_time, currentSession.max_time);
    }
  };

  // Search for value in selected signal or all signals
  const searchForValue = useCallback((direction: 'forward' | 'backward') => {
    if (!searchValue.trim()) return;
    
    const targetSignal = selectedSignal 
      ? displayedSignals.find(s => s.path === selectedSignal)
      : displayedSignals[0];
    
    if (!targetSignal) return;
    
    const waveform = waveformData[targetSignal.path];
    if (!waveform) return;
    
    const searchPattern = searchValue.toLowerCase().trim();
    const currentTime = cursorTime ?? viewStart;
    
    // Match function supporting *, x, z wildcards
    const matches = (value: string) => {
      const v = value.toLowerCase();
      if (searchPattern === '*') return true;
      if (searchPattern === 'x') return v.includes('x');
      if (searchPattern === 'z') return v.includes('z');
      return v === searchPattern || v.includes(searchPattern);
    };
    
    const changes = [...waveform.changes].sort((a, b) => a.time - b.time);
    
    if (direction === 'forward') {
      for (const change of changes) {
        if (change.time > currentTime && matches(change.value)) {
          setCursorTime(change.time);
          // Auto-scroll if needed
          if (change.time > viewEnd || change.time < viewStart) {
            const range = viewEnd - viewStart;
            setViewRange(change.time - range * 0.2, change.time + range * 0.8);
          }
          return;
        }
      }
    } else {
      for (let i = changes.length - 1; i >= 0; i--) {
        if (changes[i].time < currentTime && matches(changes[i].value)) {
          setCursorTime(changes[i].time);
          if (changes[i].time > viewEnd || changes[i].time < viewStart) {
            const range = viewEnd - viewStart;
            setViewRange(changes[i].time - range * 0.8, changes[i].time + range * 0.2);
          }
          return;
        }
      }
    }
  }, [searchValue, selectedSignal, displayedSignals, waveformData, cursorTime, viewStart, viewEnd, setCursorTime, setViewRange]);

  const handleAddMarker = () => {
    if (cursorTime !== null && newMarkerName.trim()) {
      addMarker(newMarkerName.trim(), cursorTime);
      setNewMarkerName('');
      setShowMarkerInput(false);
    }
  };

  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center text-wave-text/50 bg-wave-bg">
        Open a session to view waveforms
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-wave-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-wave-border bg-wave-panel">
        {/* Zoom controls */}
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-wave-border rounded"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-wave-border rounded"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitAll}
          className="p-1.5 hover:bg-wave-border rounded"
          title="Fit All"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-wave-border mx-1" />

        {/* Value search */}
        <div className="flex items-center gap-1">
          <Search className="w-3.5 h-3.5 text-wave-text/50" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search value..."
            className="w-20 px-2 py-1 text-xs bg-wave-bg border border-wave-border rounded focus:outline-none focus:border-wave-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchForValue('forward');
            }}
          />
          <button
            onClick={() => searchForValue('backward')}
            className="p-1 hover:bg-wave-border rounded"
            title="Find Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => searchForValue('forward')}
            className="p-1 hover:bg-wave-border rounded"
            title="Find Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-wave-border mx-1" />

        {/* Marker controls */}
        {showMarkerInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newMarkerName}
              onChange={(e) => setNewMarkerName(e.target.value)}
              placeholder="Marker name..."
              className="w-24 px-2 py-1 text-xs bg-wave-bg border border-wave-border rounded focus:outline-none focus:border-wave-accent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddMarker();
                if (e.key === 'Escape') setShowMarkerInput(false);
              }}
              autoFocus
            />
            <button
              onClick={handleAddMarker}
              className="px-2 py-1 text-xs bg-wave-accent text-wave-bg rounded hover:bg-wave-accent/80"
              disabled={!newMarkerName.trim() || cursorTime === null}
            >
              Add
            </button>
            <button
              onClick={() => setShowMarkerInput(false)}
              className="p-1 hover:bg-wave-border rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowMarkerInput(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-wave-border rounded"
            title="Add Marker at Cursor"
            disabled={cursorTime === null}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Add Marker</span>
          </button>
        )}

        {/* Marker count indicator */}
        {markers.length > 0 && (
          <span className="text-xs text-wave-text/50">
            ({markers.length} marker{markers.length > 1 ? 's' : ''})
          </span>
        )}
        
        <div className="flex-1" />
        
        <div className="text-xs text-wave-text/70">
          Time: {viewStart} - {viewEnd} {currentSession.time_unit}
        </div>
        
        {cursorTime !== null && (
          <div className="text-xs text-wave-signal-0">
            Cursor: {cursorTime} {currentSession.time_unit}
          </div>
        )}
      </div>

      {/* Waveform display */}
      <div className="flex-1 overflow-auto">
        {displayedSignals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-wave-text/50">
            Add signals from the hierarchy panel
          </div>
        ) : (
          <WaveformCanvas
            signals={displayedSignals}
            waveforms={waveformData}
            width={dimensions.width}
            height={dimensions.height}
          />
        )}
      </div>

      {/* Status bar - shows selected signal full path */}
      <div className="border-t border-wave-border bg-wave-panel px-4 py-1.5 flex items-center justify-between">
        <div className="text-xs text-wave-text/70">
          {selectedSignal ? (
            <span>
              <span className="text-wave-accent">Selected:</span>{' '}
              <span className="font-mono">{selectedSignal}</span>
            </span>
          ) : (
            <span>Click on a signal to select it</span>
          )}
        </div>
        {displayedSignals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {displayedSignals.map((signal) => (
              <div
                key={signal.path}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
                  selectedSignal === signal.path 
                    ? 'bg-wave-accent/20 text-wave-accent border border-wave-accent/30' 
                    : 'bg-wave-bg hover:bg-wave-border'
                }`}
                onClick={() => useWaveformStore.getState().setSelectedSignal(signal.path)}
              >
                <span>{signal.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSignal(signal.path); }}
                  className="p-0.5 hover:bg-wave-border rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
