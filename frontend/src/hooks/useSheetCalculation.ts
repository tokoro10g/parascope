import { useCallback, useState } from 'react';
import { api, type NodeResult } from '../api';
import type { ParascopeNode } from '../rete';

interface Editor {
  editor: {
    getNodes: () => ParascopeNode[];
  };
  area: {
    update: (
      type: 'socket' | 'node' | 'connection' | 'control' | 'contextmenu',
      id: string,
    ) => Promise<void>;
  };
}

export const useSheetCalculation = (editor: Editor | null | undefined) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastResult, setLastResult] = useState<Record<
    string,
    NodeResult
  > | null>(null);
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);

  const applyCalculationResult = useCallback(
    (result: Record<string, NodeResult>) => {
      console.log('Calculation result:', result);
      setLastResult(result);

      if (editor) {
        editor.editor.getNodes().forEach((node) => {
          const nodeRes = result[node.id];
          if (nodeRes && (nodeRes.valid === false || nodeRes.error)) {
            node.error = nodeRes.error || 'Invalid';
          } else {
            node.error = undefined;
          }
          editor.area.update('node', node.id);
        });
      }

      let firstErrorNodeId: string | null = null;
      for (const [nodeId, nodeRes] of Object.entries(result)) {
        if (nodeRes.valid === false || nodeRes.error) {
          if (!firstErrorNodeId) {
            firstErrorNodeId = nodeId;
          }
        }
      }
      setErrorNodeId(firstErrorNodeId);
    },
    [editor],
  );

  const calculate = useCallback(
    async (sheetId: string, inputs: Record<string, { value: any }>) => {
      setIsCalculating(true);
      try {
        const response = await api.calculate(sheetId, inputs);
        
        // Log the script to the console so the user can see it
        console.groupCollapsed('Generated Python Script');
        console.log(response.script);
        console.groupEnd();

        applyCalculationResult(response.results);
        return response.results;
      } catch (e: any) {
        console.error(e);
        if (e.nodeId) {
          setErrorNodeId(e.nodeId);
        }
        throw e;
      } finally {
        setIsCalculating(false);
      }
    },
    [applyCalculationResult],
  );

  return {
    isCalculating,
    lastResult,
    setLastResult,
    errorNodeId,
    setErrorNodeId,
    calculate,
    applyCalculationResult,
  };
};
