import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, type Sheet, type SweepResultStep } from '../../api';

export const useSweepState = () => {
  const { sheetId } = useParams<{ sheetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sheet, setSheet] = useState<Sheet | null>(null);

  // Track if we should auto-run based on INITIAL URL params
  const [shouldAutoRun] = useState(
    () => searchParams.has('input') && searchParams.has('outputs'),
  );
  const hasAutoRun = useRef(false);

  // Initialize state from URL params if available
  const [inputNodeId, setInputNodeId] = useState<string>(
    searchParams.get('input') || '',
  );
  const [startValue, setStartValue] = useState<string>(
    searchParams.get('start') || '0',
  );
  const [endValue, setEndValue] = useState<string>(
    searchParams.get('end') || '10',
  );
  const [increment, setIncrement] = useState<string>(
    searchParams.get('step') || '1',
  );
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

  const [selectedOptions, setSelectedOptions] = useState<string[]>(() => {
    const opts = searchParams.get('options');
    return opts ? opts.split(',') : [];
  });
  const [results, setResults] = useState<SweepResultStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const nodes = sheet?.nodes || [];
  const inputOptions = nodes.filter((n) =>
    ['constant', 'input'].includes(n.type),
  );
  const outputOptions = nodes.filter((n) => n.type === 'output');

  // Track the last input node to prevent overwriting URL state on load
  const lastInputNodeId = useRef(inputNodeId);

  // Load Sheet
  useEffect(() => {
    if (sheetId) {
      api
        .getSheet(sheetId)
        .then((loadedSheet) => {
          setSheet(loadedSheet);
          document.title = `Sweep: ${loadedSheet.name} - Parascope`;
          // Initialize overrides with default values
          const defaults: Record<string, string> = {};
          loadedSheet.nodes.forEach((n) => {
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
  }, [sheetId]);

  // Sync state to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (inputNodeId) params.set('input', inputNodeId);
      params.set('start', startValue);
      params.set('end', endValue);
      params.set('step', increment);
      if (selectedOptions.length > 0) {
        params.set('options', selectedOptions.join(','));
      }
      if (outputNodeIds.length > 0) {
        params.set('outputs', outputNodeIds.join(','));
      }
      if (Object.keys(inputOverrides).length > 0) {
        params.set('overrides', JSON.stringify(inputOverrides));
      }

      setSearchParams(params, { replace: true });
    }, 500);

    return () => clearTimeout(timer);
  }, [
    inputNodeId,
    startValue,
    endValue,
    increment,
    selectedOptions,
    outputNodeIds,
    inputOverrides,
    setSearchParams,
  ]);

  // Auto-select first input
  useEffect(() => {
    if (inputOptions.length > 0 && !inputNodeId) {
      setInputNodeId(inputOptions[0].id || '');
    }
  }, [inputOptions, inputNodeId]);

  // Handle Option Type selection
  useEffect(() => {
    const node = nodes.find((n) => n.id === inputNodeId);

    if (inputNodeId !== lastInputNodeId.current) {
      // Input changed manually, reset/default behavior
      lastInputNodeId.current = inputNodeId;
      if (node && node.data?.dataType === 'option') {
        setSelectedOptions(node.data.options);
      } else {
        setSelectedOptions([]);
      }
    } else {
      // Same input (e.g. nodes loaded), check if we need to hydrate defaults
      // Only set if we have NO selection and NO URL param
      if (
        node &&
        node.data?.dataType === 'option' &&
        selectedOptions.length === 0 &&
        !searchParams.has('options')
      ) {
        setSelectedOptions(node.data.options);
      }
    }
  }, [inputNodeId, nodes, selectedOptions.length, searchParams]);

  const handleSweepInputChange = (id: string) => {
    setInputNodeId(id);
    const currentVal = parseFloat(inputOverrides[id] || '0');
    if (!Number.isNaN(currentVal)) {
      if (currentVal === 0) {
        setStartValue('0');
        setEndValue('10');
        setIncrement('1');
      } else {
        const start = currentVal > 0 ? currentVal * 0.5 : currentVal * 1.5;
        const end = currentVal > 0 ? currentVal * 1.5 : currentVal * 0.5;
        setStartValue(start.toString());
        setEndValue(end.toString());
        setIncrement(((end - start) / 20).toPrecision(2));
      }
    }
  };

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
      if (!inputNodeId) throw new Error('Please select an input or constant.');
      if (outputNodeIds.length === 0)
        throw new Error('Please select at least one output.');

      const node = nodes.find((n) => n.id === inputNodeId);
      const isOptionType = node && node.data?.dataType === 'option';

      let start = null;
      let end = null;
      let step = null;
      let manualValues: string[] | null = null;

      if (isOptionType) {
        if (selectedOptions.length === 0) {
          throw new Error('Please select at least one option to sweep.');
        }
        manualValues = selectedOptions;
      } else {
        start = parseFloat(startValue);
        end = parseFloat(endValue);
        step = parseFloat(increment);

        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          Number.isNaN(step) ||
          step === 0
        ) {
          throw new Error(
            'Invalid numeric inputs. Increment must be non-zero.',
          );
        }
      }

      const currentOverrides: Record<string, string> = {};
      Object.entries(inputOverrides).forEach(([id, val]) => {
        if (id !== inputNodeId) {
          currentOverrides[id] = val;
        }
      });

      const res = await api.sweepSheet(
        sheetId,
        inputNodeId,
        start !== null ? String(start) : null,
        end !== null ? String(end) : null,
        step !== null ? String(step) : null,
        manualValues,
        outputNodeIds,
        currentOverrides,
      );
      if (res.error) {
        const msg = `Sweep Error: ${res.error}`;
        setError(msg);
        toast.error(msg);
      }
      setResults(res.results);
    } catch (e: any) {
      const msg = e.message || 'An error occurred during sweep.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    sheetId,
    inputNodeId,
    outputNodeIds,
    startValue,
    endValue,
    increment,
    inputOverrides,
    selectedOptions,
    nodes,
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
    inputNodeId,
    startValue,
    setStartValue,
    endValue,
    setEndValue,
    increment,
    setIncrement,
    outputNodeIds,
    inputOverrides,
    setInputOverrides,
    selectedOptions,
    setSelectedOptions,
    results,
    loading,
    error,
    handleSweepInputChange,
    toggleOutput,
    handleRun,
  };
};
