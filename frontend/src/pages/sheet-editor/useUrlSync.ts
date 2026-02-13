import { useEffect, useRef } from 'react';
import type { ParascopeNode } from '../../core/rete';

interface UseUrlSyncProps {
  nodes: ParascopeNode[];
  searchParams: URLSearchParams;
  calculationInputs: Record<string, string>;
  setCalculationInputs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export function useUrlSync({
  nodes,
  searchParams,
  calculationInputs,
  setCalculationInputs,
}: UseUrlSyncProps) {
  const isUrlReadRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial Sync: URL -> State (ONLY ONCE when nodes are loaded)
  useEffect(() => {
    if (isUrlReadRef.current || nodes.length === 0) return;

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

    // Mark as read immediately so the value sink doesn't run with stale data
    isUrlReadRef.current = true;
  }, [nodes, searchParams, setCalculationInputs]);

  // 2. Continuous Sync: State -> URL (Debounced)
  // We use window.history.replaceState to avoid triggering React Router re-renders
  // which can interrupt user typing and cause focus issues.
  useEffect(() => {
    // Only start pushing to URL AFTER we've finished the initial read
    if (!isUrlReadRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search);
      const nodesMap = new Map(nodes.map((n) => [n.id, n.label]));
      let changed = false;

      // Clear existing input-related params to handle renames/removals
      nodes.forEach((n) => {
        if (n.type === 'input' && currentParams.has(n.label)) {
          currentParams.delete(n.label);
          changed = true;
        }
      });

      // Set current values from state
      Object.entries(calculationInputs).forEach(([id, value]) => {
        const label = nodesMap.get(id);
        if (label && value) {
          currentParams.set(label, value);
          changed = true;
        }
      });

      if (changed) {
        const newSearch = currentParams.toString();
        const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
        // Native replaceState doesn't trigger React Router's state updates
        window.history.replaceState(window.history.state, '', newUrl);
      }
    }, 200); // 200ms debounce

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [calculationInputs, nodes]);
}
