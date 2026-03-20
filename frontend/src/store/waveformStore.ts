/**
 * Application state store using Zustand
 */

import { create } from 'zustand';
import type { SessionInfo, SignalInfo, WaveformData } from '../api/types';
import { DEMO_SESSION, DEMO_SIGNALS, DEMO_WAVEFORM_DATA } from '../demo/demoData';

// Named marker type
export interface NamedMarker {
  id: string;
  name: string;
  time: number;
}

// Signal group type
export interface SignalGroup {
  id: string;
  name: string;
  collapsed: boolean;
  signalPaths: string[];
}

interface WaveformState {
  // Session
  currentSession: SessionInfo | null;
  setCurrentSession: (session: SessionInfo | null) => void;
  
  // Demo mode
  isDemoMode: boolean;
  loadDemoMode: () => void;
  
  // Waveform viewer
  displayedSignals: SignalInfo[];
  addSignal: (signal: SignalInfo) => void;
  addSignals: (signals: SignalInfo[]) => void;
  removeSignal: (signalPath: string) => void;
  clearSignals: () => void;
  
  // Waveform data
  waveformData: Record<string, WaveformData>;
  setWaveformData: (signalPath: string, data: WaveformData) => void;
  
  // Time range
  viewStart: number;
  viewEnd: number;
  setViewRange: (start: number, end: number) => void;
  
  // Cursor
  cursorTime: number | null;
  setCursorTime: (time: number | null) => void;
  
  // Selected scope
  selectedScope: string | null;
  setSelectedScope: (path: string | null) => void;
  
  // Named markers
  markers: NamedMarker[];
  addMarker: (name: string, time: number) => void;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, updates: Partial<Omit<NamedMarker, 'id'>>) => void;
  
  // Selected signal (for highlighting)
  selectedSignal: string | null;
  setSelectedSignal: (path: string | null) => void;
  
  // Signal groups
  signalGroups: SignalGroup[];
  addSignalGroup: (name: string, signalPaths: string[]) => void;
  removeSignalGroup: (id: string) => void;
  toggleGroupCollapsed: (id: string) => void;
  updateGroup: (id: string, updates: Partial<Omit<SignalGroup, 'id'>>) => void;
}

export const useWaveformStore = create<WaveformState>((set) => ({
  // Session
  currentSession: null,
  setCurrentSession: (session) => set({ 
    currentSession: session,
    displayedSignals: [],
    waveformData: {},
    viewStart: session?.min_time ?? 0,
    viewEnd: session?.max_time ?? 1000,
    cursorTime: null,
    selectedScope: null,
    isDemoMode: false,
  }),
  
  // Demo mode
  isDemoMode: false,
  loadDemoMode: () => set({
    isDemoMode: true,
    currentSession: DEMO_SESSION,
    displayedSignals: DEMO_SIGNALS,
    waveformData: DEMO_WAVEFORM_DATA,
    viewStart: DEMO_SESSION.min_time,
    viewEnd: DEMO_SESSION.max_time,
    cursorTime: null,
    selectedScope: null,
    selectedSignal: null,
    markers: [
      { id: 'demo-m1', name: 'Reset', time: 50 },
      { id: 'demo-m2', name: 'Start', time: 100 },
    ],
    signalGroups: [
      { id: 'demo-g1', name: 'Clocks & Control', collapsed: false, signalPaths: ['tb.clk', 'tb.reset_n', 'tb.enable'] },
      { id: 'demo-g2', name: 'Data Path', collapsed: false, signalPaths: ['tb.data', 'tb.data_valid', 'tb.done'] },
    ],
  }),
  
  // Displayed signals
  displayedSignals: [],
  addSignal: (signal) => set((state) => {
    if (state.displayedSignals.some(s => s.path === signal.path)) {
      return state;
    }
    return { displayedSignals: [...state.displayedSignals, signal] };
  }),
  addSignals: (signals) => set((state) => {
    const existingPaths = new Set(state.displayedSignals.map(s => s.path));
    const newSignals = signals.filter(s => !existingPaths.has(s.path));
    if (newSignals.length === 0) return state;
    return { displayedSignals: [...state.displayedSignals, ...newSignals] };
  }),
  removeSignal: (signalPath) => set((state) => ({
    displayedSignals: state.displayedSignals.filter(s => s.path !== signalPath),
    waveformData: Object.fromEntries(
      Object.entries(state.waveformData).filter(([k]) => k !== signalPath)
    ),
  })),
  clearSignals: () => set({ displayedSignals: [], waveformData: {} }),
  
  // Waveform data
  waveformData: {},
  setWaveformData: (signalPath, data) => set((state) => ({
    waveformData: { ...state.waveformData, [signalPath]: data },
  })),
  
  // Time range
  viewStart: 0,
  viewEnd: 1000,
  setViewRange: (start, end) => set({ viewStart: start, viewEnd: end }),
  
  // Cursor
  cursorTime: null,
  setCursorTime: (time) => set({ cursorTime: time }),
  
  // Selected scope
  selectedScope: null,
  setSelectedScope: (path) => set({ selectedScope: path }),
  
  // Named markers
  markers: [],
  addMarker: (name, time) => set((state) => ({
    markers: [...state.markers, { id: crypto.randomUUID(), name, time }],
  })),
  removeMarker: (id) => set((state) => ({
    markers: state.markers.filter(m => m.id !== id),
  })),
  updateMarker: (id, updates) => set((state) => ({
    markers: state.markers.map(m => m.id === id ? { ...m, ...updates } : m),
  })),
  
  // Selected signal
  selectedSignal: null,
  setSelectedSignal: (path) => set({ selectedSignal: path }),
  
  // Signal groups
  signalGroups: [],
  addSignalGroup: (name, signalPaths) => set((state) => ({
    signalGroups: [...state.signalGroups, { id: crypto.randomUUID(), name, collapsed: false, signalPaths }],
  })),
  removeSignalGroup: (id) => set((state) => ({
    signalGroups: state.signalGroups.filter(g => g.id !== id),
  })),
  toggleGroupCollapsed: (id) => set((state) => ({
    signalGroups: state.signalGroups.map(g => g.id === id ? { ...g, collapsed: !g.collapsed } : g),
  })),
  updateGroup: (id, updates) => set((state) => ({
    signalGroups: state.signalGroups.map(g => g.id === id ? { ...g, ...updates } : g),
  })),
}));
