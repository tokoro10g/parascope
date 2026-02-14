import type { AuditLog } from '@/core/api';
import type { ParascopeNode } from '@/core/rete';
import { sortNodesByPosition } from '@/core/utils';

export const formatValue = (val: any) => {
  if (val === null || val === undefined || val === '') return '(empty string)';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
};

export interface DiffLine {
  type: 'added' | 'removed' | 'same';
  text: string;
}

export const computeLineDiff = (oldStr: string, newStr: string): DiffLine[] => {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  const n = oldLines.length;
  const m = newLines.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'same', text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
};

export const groupHistoryByNode = (
  history: AuditLog[],
  nodes: ParascopeNode[],
) => {
  const nodeGroups: Record<string, { label: string; changes: any[] }> = {};
  const currentNodeIds = new Set(nodes.map((n) => n.id));

  history.forEach((log) => {
    log.delta.forEach((d) => {
      const nodeId = d.node_id || 'new-node';
      // Only include if the node currently exists on the sheet
      if (nodeId !== 'new-node' && !currentNodeIds.has(nodeId)) {
        return;
      }

      const label = d.label || '(Unknown Node)';
      if (!nodeGroups[nodeId]) {
        nodeGroups[nodeId] = { label, changes: [] };
      }
      nodeGroups[nodeId].changes.push({
        ...d,
        user_name: log.user_name,
        timestamp: log.timestamp,
        is_unread: log.is_unread,
      });
    });
  });

  const sortedGroups = sortNodesByPosition(
    Object.entries(nodeGroups).map(([nodeId, value]) => {
      const node = nodes.find((n) => n.id === nodeId);
      return {
        ...value,
        id: nodeId,
        x: node?.x ?? 0,
        y: node?.y ?? 0,
      };
    }),
  );

  return sortedGroups;
};
