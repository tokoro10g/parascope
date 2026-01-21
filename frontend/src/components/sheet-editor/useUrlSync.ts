import { useEffect, useRef, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import type { ParascopeNode } from '../../rete';

interface UseUrlSyncProps {
  nodes: ParascopeNode[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  calculationInputs: Record<string, string>;
  setCalculationInputs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export function useUrlSync({
  nodes,
  searchParams,
  setSearchParams,
  calculationInputs,
  setCalculationInputs,
}: UseUrlSyncProps) {
  const [isUrlRead, setIsUrlRead] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync URL Query Params to Calculation Inputs (ONLY ON INITIAL LOAD)
  useEffect(() => {
    if (isUrlRead || nodes.length === 0) return;

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
      setCalculationInputs((prev) => ({ ...prev, ...overrides }));
    }
    setIsUrlRead(true);
  }, [searchParams, nodes, isUrlRead, setCalculationInputs]);

  // Update URL Query Params when Calculation Inputs change (Value Sink)
  useEffect(() => {
    if (!isUrlRead) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setSearchParams(
        (prev: URLSearchParams) => {
          const newParams = new URLSearchParams(prev);

          const nodesMap = new Map(nodes.map((n) => [n.id, n.label]));

          // First, clear all existing input-related params to handle renames or removals
          nodes.forEach((n) => {
            if (n.type === 'input') {
              newParams.delete(n.label);
            }
          });

          // Then, set current values
          Object.entries(calculationInputs).forEach(([id, value]) => {
            const label = nodesMap.get(id);
            if (label && value) {
              newParams.set(label, value);
            }
          });

          return newParams;
        },
        { replace: true },
      );
    }, 500); // 500ms debounce

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [calculationInputs, nodes, isUrlRead, setSearchParams]);
}
