/**
 * Simple Verilog/SystemVerilog syntax highlighting for CodeMirror 6
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';

// Verilog keywords
const keywords = [
  'module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'logic',
  'integer', 'real', 'time', 'parameter', 'localparam', 'assign', 'always',
  'always_comb', 'always_ff', 'always_latch', 'initial', 'begin', 'end',
  'if', 'else', 'case', 'casex', 'casez', 'endcase', 'default', 'for',
  'while', 'repeat', 'forever', 'fork', 'join', 'join_any', 'join_none',
  'function', 'endfunction', 'task', 'endtask', 'generate', 'endgenerate',
  'genvar', 'posedge', 'negedge', 'or', 'and', 'not', 'nand', 'nor', 'xor',
  'xnor', 'buf', 'bufif0', 'bufif1', 'notif0', 'notif1', 'pullup', 'pulldown',
  'supply0', 'supply1', 'tri', 'triand', 'trior', 'tri0', 'tri1', 'wand', 'wor',
  'signed', 'unsigned', 'packed', 'unpacked', 'interface', 'endinterface',
  'class', 'endclass', 'extends', 'implements', 'virtual', 'static', 'protected',
  'local', 'rand', 'randc', 'constraint', 'covergroup', 'endgroup', 'property',
  'endproperty', 'sequence', 'endsequence', 'program', 'endprogram', 'package',
  'endpackage', 'import', 'export', 'typedef', 'enum', 'struct', 'union',
  'return', 'break', 'continue', 'void', 'automatic', 'extern', 'forkjoin',
];

const keywordSet = new Set(keywords);

// System tasks/functions
const systemTasks = /^\$[a-zA-Z_][a-zA-Z0-9_$]*/;

// Define Verilog language using StreamLanguage
const verilogLanguage = StreamLanguage.define({
  token(stream) {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Single-line comment
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // Block comment
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break;
        stream.next();
      }
      return 'comment';
    }

    // String
    if (stream.match('"')) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"') break;
        if (ch === '\\') stream.next();
      }
      return 'string';
    }

    // Numbers (including sized literals like 8'hFF)
    if (stream.match(/^[0-9]+('[bhod][0-9a-fA-F_xXzZ]+)?/) ||
        stream.match(/^'[bhod][0-9a-fA-F_xXzZ]+/)) {
      return 'number';
    }

    // System tasks ($display, $finish, etc.)
    if (stream.match(systemTasks)) {
      return 'keyword';
    }

    // Compiler directives (`include, `define, etc.)
    if (stream.match(/^`[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return 'meta';
    }

    // Identifiers and keywords
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_$]*/)) {
      const word = stream.current();
      if (keywordSet.has(word)) return 'keyword';
      return 'variableName';
    }

    // Operators
    if (stream.match(/^[+\-*/%&|^~!<>=?:]+/)) {
      return 'operator';
    }

    // Brackets
    if (stream.match(/^[(){}\[\]]/)) {
      return 'bracket';
    }

    // Default: consume one character
    stream.next();
    return null;
  },
});

// Dark theme highlighting for Verilog
const verilogHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c792ea' },           // Purple for keywords
  { tag: tags.comment, color: '#546e7a', fontStyle: 'italic' },
  { tag: tags.string, color: '#c3e88d' },            // Green for strings
  { tag: tags.number, color: '#f78c6c' },            // Orange for numbers
  { tag: tags.variableName, color: '#82aaff' },      // Blue for identifiers
  { tag: tags.operator, color: '#89ddff' },          // Cyan for operators
  { tag: tags.bracket, color: '#89ddff' },
  { tag: tags.meta, color: '#ffcb6b' },              // Yellow for directives
]);

export const verilog = () => [
  verilogLanguage,
  syntaxHighlighting(verilogHighlightStyle),
];

export { verilogLanguage };
