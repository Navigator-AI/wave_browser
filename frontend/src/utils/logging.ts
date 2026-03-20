/**
 * Frontend logging utility for Wave Browser.
 * 
 * Provides structured logging with:
 * - Console output with colors and timestamps
 * - Log level filtering
 * - API request/response logging
 * - Error tracking
 * 
 * Usage:
 *   import { logger } from './logging';
 *   logger.info('Message');
 *   logger.error('Error', error);
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  error?: Error;
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#6b7280',
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
};

// Log level hierarchy
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Configuration
let currentLogLevel: LogLevel = 'info';
const logHistory: LogEntry[] = [];
const MAX_HISTORY = 100;

/**
 * Set the minimum log level to display.
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  console.log(`%c[Logger] Log level set to: ${level}`, 'color: #6b7280');
}

/**
 * Get the current log level.
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Get log history (most recent entries).
 */
export function getLogHistory(): LogEntry[] {
  return [...logHistory];
}

/**
 * Clear log history.
 */
export function clearLogHistory(): void {
  logHistory.length = 0;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, -1);
}

function createLogEntry(
  level: LogLevel,
  category: string,
  message: string,
  data?: unknown,
  error?: Error
): LogEntry {
  return {
    timestamp: formatTimestamp(),
    level,
    category,
    message,
    data,
    error,
  };
}

function log(
  level: LogLevel,
  category: string,
  message: string,
  data?: unknown,
  error?: Error
): void {
  if (!shouldLog(level)) return;

  const entry = createLogEntry(level, category, message, data, error);
  
  // Store in history
  logHistory.push(entry);
  if (logHistory.length > MAX_HISTORY) {
    logHistory.shift();
  }

  // Console output
  const color = LOG_COLORS[level];
  const prefix = `%c[${entry.timestamp}] [${level.toUpperCase()}] [${category}]`;
  
  if (error) {
    console.groupCollapsed(prefix + ` ${message}`, `color: ${color}`);
    if (data) console.log('Data:', data);
    console.error('Error:', error);
    console.groupEnd();
  } else if (data !== undefined) {
    console.groupCollapsed(prefix + ` ${message}`, `color: ${color}`);
    console.log('Data:', data);
    console.groupEnd();
  } else {
    console.log(prefix + ` ${message}`, `color: ${color}`);
  }
}

/**
 * Create a logger instance for a specific category.
 */
export function createLogger(category: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', category, message, data),
    info: (message: string, data?: unknown) => log('info', category, message, data),
    warn: (message: string, data?: unknown) => log('warn', category, message, data),
    error: (message: string, error?: Error | unknown, data?: unknown) => {
      const err = error instanceof Error ? error : undefined;
      const extraData = error instanceof Error ? data : error;
      log('error', category, message, extraData, err);
    },
  };
}

// Default logger
export const logger = createLogger('App');

// API-specific logger
export const apiLogger = createLogger('API');

// UI-specific loggers
export const sessionLogger = createLogger('Session');
export const hierarchyLogger = createLogger('Hierarchy');
export const waveformLogger = createLogger('Waveform');
