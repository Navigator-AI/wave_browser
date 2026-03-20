/**
 * Canvas-based waveform renderer
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { WaveformData, SignalInfo } from '../../api/types';
import { useWaveformStore, type SignalGroup } from '../../store';

const SIGNAL_HEIGHT = 30;
const GROUP_HEADER_HEIGHT = 22;
const PADDING = 4;
const NAME_WIDTH = 150;
const VALUE_WIDTH = 80;
const RULER_HEIGHT = 24;

interface WaveformCanvasProps {
  signals: SignalInfo[];
  waveforms: Record<string, WaveformData>;
  width: number;
  height: number;
}

// Get value at a specific time from waveform data
function getValueAtTime(waveform: WaveformData | undefined, time: number): string {
  if (!waveform || waveform.changes.length === 0) return '-';
  
  let value = waveform.changes[0].value;
  for (const change of waveform.changes) {
    if (change.time > time) break;
    value = change.value;
  }
  return value;
}

// Calculate nice grid intervals based on visible range
function calculateGridInterval(range: number): number {
  const targetTicks = 8;
  const rawInterval = range / targetTicks;
  
  // Round to nice numbers: 1, 2, 5, 10, 20, 50, 100, ...
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalized = rawInterval / magnitude;
  
  let niceInterval: number;
  if (normalized <= 1.5) niceInterval = 1;
  else if (normalized <= 3) niceInterval = 2;
  else if (normalized <= 7) niceInterval = 5;
  else niceInterval = 10;
  
  return niceInterval * magnitude;
}

export function WaveformCanvas({ signals, waveforms, width, height }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    viewStart, viewEnd, cursorTime, setCursorTime, setViewRange,
    markers, selectedSignal, setSelectedSignal,
    signalGroups, toggleGroupCollapsed
  } = useWaveformStore();

  const waveAreaStart = NAME_WIDTH + VALUE_WIDTH;

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);

  const timeToX = useCallback((time: number): number => {
    const waveWidth = width - waveAreaStart;
    return waveAreaStart + ((time - viewStart) / (viewEnd - viewStart)) * waveWidth;
  }, [viewStart, viewEnd, width, waveAreaStart]);

  const xToTime = useCallback((x: number): number => {
    const waveWidth = width - waveAreaStart;
    return viewStart + ((x - waveAreaStart) / waveWidth) * (viewEnd - viewStart);
  }, [viewStart, viewEnd, width, waveAreaStart]);

  // Draw waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, width, height);

    // === Draw Time Ruler ===
    const timeRange = viewEnd - viewStart;
    const gridInterval = calculateGridInterval(timeRange);
    const firstTick = Math.ceil(viewStart / gridInterval) * gridInterval;

    // Ruler background
    ctx.fillStyle = '#252536';
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    
    // Ruler label area
    ctx.fillStyle = '#c0c0d0';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('Time', 8, RULER_HEIGHT / 2);

    // Value column header
    ctx.fillStyle = '#2a2a3d';
    ctx.fillRect(NAME_WIDTH, 0, VALUE_WIDTH, RULER_HEIGHT);
    ctx.fillStyle = '#c0c0d0';
    ctx.fillText('Value', NAME_WIDTH + 8, RULER_HEIGHT / 2);

    // Separator lines
    ctx.strokeStyle = '#3a3a4d';
    ctx.beginPath();
    ctx.moveTo(NAME_WIDTH, 0);
    ctx.lineTo(NAME_WIDTH, RULER_HEIGHT);
    ctx.moveTo(waveAreaStart, 0);
    ctx.lineTo(waveAreaStart, RULER_HEIGHT);
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(width, RULER_HEIGHT);
    ctx.stroke();

    // Draw time ticks and grid lines
    for (let t = firstTick; t <= viewEnd; t += gridInterval) {
      const x = timeToX(t);
      if (x < waveAreaStart) continue;
      
      // Tick mark
      ctx.strokeStyle = '#6a6a8d';
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 6);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Time label
      ctx.fillStyle = '#a0a0c0';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${t}`, x, RULER_HEIGHT - 10);

      // Grid line (lighter, through waveform area)
      ctx.strokeStyle = '#2e2e3e';
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.textAlign = 'left';

    // Build signal path to group mapping
    const signalToGroup = new Map<string, SignalGroup>();
    signalGroups.forEach(g => {
      g.signalPaths.forEach(p => signalToGroup.set(p, g));
    });

    // Track current Y position and rendered group headers
    let currentY = RULER_HEIGHT;
    const renderedGroupHeaders = new Set<string>();

    // === Draw Each Signal with Group Headers ===
    signals.forEach((signal) => {
      const group = signalToGroup.get(signal.path);
      
      // Draw group header if needed
      if (group && !renderedGroupHeaders.has(group.id)) {
        // Group header background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, currentY, width, GROUP_HEADER_HEIGHT);
        
        // Collapse indicator
        ctx.fillStyle = '#89b4fa';
        ctx.font = '10px monospace';
        ctx.fillText(group.collapsed ? '▶' : '▼', 6, currentY + GROUP_HEADER_HEIGHT / 2 + 1);
        
        // Group name
        ctx.fillStyle = '#89b4fa';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(group.name, 20, currentY + GROUP_HEADER_HEIGHT / 2 + 1);
        
        // Signal count
        ctx.fillStyle = '#6a6a8d';
        ctx.font = '9px monospace';
        ctx.fillText(`(${group.signalPaths.length})`, 20 + ctx.measureText(group.name).width + 8, currentY + GROUP_HEADER_HEIGHT / 2 + 1);
        
        // Bottom border
        ctx.strokeStyle = '#3a3a5d';
        ctx.beginPath();
        ctx.moveTo(0, currentY + GROUP_HEADER_HEIGHT);
        ctx.lineTo(width, currentY + GROUP_HEADER_HEIGHT);
        ctx.stroke();
        
        renderedGroupHeaders.add(group.id);
        currentY += GROUP_HEADER_HEIGHT;
      }
      
      // Skip drawing signal if in collapsed group
      if (group && group.collapsed) {
        return;
      }

      const y = currentY;
      const waveform = waveforms[signal.path];
      const isSelected = selectedSignal === signal.path;

      // Draw signal name background (highlight if selected)
      ctx.fillStyle = isSelected ? '#3a3a5d' : '#252536';
      ctx.fillRect(0, y, NAME_WIDTH, SIGNAL_HEIGHT);
      
      // Draw selection indicator
      if (isSelected) {
        ctx.fillStyle = '#a6e3a1';
        ctx.fillRect(0, y, 3, SIGNAL_HEIGHT);
      }

      // Draw signal name (indent if in group)
      ctx.fillStyle = isSelected ? '#a6e3a1' : '#c0c0d0';
      ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';
      ctx.textBaseline = 'middle';
      const indent = group ? 12 : 8;
      ctx.fillText(
        signal.name.slice(0, group ? 16 : 18),
        indent,
        y + SIGNAL_HEIGHT / 2
      );

      // Draw value column background
      ctx.fillStyle = isSelected ? '#3a3a5d' : '#2a2a3d';
      ctx.fillRect(NAME_WIDTH, y, VALUE_WIDTH, SIGNAL_HEIGHT);

      // Draw value at cursor
      if (cursorTime !== null) {
        const value = getValueAtTime(waveform, cursorTime);
        ctx.fillStyle = '#f9e2af'; // Yellow for values
        ctx.font = '11px monospace';
        ctx.fillText(
          value.length > 8 ? value.slice(0, 8) : value,
          NAME_WIDTH + 8,
          y + SIGNAL_HEIGHT / 2
        );
      } else {
        ctx.fillStyle = '#6a6a8d';
        ctx.font = '11px monospace';
        ctx.fillText('-', NAME_WIDTH + 8, y + SIGNAL_HEIGHT / 2);
      }

      // Draw separator lines
      ctx.strokeStyle = '#3a3a4d';
      ctx.beginPath();
      ctx.moveTo(NAME_WIDTH, y);
      ctx.lineTo(NAME_WIDTH, y + SIGNAL_HEIGHT);
      ctx.moveTo(waveAreaStart, y);
      ctx.lineTo(waveAreaStart, y + SIGNAL_HEIGHT);
      ctx.stroke();

      // Draw waveform background
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(waveAreaStart, y, width - waveAreaStart, SIGNAL_HEIGHT);

      // Draw waveform data
      if (waveform && waveform.changes.length > 0) {
        const isBus = signal.width > 1;
        const midY = y + SIGNAL_HEIGHT / 2;
        const highY = y + PADDING;
        const lowY = y + SIGNAL_HEIGHT - PADDING;

        // Helper to check if value is X or Z
        const isX = (v: string) => v.toLowerCase().includes('x');
        const isZ = (v: string) => v.toLowerCase().includes('z');
        
        // Helper to get color for value
        const getColor = (v: string) => {
          if (isX(v)) return '#f38ba8'; // Red for X
          if (isZ(v)) return '#fab387'; // Orange for Z
          return '#a6e3a1'; // Green for valid
        };

        let lastX = waveAreaStart;
        let lastValue = waveform.changes[0]?.value || '0';
        
        // Find initial value before view
        for (const change of waveform.changes) {
          if (timeToX(change.time) >= waveAreaStart) break;
          lastValue = change.value;
        }

        if (isBus) {
          // === Draw Bus (multi-bit) ===
          waveform.changes.forEach((change, i) => {
            const x = timeToX(change.time);
            const nextChange = waveform.changes[i + 1];
            const nextX = nextChange ? Math.min(timeToX(nextChange.time), width) : width;
            
            if (nextX < waveAreaStart) {
              lastValue = change.value;
              return;
            }
            
            const drawX = Math.max(x, waveAreaStart);
            const boxWidth = nextX - drawX;
            
            if (boxWidth < 2) return;

            const color = getColor(change.value);
            
            // Draw bus box
            ctx.strokeStyle = color;
            ctx.fillStyle = isX(change.value) ? 'rgba(243, 139, 168, 0.15)' : 
                            isZ(change.value) ? 'rgba(250, 179, 135, 0.15)' : 
                            'rgba(166, 227, 161, 0.1)';
            ctx.lineWidth = 1;
            
            // Diamond transitions at edges
            ctx.beginPath();
            ctx.moveTo(drawX + 4, midY);
            ctx.lineTo(drawX, highY);
            ctx.lineTo(drawX, lowY);
            ctx.lineTo(drawX + 4, midY);
            ctx.lineTo(nextX - 4, midY);
            ctx.lineTo(nextX, highY);
            ctx.lineTo(nextX, lowY);
            ctx.lineTo(nextX - 4, midY);
            ctx.closePath();
            ctx.fill();
            
            // Top and bottom lines
            ctx.beginPath();
            ctx.moveTo(drawX, highY);
            ctx.lineTo(nextX, highY);
            ctx.moveTo(drawX, lowY);
            ctx.lineTo(nextX, lowY);
            ctx.stroke();
            
            // Draw value text if enough space
            if (boxWidth > 30) {
              ctx.fillStyle = color;
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const displayVal = isX(change.value) ? 'X' : 
                                isZ(change.value) ? 'Z' : 
                                change.value.toUpperCase();
              ctx.fillText(displayVal.slice(0, Math.floor(boxWidth / 8)), (drawX + nextX) / 2, midY);
              ctx.textAlign = 'left';
            }

            lastValue = change.value;
          });
        } else {
          // === Draw Single-bit Signal ===
          ctx.lineWidth = 1;

          waveform.changes.forEach((change) => {
            const x = timeToX(change.time);
            
            if (x < waveAreaStart) {
              lastValue = change.value;
              lastX = waveAreaStart;
              return;
            }

            const color = getColor(lastValue);
            ctx.strokeStyle = color;
            ctx.beginPath();

            // Get Y positions
            const getYForValue = (v: string) => {
              if (isX(v) || isZ(v)) return midY;
              return v === '0' ? lowY : highY;
            };

            const prevY = getYForValue(lastValue);
            const newY = getYForValue(change.value);

            // Draw horizontal line from last position
            ctx.moveTo(lastX, prevY);
            ctx.lineTo(x, prevY);
            ctx.stroke();

            // Draw X/Z hatching if needed
            if (isX(lastValue)) {
              ctx.fillStyle = 'rgba(243, 139, 168, 0.3)';
              ctx.fillRect(lastX, highY, x - lastX, lowY - highY);
            } else if (isZ(lastValue)) {
              ctx.fillStyle = 'rgba(250, 179, 135, 0.3)';
              ctx.fillRect(lastX, highY, x - lastX, lowY - highY);
            }

            // Draw vertical transition
            ctx.strokeStyle = getColor(change.value);
            ctx.beginPath();
            ctx.moveTo(x, prevY);
            ctx.lineTo(x, newY);
            ctx.stroke();

            lastX = x;
            lastValue = change.value;
          });

          // Draw to end
          const color = getColor(lastValue);
          ctx.strokeStyle = color;
          ctx.beginPath();
          const lastY = isX(lastValue) || isZ(lastValue) ? midY : (lastValue === '0' ? lowY : highY);
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(width, lastY);
          ctx.stroke();

          // Fill X/Z region to end
          if (isX(lastValue)) {
            ctx.fillStyle = 'rgba(243, 139, 168, 0.3)';
            ctx.fillRect(lastX, highY, width - lastX, lowY - highY);
          } else if (isZ(lastValue)) {
            ctx.fillStyle = 'rgba(250, 179, 135, 0.3)';
            ctx.fillRect(lastX, highY, width - lastX, lowY - highY);
          }
        }
      }

      // Draw row separator
      ctx.strokeStyle = '#3a3a4d';
      ctx.beginPath();
      ctx.moveTo(0, y + SIGNAL_HEIGHT);
      ctx.lineTo(width, y + SIGNAL_HEIGHT);
      ctx.stroke();
      
      // Update currentY for next signal
      currentY += SIGNAL_HEIGHT;
    });

    // === Draw Named Markers ===
    markers.forEach((marker, idx) => {
      const markerX = timeToX(marker.time);
      if (markerX >= waveAreaStart && markerX <= width) {
        // Marker colors cycle through palette
        const colors = ['#89b4fa', '#f9e2af', '#a6e3a1', '#fab387', '#cba6f7'];
        const color = colors[idx % colors.length];
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(markerX, RULER_HEIGHT);
        ctx.lineTo(markerX, height);
        ctx.stroke();
        
        // Draw marker flag in ruler
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(markerX, 2);
        ctx.lineTo(markerX + 8, 6);
        ctx.lineTo(markerX, 10);
        ctx.closePath();
        ctx.fill();
        
        // Draw marker name
        ctx.font = 'bold 9px monospace';
        ctx.fillText(marker.name.slice(0, 8), markerX + 10, 8);
      }
    });

    // === Draw Cursor ===
    if (cursorTime !== null) {
      const cursorX = timeToX(cursorTime);
      if (cursorX >= waveAreaStart && cursorX <= width) {
        ctx.strokeStyle = '#f38ba8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cursorX, RULER_HEIGHT);
        ctx.lineTo(cursorX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw cursor time in ruler
        ctx.fillStyle = '#f38ba8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${cursorTime}`, cursorX, RULER_HEIGHT - 10);
        ctx.textAlign = 'left';
      }
    }

    // === Draw Drag Selection Overlay ===
    if (isDragging && dragStartX !== null && dragCurrentX !== null) {
      const minX = Math.max(waveAreaStart, Math.min(dragStartX, dragCurrentX));
      const maxX = Math.min(width, Math.max(dragStartX, dragCurrentX));
      
      // Draw semi-transparent selection box
      ctx.fillStyle = 'rgba(137, 180, 250, 0.2)';
      ctx.fillRect(minX, RULER_HEIGHT, maxX - minX, height - RULER_HEIGHT);
      
      // Draw dashed border
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(minX, RULER_HEIGHT, maxX - minX, height - RULER_HEIGHT);
      ctx.setLineDash([]);
      
      // Draw time labels at selection edges
      const startTime = xToTime(minX);
      const endTime = xToTime(maxX);
      
      ctx.fillStyle = '#89b4fa';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(startTime)}`, minX, RULER_HEIGHT - 2);
      ctx.fillText(`${Math.round(endTime)}`, maxX, RULER_HEIGHT - 2);
      ctx.textAlign = 'left';
    }
  }, [signals, waveforms, width, height, viewStart, viewEnd, cursorTime, timeToX, xToTime, waveAreaStart, markers, selectedSignal, signalGroups, isDragging, dragStartX, dragCurrentX]);

  // Find nearest edge in a waveform to a given time
  const findNearestEdge = useCallback((waveform: WaveformData | undefined, time: number): number | null => {
    if (!waveform || waveform.changes.length === 0) return null;
    
    let nearestTime = waveform.changes[0].time;
    let minDiff = Math.abs(time - nearestTime);
    
    for (const change of waveform.changes) {
      const diff = Math.abs(time - change.time);
      if (diff < minDiff) {
        minDiff = diff;
        nearestTime = change.time;
      }
    }
    return nearestTime;
  }, []);

  // Get element at Y position (group header or signal)
  const getElementAtY = useCallback((clickY: number): { type: 'group'; group: SignalGroup } | { type: 'signal'; signal: SignalInfo } | null => {
    if (clickY < RULER_HEIGHT) return null;
    
    // Build mapping of signal path to group
    const signalToGroup = new Map<string, SignalGroup>();
    signalGroups.forEach(g => {
      g.signalPaths.forEach(p => signalToGroup.set(p, g));
    });
    
    let currentY = RULER_HEIGHT;
    const renderedGroupHeaders = new Set<string>();
    
    for (const signal of signals) {
      const group = signalToGroup.get(signal.path);
      
      // Check if this is a group header position
      if (group && !renderedGroupHeaders.has(group.id)) {
        if (clickY >= currentY && clickY < currentY + GROUP_HEADER_HEIGHT) {
          return { type: 'group', group };
        }
        renderedGroupHeaders.add(group.id);
        currentY += GROUP_HEADER_HEIGHT;
      }
      
      // Skip if in collapsed group
      if (group && group.collapsed) {
        continue;
      }
      
      if (clickY >= currentY && clickY < currentY + SIGNAL_HEIGHT) {
        return { type: 'signal', signal };
      }
      currentY += SIGNAL_HEIGHT;
    }
    
    return null;
  }, [signals, signalGroups]);

  // Handle mouse down - start drag selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    
    // Only start drag in waveform area
    if (x > waveAreaStart) {
      setIsDragging(true);
      setDragStartX(x);
      setDragCurrentX(x);
    }
  }, [waveAreaStart]);

  // Handle mouse move - update drag selection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    setDragCurrentX(x);
  }, [isDragging]);

  // Handle mouse up - apply zoom to selected range
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging || dragStartX === null) {
      setIsDragging(false);
      return;
    }
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      setIsDragging(false);
      return;
    }
    
    const x = e.clientX - rect.left;
    const startTime = xToTime(Math.max(waveAreaStart, Math.min(dragStartX, x)));
    const endTime = xToTime(Math.min(width, Math.max(dragStartX, x)));
    
    // Only zoom if selection is meaningful (more than 10 pixels)
    if (Math.abs(x - dragStartX) > 10) {
      setViewRange(Math.round(startTime), Math.round(endTime));
    }
    
    setIsDragging(false);
    setDragStartX(null);
    setDragCurrentX(null);
  }, [isDragging, dragStartX, xToTime, waveAreaStart, width, setViewRange]);

  // Handle click - snap to nearest edge of hovered signal and select it
  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const element = getElementAtY(y);
    if (!element) return;
    
    if (element.type === 'group') {
      // Toggle group collapse
      toggleGroupCollapsed(element.group.id);
      return;
    }
    
    const signal = element.signal;
    
    // Always select the signal when clicking on its row
    setSelectedSignal(signal.path);
    
    // Only snap to edge if clicking in the waveform area
    if (x > waveAreaStart) {
      const waveform = waveforms[signal.path];
      const clickTime = xToTime(x);
      
      const nearestEdge = findNearestEdge(waveform, clickTime);
      if (nearestEdge !== null) {
        setCursorTime(nearestEdge);
      }
    }
  }, [xToTime, waveAreaStart, waveforms, findNearestEdge, getElementAtY, setCursorTime, setSelectedSignal, toggleGroupCollapsed]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const time = xToTime(x);
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;

    const newStart = time - (time - viewStart) * zoomFactor;
    const newEnd = time + (viewEnd - time) * zoomFactor;

    setViewRange(Math.max(0, Math.round(newStart)), Math.round(newEnd));
  }, [viewStart, viewEnd, xToTime, setViewRange]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      className="block cursor-crosshair"
    />
  );
}
