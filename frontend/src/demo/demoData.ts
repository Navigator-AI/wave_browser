/**
 * Demo data for waveform viewer - realistic hierarchy with signals
 */

import type { SignalInfo, WaveformData, SessionInfo, ScopeInfo } from '../api/types';

// Signal type for filtering (extends direction with 'internal' and 'parameter')
export type SignalType = 'input' | 'output' | 'inout' | 'internal' | 'parameter';

// Extended signal info with type
export interface DemoSignalInfo extends SignalInfo {
  signalType: SignalType;
}

// Demo session (no backend needed)
export const DEMO_SESSION: SessionInfo = {
  id: 'demo-session',
  vendor: 'demo',
  design_db: 'demo_design',
  time_unit: 'ns',
  min_time: 0,
  max_time: 1000,
  is_completed: true,
  created_at: new Date().toISOString(),
};

// Demo hierarchy structure
export const DEMO_HIERARCHY: ScopeInfo[] = [
  {
    path: 'tb',
    name: 'tb',
    scope_type: 'module',
    def_name: 'tb_counter',
    has_children: true,
    has_signals: true,
  },
];

// Child scopes for each parent
export const DEMO_CHILD_SCOPES: Record<string, ScopeInfo[]> = {
  'tb': [
    {
      path: 'tb.dut',
      name: 'dut',
      scope_type: 'module',
      def_name: 'counter',
      has_children: true,
      has_signals: true,
    },
    {
      path: 'tb.clk_gen',
      name: 'clk_gen',
      scope_type: 'module',
      def_name: 'clock_generator',
      has_children: false,
      has_signals: true,
    },
  ],
  'tb.dut': [
    {
      path: 'tb.dut.alu',
      name: 'alu',
      scope_type: 'module',
      def_name: 'alu_unit',
      has_children: false,
      has_signals: true,
    },
    {
      path: 'tb.dut.reg_file',
      name: 'reg_file',
      scope_type: 'module',
      def_name: 'register_file',
      has_children: false,
      has_signals: true,
    },
    {
      path: 'tb.dut.ctrl',
      name: 'ctrl',
      scope_type: 'module',
      def_name: 'controller',
      has_children: false,
      has_signals: true,
    },
  ],
};

