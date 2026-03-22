/**
 * Demo Verilog source code for code browser demonstration
 */

// Counter module source code
export const COUNTER_V = `// 8-bit Counter Module
// Demonstrates basic counter functionality with enable and reset

module counter #(
    parameter WIDTH = 8
) (
    input  wire             clk,        // Clock input
    input  wire             reset_n,    // Active-low reset
    input  wire             enable,     // Count enable
    input  wire             load,       // Load enable
    input  wire [WIDTH-1:0] load_value, // Value to load
    output reg  [WIDTH-1:0] count,      // Counter output
    output wire             overflow    // Overflow flag
);

    // Internal signals
    wire [WIDTH-1:0] next_count;
    reg              overflow_reg;

    // Next count logic
    assign next_count = count + 1'b1;
    assign overflow = overflow_reg;

    // Counter register
    always @(posedge clk or negedge reset_n) begin
        if (!reset_n) begin
            count <= {WIDTH{1'b0}};
            overflow_reg <= 1'b0;
        end else if (enable) begin
            if (load) begin
                count <= load_value;
                overflow_reg <= 1'b0;
            end else begin
                count <= next_count;
                overflow_reg <= (count == {WIDTH{1'b1}});
            end
        end
    end

    // Assertions (simulation only)
    // synopsys translate_off
    always @(posedge clk) begin
        if (enable && !reset_n) begin
            $display("[%0t] Counter reset", $time);
        end
    end
    // synopsys translate_on

endmodule
`;

// Testbench source code
export const TB_COUNTER_V = `// Counter Testbench
// Comprehensive testbench for counter module

\`timescale 1ns/1ps

module tb_counter;

    // Parameters
    parameter WIDTH = 8;
    parameter CLK_PERIOD = 10;

    // DUT signals
    reg              clk;
    reg              reset_n;
    reg              enable;
    reg              load;
    reg  [WIDTH-1:0] load_value;
    wire [WIDTH-1:0] count;
    wire             overflow;

    // Internal signals
    reg  [WIDTH-1:0] data;
    wire             data_valid;
    reg              done;

    // Clock generation
    initial begin
        clk = 1'b0;
        forever #(CLK_PERIOD/2) clk = ~clk;
    end

    // DUT instantiation
    counter #(
        .WIDTH(WIDTH)
    ) dut (
        .clk        (clk),
        .reset_n    (reset_n),
        .enable     (enable),
        .load       (load),
        .load_value (load_value),
        .count      (count),
        .overflow   (overflow)
    );

    // Test data path
    assign data_valid = enable && !load;

    // Test sequence
    initial begin
        // Initialize
        reset_n = 1'b0;
        enable = 1'b0;
        load = 1'b0;
        load_value = 8'h00;
        data = 8'h00;
        done = 1'b0;

        // Dump waveforms
        $dumpfile("dump.vcd");
        $dumpvars(0, tb_counter);

        // Reset sequence
        #(CLK_PERIOD * 5);
        reset_n = 1'b1;
        #(CLK_PERIOD * 2);

        // Enable counting
        enable = 1'b1;
        repeat(20) @(posedge clk);

        // Load test
        load = 1'b1;
        load_value = 8'hF0;
        @(posedge clk);
        load = 1'b0;
        repeat(20) @(posedge clk);

        // Disable and check
        enable = 1'b0;
        repeat(5) @(posedge clk);

        // Re-enable to overflow
        enable = 1'b1;
        repeat(30) @(posedge clk);

        // Done
        done = 1'b1;
        #(CLK_PERIOD * 5);
        
        $display("Test completed successfully!");
        $finish;
    end

    // Monitor
    always @(posedge clk) begin
        if (overflow) begin
            $display("[%0t] Overflow detected at count=%h", $time, count);
        end
    end

endmodule
`;

// ALU module source code
export const ALU_V = `// Simple ALU Module
// Performs basic arithmetic and logic operations

module alu #(
    parameter WIDTH = 8
) (
    input  wire [WIDTH-1:0] a,        // Operand A
    input  wire [WIDTH-1:0] b,        // Operand B
    input  wire [2:0]       op,       // Operation select
    output reg  [WIDTH-1:0] result,   // ALU result
    output wire             overflow, // Overflow flag
    output wire             zero,     // Zero flag
    output wire             negative  // Negative flag
);

    // Internal signals
    wire [WIDTH:0] sum;
    wire [WIDTH:0] diff;
    reg           carry;

    // ALU operations
    localparam OP_ADD  = 3'b000;
    localparam OP_SUB  = 3'b001;
    localparam OP_AND  = 3'b010;
    localparam OP_OR   = 3'b011;
    localparam OP_XOR  = 3'b100;
    localparam OP_SHL  = 3'b101;
    localparam OP_SHR  = 3'b110;
    localparam OP_NOT  = 3'b111;

    // Arithmetic
    assign sum  = a + b;
    assign diff = a - b;

    // Flags
    assign overflow = (op == OP_ADD) ? sum[WIDTH] : 
                      (op == OP_SUB) ? diff[WIDTH] : 1'b0;
    assign zero     = (result == {WIDTH{1'b0}});
    assign negative = result[WIDTH-1];

    // ALU operation mux
    always @(*) begin
        carry = 1'b0;
        case (op)
            OP_ADD: result = sum[WIDTH-1:0];
            OP_SUB: result = diff[WIDTH-1:0];
            OP_AND: result = a & b;
            OP_OR:  result = a | b;
            OP_XOR: result = a ^ b;
            OP_SHL: result = a << b[2:0];
            OP_SHR: result = a >> b[2:0];
            OP_NOT: result = ~a;
            default: result = {WIDTH{1'b0}};
        endcase
    end

endmodule
`;

