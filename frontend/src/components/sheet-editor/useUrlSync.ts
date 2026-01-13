import { useEffect } from 'react';
import type { ParascopeNode } from '../../rete';

interface UseUrlSyncProps {
  nodes: ParascopeNode[];
  searchParams: URLSearchParams;
  setSearchParams: Function;
  calculationInputs: Record<string, string>;
  setCalculationInputs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  initialLoadDone: boolean;
  setInitialLoadDone: (done: boolean) => void;
}

export function useUrlSync({
  nodes,
  searchParams,
  setSearchParams,
  calculationInputs,
  setCalculationInputs,
  initialLoadDone,
  setInitialLoadDone,
}: UseUrlSyncProps) {
  // Sync URL Query Params to Calculation Inputs (ONLY ON INITIAL LOAD)
  useEffect(() => {
    if (nodes.length === 0 || initialLoadDone) return;

    const overrides: Record<string, string> = {};
    let hasOverrides = false;

    searchParams.forEach((value, key) => {
      const node = nodes.find((n) => n.type === 'input' && n.label === key);
      if (node?.id) {
        overrides[node.id] = value;
        hasOverrides = true;
      }
    });

    if (hasOverrides) {
      setCalculationInputs(overrides);
    }
    setInitialLoadDone(true);
  }, [
    searchParams,
    nodes,
    initialLoadDone,
    setCalculationInputs,
    setInitialLoadDone,
  ]);

  // Update URL Query Params when Calculation Inputs change (Value Sink)
  useEffect(() => {
    if (!initialLoadDone) return;

    setSearchParams(
      (prev: URLSearchParams) => {
        const newParams = new URLSearchParams(prev);

        const nodesMap = new Map(nodes.map((n) => [n.id, n.label]));

        Object.entries(calculationInputs).forEach(([id, value]) => {
          const label = nodesMap.get(id);
          if (label) {
            if (value) newParams.set(label, value);
            else newParams.delete(label);
          }
        });

        // Also remove params for inputs that were cleared
        nodes.forEach((n) => {
          if (
            n.type === 'input' &&
            !calculationInputs[n.id] &&
            newParams.has(n.label)
          ) {
            newParams.delete(n.label);
          }
        });

        return newParams;
      },
      { replace: true },
    );
  }, [calculationInputs, nodes, initialLoadDone, setSearchParams]);
}