// Signals for each scope
export const DEMO_SCOPE_SIGNALS: Record<string, DemoSignalInfo[]> = {
  'tb': [
    { path: 'tb.clk', name: 'clk', width: 1, left_range: 0, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.reset_n', name: 'reset_n', width: 1, left_range: 0, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.enable', name: 'enable', width: 1, left_range: 0, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.data', name: 'data', width: 8, left_range: 7, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.data_valid', name: 'data_valid', width: 1, left_range: 0, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.done', name: 'done', width: 1, left_range: 0, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.CLOCK_PERIOD', name: 'CLOCK_PERIOD', width: 32, left_range: 31, right_range: 0, direction: 'none', signalType: 'parameter', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.DATA_WIDTH', name: 'DATA_WIDTH', width: 32, left_range: 31, right_range: 0, direction: 'none', signalType: 'parameter', is_real: false, is_array: false, is_composite: false, has_members: false },
  ],
  'tb.dut': [
    { path: 'tb.dut.clk', name: 'clk', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reset_n', name: 'reset_n', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.enable', name: 'enable', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.data_in', name: 'data_in', width: 8, left_range: 7, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.data_out', name: 'data_out', width: 8, left_range: 7, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.valid', name: 'valid', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ready', name: 'ready', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.state', name: 'state', width: 3, left_range: 2, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.counter', name: 'counter', width: 16, left_range: 15, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.WIDTH', name: 'WIDTH', width: 32, left_range: 31, right_range: 0, direction: 'none', signalType: 'parameter', is_real: false, is_array: false, is_composite: false, has_members: false },
  ],
  'tb.clk_gen': [
    { path: 'tb.clk_gen.clk_out', name: 'clk_out', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.clk_gen.period', name: 'period', width: 32, left_range: 31, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.clk_gen.PERIOD', name: 'PERIOD', width: 32, left_range: 31, right_range: 0, direction: 'none', signalType: 'parameter', is_real: false, is_array: false, is_composite: false, has_members: false },
  ],
  'tb.dut.alu': [
    { path: 'tb.dut.alu.a', name: 'a', width: 8, left_range: 7, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.alu.b', name: 'b', width: 8, left_range: 7, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.alu.op', name: 'op', width: 3, left_range: 2, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.alu.result', name: 'result', width: 8, left_range: 7, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.alu.overflow', name: 'overflow', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.alu.zero', name: 'zero', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.alu.carry', name: 'carry', width: 1, left_range: 0, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
  ],
  'tb.dut.reg_file': [
    { path: 'tb.dut.reg_file.clk', name: 'clk', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.we', name: 'we', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.addr', name: 'addr', width: 4, left_range: 3, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.wdata', name: 'wdata', width: 8, left_range: 7, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.rdata', name: 'rdata', width: 8, left_range: 7, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.reg0', name: 'reg0', width: 8, left_range: 7, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.reg1', name: 'reg1', width: 8, left_range: 7, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.reg2', name: 'reg2', width: 8, left_range: 7, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.reg3', name: 'reg3', width: 8, left_range: 7, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.reg_file.NUM_REGS', name: 'NUM_REGS', width: 32, left_range: 31, right_range: 0, direction: 'none', signalType: 'parameter', is_real: false, is_array: false, is_composite: false, has_members: false },
  ],
  'tb.dut.ctrl': [
    { path: 'tb.dut.ctrl.clk', name: 'clk', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ctrl.reset_n', name: 'reset_n', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ctrl.start', name: 'start', width: 1, left_range: 0, right_range: 0, direction: 'input', signalType: 'input', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ctrl.done', name: 'done', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ctrl.busy', name: 'busy', width: 1, left_range: 0, right_range: 0, direction: 'output', signalType: 'output', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ctrl.state', name: 'state', width: 3, left_range: 2, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
    { path: 'tb.dut.ctrl.next_state', name: 'next_state', width: 3, left_range: 2, right_range: 0, direction: 'none', signalType: 'internal', is_real: false, is_array: false, is_composite: false, has_members: false },
  ],
};

// Helper to get all signals (flattened from demo scope signals for backward compatibility)
export const DEMO_SIGNALS: SignalInfo[] = DEMO_SCOPE_SIGNALS['tb'].map(s => {
  const { signalType, ...rest } = s;
  return rest;
});

// Generate clock waveform - toggles every 10ns
function generateClock(start: number, end: number, period: number): WaveformData {
  const changes: { time: number; value: string }[] = [];
  for (let t = start; t <= end; t += period / 2) {
    changes.push({ time: t, value: changes.length % 2 === 0 ? '1' : '0' });
  }
  return {
    signal_path: 'tb.clk',
    start_time: start,
    end_time: end,
    time_unit: 'ns',
    changes,
  };
}

// Demo waveform data for each signal
export const DEMO_WAVEFORM_DATA: Record<string, WaveformData> = {
  'tb.clk': generateClock(0, 1000, 20), // 50MHz clock
  
  'tb.reset_n': {
    signal_path: 'tb.reset_n',
    start_time: 0,
    end_time: 1000,
    time_unit: 'ns',
    changes: [
      { time: 0, value: 'x' },  // Unknown at startup
      { time: 20, value: '0' },
      { time: 50, value: '1' },
    ],
  },
  
  'tb.enable': {
    signal_path: 'tb.enable',
    start_time: 0,
    end_time: 1000,
    time_unit: 'ns',
    changes: [
      { time: 0, value: 'x' },  // Unknown at startup
      { time: 20, value: '0' },
      { time: 100, value: '1' },
      { time: 400, value: '0' },
      { time: 600, value: '1' },
      { time: 800, value: '0' },
      { time: 900, value: 'z' },  // High-impedance
    ],
  },
  
  'tb.data': {
    signal_path: 'tb.data',
    start_time: 0,
    end_time: 1000,
    time_unit: 'ns',
    changes: [
      { time: 0, value: 'xxxxxxxx' },
      { time: 50, value: '00000000' },
      { time: 150, value: '0a' },
      { time: 200, value: '1b' },
      { time: 250, value: '2c' },
      { time: 300, value: '3d' },
      { time: 350, value: '4e' },
      { time: 400, value: 'zzzzzzzz' },  // High-Z when disabled
      { time: 600, value: '00' },
      { time: 650, value: 'a5' },
      { time: 700, value: 'b6' },
      { time: 750, value: 'c7' },
      { time: 800, value: 'zzzzzzzz' },
    ],
  },
  
  'tb.data_valid': {
    signal_path: 'tb.data_valid',
    start_time: 0,
    end_time: 1000,
    time_unit: 'ns',
    changes: [
      { time: 0, value: '0' },
      { time: 150, value: '1' },
      { time: 200, value: '0' },
      { time: 250, value: '1' },
      { time: 300, value: '0' },
      { time: 350, value: '1' },
      { time: 380, value: '0' },
      { time: 650, value: '1' },
      { time: 700, value: '0' },
      { time: 750, value: '1' },
      { time: 780, value: '0' },
    ],
  },
  
  'tb.done': {
    signal_path: 'tb.done',
    start_time: 0,
    end_time: 1000,
    time_unit: 'ns',
    changes: [
      { time: 0, value: '0' },
      { time: 390, value: '1' },
      { time: 410, value: '0' },
      { time: 790, value: '1' },
      { time: 810, value: '0' },
    ],
  },
};