// File path to content mapping
export const DEMO_SOURCE_FILES: Record<string, { content: string; language: string }> = {
  '/demo/rtl/counter.v': { content: COUNTER_V, language: 'verilog' },
  '/demo/rtl/alu.v': { content: ALU_V, language: 'verilog' },
  '/demo/tb/tb_counter.v': { content: TB_COUNTER_V, language: 'verilog' },
};

// Source locations for demo hierarchy items
export interface SourceLocation {
  file: string;
  line: number;
  label: string;
}

// Map of scope/signal paths to their source locations
export const DEMO_SOURCE_LOCATIONS: Record<string, SourceLocation> = {
  // Modules (instantiation locations)
  'tb': { 
    file: '/demo/tb/tb_counter.v', 
    line: 6, 
    label: 'module tb_counter' 
  },
  'tb.dut': { 
    file: '/demo/tb/tb_counter.v', 
    line: 36, 
    label: 'counter dut instantiation' 
  },
  
  // Testbench signals (definition locations)
  'tb.clk': { 
    file: '/demo/tb/tb_counter.v', 
    line: 15, 
    label: 'clock signal' 
  },
  'tb.reset_n': { 
    file: '/demo/tb/tb_counter.v', 
    line: 16, 
    label: 'reset signal' 
  },
  'tb.enable': { 
    file: '/demo/tb/tb_counter.v', 
    line: 17, 
    label: 'enable signal' 
  },
  'tb.data': { 
    file: '/demo/tb/tb_counter.v', 
    line: 22, 
    label: 'data bus' 
  },
  'tb.data_valid': { 
    file: '/demo/tb/tb_counter.v', 
    line: 23, 
    label: 'data valid signal' 
  },
  'tb.done': { 
    file: '/demo/tb/tb_counter.v', 
    line: 24, 
    label: 'done flag' 
  },
  
  // DUT module
  'tb.dut.clk': { 
    file: '/demo/rtl/counter.v', 
    line: 7, 
    label: 'module port - clk' 
  },
  'tb.dut.reset_n': { 
    file: '/demo/rtl/counter.v', 
    line: 8, 
    label: 'module port - reset_n' 
  },
  'tb.dut.enable': { 
    file: '/demo/rtl/counter.v', 
    line: 9, 
    label: 'module port - enable' 
  },
  'tb.dut.count': { 
    file: '/demo/rtl/counter.v', 
    line: 12, 
    label: 'counter output' 
  },
  'tb.dut.overflow': { 
    file: '/demo/rtl/counter.v', 
    line: 13, 
    label: 'overflow flag' 
  },
  'tb.dut.next_count': { 
    file: '/demo/rtl/counter.v', 
    line: 17, 
    label: 'internal wire' 
  },
  
  // ALU module
  'tb.dut.alu': { 
    file: '/demo/rtl/alu.v', 
    line: 1, 
    label: 'ALU module' 
  },
  'tb.dut.alu.a': { 
    file: '/demo/rtl/alu.v', 
    line: 6, 
    label: 'operand A' 
  },
  'tb.dut.alu.b': { 
    file: '/demo/rtl/alu.v', 
    line: 7, 
    label: 'operand B' 
  },
  'tb.dut.alu.op': { 
    file: '/demo/rtl/alu.v', 
    line: 8, 
    label: 'operation select' 
  },
  'tb.dut.alu.result': { 
    file: '/demo/rtl/alu.v', 
    line: 9, 
    label: 'result output' 
  },
  'tb.dut.alu.overflow': { 
    file: '/demo/rtl/alu.v', 
    line: 10, 
    label: 'overflow flag' 
  },
  'tb.dut.alu.zero': { 
    file: '/demo/rtl/alu.v', 
    line: 11, 
    label: 'zero flag' 
  },
  'tb.dut.alu.carry': { 
    file: '/demo/rtl/alu.v', 
    line: 15, 
    label: 'carry internal' 
  },
};
