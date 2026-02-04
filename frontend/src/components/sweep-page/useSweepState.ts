import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, type Sheet, type SweepHeader } from '../../api';

export interface SweepAxisState {
  nodeId: string;
  start: string;
  end: string;
  step: string;
  selectedOptions: string[];
}

export const useSweepState = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sheet, setSheet] = useState<Sheet | null>(null);

  // Track if we should auto-run based on INITIAL URL params
  const [shouldAutoRun] = useState(
    () => searchParams.has('input') && searchParams.has('outputs'),
  );
  const hasAutoRun = useRef(false);

  // --- Consolidated State ---
  const [primaryInput, setPrimaryInput] = useState<SweepAxisState>(() => ({
    nodeId: searchParams.get('input') || '',
    start: searchParams.get('start') || '0',
    end: searchParams.get('end') || '10',
    step: searchParams.get('step') || '1',
    selectedOptions: searchParams.get('options')?.split(',') || [],
  }));

  const [secondaryInput, setSecondaryInput] = useState<SweepAxisState>(() => ({
    nodeId: searchParams.get('sec_input') || '',
    start: searchParams.get('sec_start') || '0',
    end: searchParams.get('sec_end') || '10',
    step: searchParams.get('sec_step') || '1',
    selectedOptions: searchParams.get('sec_options')?.split(',') || [],
  }));

  const [outputNodeIds, setOutputNodeIds] = useState<string[]>(() => {
    const outputs = searchParams.get('outputs');
    return outputs ? outputs.split(',') : [];
  });
  const [inputOverrides, setInputOverrides] = useState<Record<string, string>>(
    () => {
      const overrides = searchParams.get('overrides');
      try {
        return overrides ? JSON.parse(overrides) : {};
      } catch {
        return {};
      }
    },
  );

  const [results, setResults] = useState<any[][] | null>(null);
  const [metadata, setMetadata] = useState<Record<string, any>[] | null>(null);
  const [headers, setHeaders] = useState<SweepHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const nodes = sheet?.nodes || [];
  const inputOptions = nodes.filter((n) =>
    ['constant', 'input'].includes(n.type),
  );
  const outputOptions = nodes.filter((n) => n.type === 'output');

  // Track the last input node to prevent overwriting URL state on load
  const lastPrimaryId = useRef(primaryInput.nodeId);
  const lastSecondaryId = useRef(secondaryInput.nodeId);

  // Helpers to update partial state
  const updatePrimary = useCallback((updates: Partial<SweepAxisState>) => {
    setPrimaryInput((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateSecondary = useCallback((updates: Partial<SweepAxisState>) => {
    setSecondaryInput((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load Sheet
  useEffect(() => {
    if (sheetId) {
      const versionId = searchParams.get('versionId');
      const loadPromise = versionId
        ? Promise.all([
            api.getVersion(sheetId, versionId),
            api.getSheet(sheetId),
          ]).then(([v, draftSheet]) => ({
            ...v.data,
            id: sheetId,
            name: `${draftSheet.name} (${v.version_tag})`,
          }))
        : api.getSheet(sheetId);

      loadPromise
        .then((loadedSheet: any) => {
          setSheet(loadedSheet);
          document.title = `Sweep: ${loadedSheet.name} - Parascope`;
          // Initialize overrides with default values
          const defaults: Record<string, string> = {};
          loadedSheet.nodes.forEach((n: any) => {
            if (['constant', 'input'].includes(n.type)) {
              if (n.data && n.data.value !== undefined) {
                defaults[n.id!] = String(n.data.value);
              } else {
                defaults[n.id!] = '0';
              }
            }
          });
          // Merge defaults with existing state (URL params take precedence)
          setInputOverrides((prev) => ({ ...defaults, ...prev }));
        })
        .catch((err) => {
          console.error(err);
          const msg = 'Failed to load sheet.';
          setError(msg);
          toast.error(msg);
        });
    }
  }, [sheetId, searchParams]);

  // Sync state to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (primaryInput.nodeId) params.set('input', primaryInput.nodeId);
      params.set('start', primaryInput.start);
      params.set('end', primaryInput.end);
      params.set('step', primaryInput.step);
      if (primaryInput.selectedOptions.length > 0) {
        params.set('options', primaryInput.selectedOptions.join(','));
      }

      if (secondaryInput.nodeId) {
        params.set('sec_input', secondaryInput.nodeId);
        params.set('sec_start', secondaryInput.start);
        params.set('sec_end', secondaryInput.end);
        params.set('sec_step', secondaryInput.step);
        if (secondaryInput.selectedOptions.length > 0) {
          params.set('sec_options', secondaryInput.selectedOptions.join(','));
        }
      }

      if (outputNodeIds.length > 0) {
        params.set('outputs', outputNodeIds.join(','));
      }
      if (Object.keys(inputOverrides).length > 0) {
        params.set('overrides', JSON.stringify(inputOverrides));
      }

      const versionId = searchParams.get('versionId');
      if (versionId) {
        params.set('versionId', versionId);
      }

      setSearchParams(params, { replace: true });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    primaryInput,
    secondaryInput,
    outputNodeIds,
    inputOverrides,
    setSearchParams,
    searchParams,
  ]);

  const handleSweepInputChange = useCallback(
    (id: string, isSecondary = false) => {
      const updateFn = isSecondary ? updateSecondary : updatePrimary;

      if (!id) {
        updateFn({ nodeId: '' });
        return; // Deselection
      }

      const node = nodes.find((n) => n.id === id);
      const currentVal = parseFloat(inputOverrides[id] || '0');

      const nextState: Partial<SweepAxisState> = { nodeId: id };

      if (node?.data) {
        const min = parseFloat(node.data.min);
        const max = parseFloat(node.data.max);
        const hasMin = !Number.isNaN(min);
        const hasMax = !Number.isNaN(max);

        if (hasMin && hasMax) {
          nextState.start = String(min);
          nextState.end = String(max);
          nextState.step = ((max - min) / 20).toPrecision(2);
          updateFn(nextState);
          return;
        }

        if (hasMin) {
          nextState.start = String(min);
          // Set currentVal as midpoint: currentVal = (min + end) / 2 => end = 2 * currentVal - min
          const idealEnd = 2 * currentVal - min;
          const estimatedEnd = idealEnd > min ? idealEnd : min + 10;
          nextState.end = String(estimatedEnd);
          nextState.step = ((estimatedEnd - min) / 20).toPrecision(2);
          updateFn(nextState);
          return;
        }

        if (hasMax) {
          nextState.end = String(max);
          // Set currentVal as midpoint: currentVal = (start + max) / 2 => start = 2 * currentVal - max
          const idealStart = 2 * currentVal - max;
          const estimatedStart = idealStart < max ? idealStart : max - 10;
          nextState.start = String(estimatedStart);
          nextState.step = ((max - estimatedStart) / 20).toPrecision(2);
          updateFn(nextState);
          return;
        }
      }

      if (!Number.isNaN(currentVal)) {
        if (currentVal === 0) {
          nextState.start = '0';
          nextState.end = '10';
          nextState.step = '1';
        } else {
          const start = currentVal > 0 ? currentVal * 0.5 : currentVal * 1.5;
          const end = currentVal > 0 ? currentVal * 1.5 : currentVal * 0.5;
          nextState.start = start.toString();
          nextState.end = end.toString();
          nextState.step = ((end - start) / 20).toPrecision(2);
        }
      }
      updateFn(nextState);
    },
    [nodes, inputOverrides, updatePrimary, updateSecondary],
  );

  // Auto-select first input
  useEffect(() => {
    if (inputOptions.length > 0 && !primaryInput.nodeId) {
      handleSweepInputChange(inputOptions[0].id || '');
    }
  }, [inputOptions, primaryInput.nodeId, handleSweepInputChange]);

  // Handle Option Type selection (Primary)
  useEffect(() => {
    const node = nodes.find((n) => n.id === primaryInput.nodeId);
    if (primaryInput.nodeId !== lastPrimaryId.current) {
      lastPrimaryId.current = primaryInput.nodeId;
      if (node && node.data?.dataType === 'option') {
        updatePrimary({ selectedOptions: node.data.options });
      } else {
        updatePrimary({ selectedOptions: [] });
      }
    } else {
      if (
        node &&
        node.data?.dataType === 'option' &&
        primaryInput.selectedOptions.length === 0 &&
        !searchParams.has('options')
      ) {
        updatePrimary({ selectedOptions: node.data.options });
      }
    }
  }, [
    primaryInput.nodeId,
    nodes,
    primaryInput.selectedOptions.length,
    searchParams,
    updatePrimary,
  ]);

  // Handle Option Type selection (Secondary)
  useEffect(() => {
    const node = nodes.find((n) => n.id === secondaryInput.nodeId);
    if (secondaryInput.nodeId !== lastSecondaryId.current) {
      lastSecondaryId.current = secondaryInput.nodeId;
      if (node && node.data?.dataType === 'option') {
        updateSecondary({ selectedOptions: node.data.options });
      } else {
        updateSecondary({ selectedOptions: [] });
      }
    } else {
      if (
        node &&
        node.data?.dataType === 'option' &&
        secondaryInput.selectedOptions.length === 0 &&
        !searchParams.has('sec_options')
      ) {
        updateSecondary({ selectedOptions: node.data.options });
      }
    }
  }, [
    secondaryInput.nodeId,
    nodes,
    secondaryInput.selectedOptions.length,
    searchParams,
    updateSecondary,
  ]);

  const toggleOutput = (id: string) => {
    if (!id) return;
    setOutputNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleRun = useCallback(async () => {
    if (!sheetId) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      if (!primaryInput.nodeId)
        throw new Error('Please select a primary input.');
      if (outputNodeIds.length === 0)
        throw new Error('Please select at least one output.');

      // --- Helper to prepare params for an input ---
      const prepareInputParams = (axisState: SweepAxisState) => {
        const {
          nodeId,
          start: sVal,
          end: eVal,
          step: incVal,
          selectedOptions: selOpts,
        } = axisState;

        const node = nodes.find((n) => n.id === nodeId);
        const isOptionType = node && node.data?.dataType === 'option';
        let start = null;
        let end = null;
        let step = null;
        let manualValues: string[] | null = null;

        if (isOptionType) {
          if (selOpts.length === 0) {
            throw new Error(
              `Please select at least one option for ${node?.label || 'input'}.`,
            );
          }
          manualValues = selOpts;
        } else {
          start = parseFloat(sVal);
          end = parseFloat(eVal);
          step = parseFloat(incVal);

          if (
            Number.isNaN(start) ||
            Number.isNaN(end) ||
            Number.isNaN(step) ||
            step === 0
          ) {
            throw new Error(
              `Invalid numeric inputs for ${node?.label || 'input'}. Increment must be non-zero.`,
            );
          }
        }
        return {
          start: start !== null ? String(start) : null,
          end: end !== null ? String(end) : null,
          step: step !== null ? String(step) : null,
          manualValues,
        };
      };

      // 1. Primary Input
      const primary = prepareInputParams(primaryInput);

      // 2. Secondary Input
      let secondary: any = {};
      if (secondaryInput.nodeId) {
        secondary = prepareInputParams(secondaryInput);
      }

      // 3. Overrides (exclude swept inputs)
      const currentOverrides: Record<string, string> = {};
      Object.entries(inputOverrides).forEach(([id, val]) => {
        if (id !== primaryInput.nodeId && id !== secondaryInput.nodeId) {
          currentOverrides[id] = val;
        }
      });

      const res = await api.sweepSheet(
        sheetId,
        primaryInput.nodeId,
        primary.start,
        primary.end,
        primary.step,
        primary.manualValues,
        outputNodeIds,
        currentOverrides,
        searchParams.get('versionId') || undefined,
        // Secondary
        secondaryInput.nodeId || undefined,
        secondary.start,
        secondary.end,
        secondary.step,
        secondary.manualValues,
      );

      if (res.error) {
        const msg = `Sweep Error: ${res.error}`;
        setError(msg);
        toast.error(msg);
      }
      setResults(res.results);
      setMetadata(res.metadata || null);
      setHeaders(res.headers);
    } catch (e: any) {
      const msg = e.message || 'An error occurred during sweep.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    sheetId,
    primaryInput,
    secondaryInput,
    outputNodeIds,
    inputOverrides,
    nodes,
    searchParams.get,
  ]);

  // Auto-run logic
  useEffect(() => {
    if (sheet && shouldAutoRun && !hasAutoRun.current) {
      hasAutoRun.current = true;
      handleRun();
    }
  }, [sheet, handleRun, shouldAutoRun]);

  return {
    sheet,
    sheetId,
    nodes,
    inputOptions,
    outputOptions,
    // Consolidated State
    primaryInput,
    updatePrimary,
    secondaryInput,
    updateSecondary,
    // Common
    outputNodeIds,
    inputOverrides,
    setInputOverrides,
    results,
    metadata,
    headers,
    loading,
    error,
    handleSweepInputChange,
    toggleOutput,
    handleRun,
  };
};
