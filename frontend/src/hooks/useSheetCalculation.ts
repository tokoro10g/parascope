import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type NodeResult } from '../api';
import { InputControl, type ParascopeNode } from '../rete';
import { validateGraphConnectivity } from '../utils';

interface Editor {
  instance: {
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
        editor.instance.getNodes().forEach((node) => {
          const nodeRes = result[node.id];
          if (
            nodeRes &&
            !nodeRes.is_dependency_error &&
            (nodeRes.is_computable === false || nodeRes.error)
          ) {
            node.error = nodeRes.error || 'Invalid';
          } else {
            node.error = undefined;
          }

          // Propagate error to InputControl
          Object.values(node.controls).forEach((control) => {
            if (control instanceof InputControl) {
              control.setError(node.error || null);
            }
          });

          editor.area.update('node', node.id);
        });
      }

      let firstErrorNodeId: string | null = null;
      for (const [nodeId, nodeRes] of Object.entries(result)) {
        if (nodeRes.is_computable === false || nodeRes.error) {
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
      setLastResult(null);
      try {
        const response = await api.calculate(sheetId, inputs);
        if (response.error) {
          toast.error(`Execution Error: ${response.error}`);
        }
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

  const calculatePreview = useCallback(
    async (
      inputs: Record<string, { value: any }>,
      graph: any,
      force = false,
    ) => {
      const validation = validateGraphConnectivity(graph);
      if (!validation.is_computable) {
        if (!force) {
          console.warn('Calculation skipped due to incomplete graph');
          setLastResult(null); // Clear stale results
        }

        if (editor) {
          const errorMap = new Map(
            validation.errors.map((e) => [e.nodeId, e.error]),
          );

          editor.instance.getNodes().forEach((node) => {
            const errorMsg = errorMap.get(node.id);
            // Only update if changed to avoid unnecessary renders?
            // Rete update is cheap if we don't spam it.
            node.error = errorMsg;

            // Propagate error to InputControl
            Object.values(node.controls).forEach((control) => {
              if (control instanceof InputControl) {
                control.setError(node.error || null);
              }
            });

            editor.area.update('node', node.id);
          });
        }
        if (!force) return;
      }

      setIsCalculating(true);
      setLastResult(null);
      try {
        const response = await api.calculatePreview(inputs, graph);
        if (response.error) {
          toast.error(`Execution Error: ${response.error}`);
        }
        applyCalculationResult(response.results);
        return response.results;
      } catch (e: any) {
        console.error(e);
        if (e.nodeId) {
          setErrorNodeId(e.nodeId);
        }
        // Don't throw, just log/display error (preview shouldn't block UI)
      } finally {
        setIsCalculating(false);
      }
    },
    [applyCalculationResult, editor],
  );

  return {
    isCalculating,
    lastResult,
    setLastResult,
    errorNodeId,
    setErrorNodeId,
    calculate,
    calculatePreview,
    applyCalculationResult,
  };
};
