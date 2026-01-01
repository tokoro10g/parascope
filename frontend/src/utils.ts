import type { NodeResult } from './api';

export const extractValuesFromResult = (
  result: Record<string, NodeResult>,
): Record<string, any> => {
  const values: Record<string, any> = {};
  Object.entries(result).forEach(([id, nodeRes]) => {
    if (nodeRes.value !== undefined) {
      values[id] = nodeRes.value;
    }
  });
  return values;
};
