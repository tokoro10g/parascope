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
  has_updates?: boolean;
}

export interface AuditLog {
  id: string;
  sheet_id: string;
  user_name: string;
  timestamp: string;
  delta: any[];
  is_unread?: boolean;
}

export interface SheetVersion {
  id: string;
  sheet_id: string;
  version_tag: string;
  description?: string;
  data: any;
  created_at: string;
  created_by: string;
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

export interface SheetUsage {
  parent_sheet_id: string;
  parent_sheet_name: string;
  node_path: { id: string; label: string }[];
  can_import: boolean;
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
    urls: string[] = [],
    image?: string,
    existingDescription: string = '',
  ): Promise<GenerateFunctionResponse> {
    return request(`${API_BASE}/api/genai/generate_function`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        prompt,
        existing_code: existingCode,
        urls,
        image,
        existing_description: existingDescription,
      }),
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

  async updateFolder(id: string, folder: Partial<Folder>): Promise<Folder> {
    return request(`${API_BASE}/sheets/folders/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(folder),
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

  async getSheetUsages(sheetId: string): Promise<SheetUsage[]> {
    return request(`${API_BASE}/sheets/${sheetId}/usages`, {
      headers: getHeaders(),
    });
  },

  async deleteSheet(id: string): Promise<void> {
    return request(`${API_BASE}/sheets/${id}`, {
      method: 'DELETE',
    });
  },

  async getSheetHistory(id: string): Promise<AuditLog[]> {
    return request(`${API_BASE}/sheets/${id}/history`, {
      headers: getHeaders(),
    });
  },

  async markSheetAsRead(id: string): Promise<{ ok: boolean }> {
    return request(`${API_BASE}/sheets/${id}/read`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async listSheetVersions(id: string): Promise<SheetVersion[]> {
    return request(`${API_BASE}/sheets/${id}/versions`, {
      headers: getHeaders(),
    });
  },

  async createSheetVersion(
    id: string,
    version_tag: string,
    description?: string,
  ): Promise<SheetVersion> {
    return request(`${API_BASE}/sheets/${id}/versions`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ version_tag, description }),
    });
  },

  async getVersion(sheetId: string, versionId: string): Promise<SheetVersion> {
    return request(`${API_BASE}/sheets/${sheetId}/versions/${versionId}`, {
      headers: getHeaders(),
    });
  },

  async calculate(
    sheetId: string,
    inputs: Record<string, { value: any }>,
  ): Promise<{ results: Record<string, NodeResult>; error?: string }> {
    return request(`${API_BASE}/calculate/${sheetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
  },

  async calculatePreview(
    inputs: Record<string, { value: any }>,
    graph: Partial<Sheet>,
  ): Promise<{ results: Record<string, NodeResult>; error?: string }> {
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
    inputOverrides: Record<string, string>,
    // Secondary Input
    secondaryInputNodeId?: string,
    secondaryStartValue?: string | null,
    secondaryEndValue?: string | null,
    secondaryIncrement?: string | null,
    secondaryManualValues?: string[] | null,
  ): Promise<SweepResponse> {
    const res = await fetch(`${API_BASE}/sheets/${sheetId}/sweep`, {
      method: 'POST',
      headers: getHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        input_node_id: inputNodeId,
        start_value: startValue,
        end_value: endValue,
        increment: increment,
        manual_values: manualValues,
        output_node_ids: outputNodeIds,
        input_overrides: inputOverrides,
        // Secondary
        secondary_input_node_id: secondaryInputNodeId,
        secondary_start_value: secondaryStartValue,
        secondary_end_value: secondaryEndValue,
        secondary_increment: secondaryIncrement,
        secondary_manual_values: secondaryManualValues,
      }),
    });
    return res.json();
  },

  // CONCURRENCY
  async acquireLock(sheetId: string, tabId: string): Promise<Lock> {
    return request<Lock>(`${API_BASE}/api/sheets/${sheetId}/lock`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tab_id: tabId }),
    });
  },

  async releaseLock(
    sheetId: string,
    tabId: string,
    options: RequestInit = {},
  ): Promise<void> {
    const params = new URLSearchParams({ tab_id: tabId });
    return request<void>(
      `${API_BASE}/api/sheets/${sheetId}/lock?${params.toString()}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
        ...options,
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
  nodes?: Record<string, NodeResult>;
}

export interface SweepHeader {
  id: string;
  label: string;
  type: 'input' | 'output';
}

export interface SweepResponse {
  headers: SweepHeader[];
  results: any[][];
  metadata?: Record<string, any>[];
  error?: string;
}
