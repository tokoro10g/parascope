import Cookies from 'js-cookie';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const getHeaders = (headers: Record<string, string> = {}) => {
  const user = Cookies.get('parascope_user');
  if (user) {
    headers['X-Parascope-User'] = user;
  }
  return headers;
};

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

export const api = {
  async listSheets(): Promise<SheetSummary[]> {
    const res = await fetch(`${API_BASE}/sheets/`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async listFolders(): Promise<Folder[]> {
    const res = await fetch(`${API_BASE}/sheets/folders`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async deleteFolder(folderId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sheets/folders/${folderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete folder');
    }
  },

  async createFolder(name: string, parent_id?: string): Promise<Folder> {
    const res = await fetch(`${API_BASE}/sheets/folders`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, parent_id }),
    });
    return res.json();
  },

  async createSheet(
    name: string = 'Untitled',
    folder_id?: string,
  ): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, folder_id }),
    });
    return res.json();
  },

  async getSheet(id: string): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/${id}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async updateSheet(id: string, sheet: Partial<Sheet>): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sheet),
    });
    return res.json();
  },

  async duplicateSheet(id: string): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to duplicate sheet');
    }
    return res.json();
  },

  async deleteSheet(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sheets/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete sheet');
    }
  },

  async calculate(
    sheetId: string,
    inputs: Record<string, { value: any }>,
  ): Promise<Record<string, NodeResult>> {
    const res = await fetch(`${API_BASE}/calculate/${sheetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    if (!res.ok) {
      const err = await res.json();
      if (typeof err.detail === 'object' && err.detail.node_id) {
        const error = new Error(err.detail.message);
        (error as any).nodeId = err.detail.node_id;
        throw error;
      }
      throw new Error(err.detail || 'Calculation failed');
    }
    return res.json();
  },
};

export interface NodeResult {
  type: string;
  label: string;
  value?: any;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
}

export const uploadAttachment = async (
  file: File,
): Promise<{ filename: string; url: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/attachments/upload`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload attachment');
  }

  return response.json();
};

export const getAttachmentUrl = (filename: string) => {
  return `${API_BASE}/attachments/${filename}`;
};
