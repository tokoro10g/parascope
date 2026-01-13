import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const getHeaders = (headers: Record<string, string> = {}) => {
  const user = Cookies.get('parascope_user');
  if (user) {
    headers['X-Parascope-User'] = user;
  }
  return headers;
};

async function request<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (e: any) {
    // Network errors (e.g. offline)
    const msg = e.message || 'Network error';
    toast.error(msg);
    throw e;
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    let errorDetails: any = null;

    try {
      const data = await res.json();
      errorDetails = data;
      if (data.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (typeof data.detail === 'object') {
          message = data.detail.message || JSON.stringify(data.detail);
        }
      }
    } catch {
      // If JSON parse fails, try text
      try {
        const text = await res.text();
        if (text) message = text.slice(0, 300); // Truncate long HTML errors
      } catch {}
    }

    toast.error(message);

    const error = new Error(message);
    // Attach complex details (like node_id) to the error object
    if (errorDetails?.detail && typeof errorDetails.detail === 'object') {
      Object.assign(error, errorDetails.detail);
      // Map node_id to nodeId for frontend consistency
      if (errorDetails.detail.node_id) {
        (error as any).nodeId = errorDetails.detail.node_id;
      }
    }
    throw error;
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export interface Sheet {
  id: string;
  name: string;
  folder_id?: string | null;
  nodes: NodeData[];
  connections: ConnectionData[];
}

export interface SheetSummary {
  id: string;
  name: string;
  owner_name?: string;
  folder_id?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string;
}

export interface NodeData {
  id?: string;
  type: string;
  label: string;
  position_x: number;
  position_y: number;
  inputs: { key: string; socket_type: string }[];
  outputs: { key: string; socket_type: string }[];
  data: Record<string, any>;
}

export interface ConnectionData {
  id?: string;
  source_id: string;
  source_port: string;
  target_id: string;
  target_port: string;
}

export interface GenerateFunctionResponse {
  title: string;
  code: string;
  inputs: string[];
  outputs: string[];
  description: string;
}

export interface Lock {
  sheet_id: string;
  user_id: string;
  tab_id?: string;
  acquired_at: string;
  last_heartbeat_at: string;
  last_save_at: string | null;
}

export interface Session {
  sheet_id: string;
  sheet_name: string;
  user_id: string;
  acquired_at: string;
  last_save_at: string | null;
  duration_since_save: number | null;
}

export const api = {
  // GENAI
  async getGenAIConfig(): Promise<{ enabled: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/api/genai/config`, {
        headers: getHeaders(),
      });
      if (!res.ok) return { enabled: false };
      return res.json();
    } catch (e) {
      console.error('Failed to fetch GenAI config', e);
      return { enabled: false };
    }
  },

  async generateFunction(
    prompt: string,
    existingCode: string = '',
  ): Promise<GenerateFunctionResponse> {
    return request(`${API_BASE}/api/genai/generate_function`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt, existing_code: existingCode }),
    });
  },

  async listSheets(): Promise<SheetSummary[]> {
    return request(`${API_BASE}/sheets/`, {
      headers: getHeaders(),
    });
  },

  async listFolders(): Promise<Folder[]> {
    return request(`${API_BASE}/sheets/folders`, {
      headers: getHeaders(),
    });
  },

  async deleteFolder(folderId: string): Promise<void> {
    return request(`${API_BASE}/sheets/folders/${folderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async createFolder(name: string, parent_id?: string): Promise<Folder> {
    return request(`${API_BASE}/sheets/folders`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, parent_id }),
    });
  },

  async createSheet(
    name: string = 'Untitled',
    folder_id?: string,
  ): Promise<Sheet> {
    return request(`${API_BASE}/sheets/`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, folder_id }),
    });
  },

  async getSheet(id: string): Promise<Sheet> {
    return request(`${API_BASE}/sheets/${id}`, {
      headers: getHeaders(),
    });
  },

  async updateSheet(id: string, sheet: Partial<Sheet>): Promise<Sheet> {
    return request(`${API_BASE}/sheets/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sheet),
    });
  },

  async duplicateSheet(id: string): Promise<Sheet> {
    return request(`${API_BASE}/sheets/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async deleteSheet(id: string): Promise<void> {
    return request(`${API_BASE}/sheets/${id}`, {
      method: 'DELETE',
    });
  },

  async calculate(
    sheetId: string,
    inputs: Record<string, { value: any }>,
  ): Promise<{ results: Record<string, NodeResult> }> {
    return request(`${API_BASE}/calculate/${sheetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
  },

  async calculatePreview(
    inputs: Record<string, { value: any }>,
    graph: Partial<Sheet>,
  ): Promise<{ results: Record<string, NodeResult> }> {
    return request(`${API_BASE}/calculate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs, graph }),
    });
  },

  async generateScript(
    sheetId: string,
    inputs: Record<string, { value: any }>,
  ): Promise<{ script: string }> {
    return request(`${API_BASE}/calculate/${sheetId}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
  },

  async generateScriptPreview(
    inputs: Record<string, { value: any }>,
    graph: Partial<Sheet>,
  ): Promise<{ script: string }> {
    return request(`${API_BASE}/calculate/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs, graph }),
    });
  },

  async uploadAttachment(
    file: File,
  ): Promise<{ filename: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return request(`${API_BASE}/attachments/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData,
    });
  },

  async sweepSheet(
    sheetId: string,
    inputNodeId: string,
    startValue: string | null,
    endValue: string | null,
    increment: string | null,
    manualValues: string[] | null,
    outputNodeIds: string[],
    inputOverrides?: Record<string, any>,
  ): Promise<SweepResponse> {
    return request(`${API_BASE}/sheets/${sheetId}/sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_node_id: inputNodeId,
        start_value: startValue,
        end_value: endValue,
        increment: increment,
        manual_values: manualValues,
        output_node_ids: outputNodeIds,
        input_overrides: inputOverrides,
      }),
    });
  },

  // CONCURRENCY
  async acquireLock(sheetId: string, tabId: string): Promise<Lock> {
    return request<Lock>(`${API_BASE}/api/sheets/${sheetId}/lock`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tab_id: tabId }),
    });
  },

  async releaseLock(sheetId: string, tabId: string): Promise<void> {
    const params = new URLSearchParams({ tab_id: tabId });
    return request<void>(
      `${API_BASE}/api/sheets/${sheetId}/lock?${params.toString()}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      },
    );
  },

  async forceTakeoverLock(sheetId: string, tabId: string): Promise<Lock> {
    return request<Lock>(`${API_BASE}/api/sheets/${sheetId}/lock/force`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tab_id: tabId }),
    });
  },

  async getSessions(): Promise<Session[]> {
    return request<Session[]>(`${API_BASE}/api/sessions`, {
      method: 'GET',
      headers: getHeaders(),
    });
  },

  getLock: (sheetId: string) => {
    return request<Lock | null>(`${API_BASE}/api/sheets/${sheetId}/lock`, {
      method: 'GET',
      headers: getHeaders(),
    });
  },
};

export interface NodeResult {
  type: string;
  label: string;
  value?: any;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  valid?: boolean;
  error?: string;
}

export interface SweepResultStep {
  input_value: string | number;
  outputs: Record<string, any>;
  error?: string | null;
}

export interface SweepResponse {
  results: SweepResultStep[];
}
