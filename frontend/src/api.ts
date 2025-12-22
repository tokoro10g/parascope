const API_BASE = 'http://localhost:8000';

export interface Sheet {
  id: string;
  name: string;
  nodes: NodeData[];
  connections: ConnectionData[];
}

export interface SheetSummary {
  id: string;
  name: string;
  owner_name?: string;
}

export interface NodeData {
  id: string;
  type: string;
  label: string;
  position_x: number;
  position_y: number;
  inputs: { key: string; socket_type: string }[];
  outputs: { key: string; socket_type: string }[];
  data: Record<string, any>;
}

export interface ConnectionData {
  id: string;
  source_id: string;
  source_port: string;
  target_id: string;
  target_port: string;
}

export const api = {
  async listSheets(): Promise<SheetSummary[]> {
    const res = await fetch(`${API_BASE}/sheets/`);
    return res.json();
  },

  async createSheet(name: string = 'Untitled'): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  async getSheet(id: string): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/${id}`);
    return res.json();
  },

  async updateSheet(id: string, sheet: Partial<Sheet>): Promise<Sheet> {
    const res = await fetch(`${API_BASE}/sheets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheet),
    });
    return res.json();
  },

  async calculate(sheetId: string, inputs?: Record<string, any>): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/calculate/${sheetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs || {}),
    });
    return res.json();
  },
};
