/**
 * API Client for Wave Browser backend
 * 
 * Supports multiple backend connections through configurable base URL.
 */

import type {
  SessionCreate,
  SessionListResponse,
  SessionResponse,
  ScopeListResponse,
  SignalListResponse,
  SignalSearchRequest,
  ScopeInfo,
  SignalInfo,
  WaveformResponse,
  WaveformBatchRequest,
  WaveformBatchResponse,
  ValueAtTimeResponse,
  FileEntry,
  FileListResponse,
  FileContentResponse,
  FileUploadResponse,
  UploadPathsResponse,
  SimulationRequest,
  SimulationResponse,
} from './types';

import { apiLogger } from '../utils/logging';

// Current backend URL - can be changed when connecting to different backends
let currentBackendUrl = 'http://localhost:8000';

/**
 * Set the backend URL for API calls
 */
export function setBackendUrl(url: string): void {
  currentBackendUrl = url.replace(/\/$/, ''); // Remove trailing slash
  apiLogger.debug(`Backend URL set to: ${currentBackendUrl}`);
}

/**
 * Get the current backend URL
 */
export function getBackendUrl(): string {
  return currentBackendUrl;
}

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${currentBackendUrl}/api${path}`;
  const method = options?.method || 'GET';
  
  apiLogger.debug(`${method} ${path}`, { body: options?.body });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const requestId = response.headers.get('X-Request-ID');
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      const errorMessage = error.detail || 'Request failed';
      
      apiLogger.error(
        `${method} ${path} failed: ${response.status}`,
        new Error(errorMessage),
        { status: response.status, requestId, error }
      );
      
      throw new ApiError(response.status, errorMessage, error);
    }

    if (response.status === 204) {
      apiLogger.debug(`${method} ${path} completed (204)`, { requestId });
      return undefined as T;
    }

    const data = await response.json();
    apiLogger.debug(`${method} ${path} success`, { requestId, response: data });
    
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network error or other fetch failure
    const message = error instanceof Error ? error.message : 'Network error';
    apiLogger.error(`${method} ${path} network error: ${message}`, error as Error);
    throw new ApiError(0, `Network error: ${message}`);
  }
}

// Session API
export const sessionsApi = {
  list: () => request<SessionListResponse>('/sessions'),
  
  create: (data: SessionCreate) => 
    request<SessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  get: (sessionId: string) => 
    request<SessionResponse>(`/sessions/${sessionId}`),
  
  close: (sessionId: string) => 
    request<void>(`/sessions/${sessionId}`, { method: 'DELETE' }),
};

// Hierarchy API
export const hierarchyApi = {
  getTopScopes: (sessionId: string) =>
    request<ScopeListResponse>(`/hierarchy/${sessionId}/scopes`),
  
  getChildScopes: (sessionId: string, scopePath: string) =>
    request<ScopeListResponse>(`/hierarchy/${sessionId}/scopes/${encodeURIComponent(scopePath)}/children`),
  
  getSignals: (sessionId: string, scopePath: string) =>
    request<SignalListResponse>(`/hierarchy/${sessionId}/scopes/${encodeURIComponent(scopePath)}/signals`),
  
  getScopeInfo: (sessionId: string, scopePath: string) =>
    request<ScopeInfo>(`/hierarchy/${sessionId}/scopes/${encodeURIComponent(scopePath)}`),
  
  getSignalInfo: (sessionId: string, signalPath: string) =>
    request<SignalInfo>(`/hierarchy/${sessionId}/signals/${encodeURIComponent(signalPath)}`),
  
  searchSignals: (sessionId: string, searchRequest: SignalSearchRequest) =>
    request<SignalListResponse>(`/hierarchy/${sessionId}/signals/search`, {
      method: 'POST',
      body: JSON.stringify(searchRequest),
    }),
};

// Waveform API
export const waveformApi = {
  getWaveform: (sessionId: string, signalPath: string, start: number, end: number, maxChanges = 10000) =>
    request<WaveformResponse>(
      `/waveform/${sessionId}/signals/${encodeURIComponent(signalPath)}?start=${start}&end=${end}&max_changes=${maxChanges}`
    ),
  
  getWaveformsBatch: (sessionId: string, batchRequest: WaveformBatchRequest) =>
    request<WaveformBatchResponse>(`/waveform/${sessionId}/batch`, {
      method: 'POST',
      body: JSON.stringify(batchRequest),
    }),
  
  getValueAtTime: (sessionId: string, signalPath: string, time: number) =>
    request<ValueAtTimeResponse>(
      `/waveform/${sessionId}/value/${encodeURIComponent(signalPath)}?time=${time}`
    ),
};

// Files API (for browsing files on the backend machine)
export const filesApi = {
  list: (path?: string) =>
    request<FileListResponse>(`/files${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  
  getRoots: () =>
    request<FileEntry[]>('/files/roots'),
  
  getContent: (path: string) =>
    request<FileContentResponse>(`/files/content?path=${encodeURIComponent(path)}`),

  upload: async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const formData = new FormData();
    for (const f of fileArr) {
      formData.append('files', f);
    }

    const url = `${currentBackendUrl}/api/files/upload`;
    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = error.detail || 'Upload failed';
        throw new ApiError(response.status, errorMessage, error);
      }
      return (await response.json()) as FileUploadResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : 'Network error';
      throw new ApiError(0, `Network error: ${message}`);
    }
  },

  uploadPaths: async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const formData = new FormData();
    for (const f of fileArr) {
      formData.append('files', f);
    }

    const url = `${currentBackendUrl}/api/upload`;
    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = error.detail || 'Upload failed';
        throw new ApiError(response.status, errorMessage, error);
      }
      return (await response.json()) as UploadPathsResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : 'Network error';
      throw new ApiError(0, `Network error: ${message}`);
    }
  },

  uploadDesign: async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const formData = new FormData();
    for (const f of fileArr) {
      formData.append('files', f);
    }

    const url = `${currentBackendUrl}/api/files/upload/design`;
    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = error.detail || 'Upload failed';
        throw new ApiError(response.status, errorMessage, error);
      }
      return (await response.json()) as FileUploadResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : 'Network error';
      throw new ApiError(0, `Network error: ${message}`);
    }
  },

  uploadWave: async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const formData = new FormData();
    for (const f of fileArr) {
      formData.append('files', f);
    }

    const url = `${currentBackendUrl}/api/files/upload/wave`;
    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = error.detail || 'Upload failed';
        throw new ApiError(response.status, errorMessage, error);
      }
      return (await response.json()) as FileUploadResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : 'Network error';
      throw new ApiError(0, `Network error: ${message}`);
    }
  },

  simulate: async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const formData = new FormData();
    for (const f of fileArr) {
      formData.append('files', f);
    }

    const url = `${currentBackendUrl}/api/simulate`;
    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = error.detail || 'Simulation failed';
        throw new ApiError(response.status, errorMessage, error);
      }
      return (await response.json()) as FileUploadResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error instanceof Error ? error.message : 'Network error';
      throw new ApiError(0, `Network error: ${message}`);
    }
  },

  simulateFromPaths: (data: SimulationRequest) =>
    request<SimulationResponse>('/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
