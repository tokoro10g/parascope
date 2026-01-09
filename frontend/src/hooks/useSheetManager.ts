import pRetry from 'p-retry';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { api, type Sheet } from '../api';
import { syncNestedSheets } from '../utils';

export function useSheetManager(
  onLoadSuccess: (sheet: Sheet) => Promise<void> | void,
  setIsDirty: (isDirty: boolean) => void,
) {
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadSheet = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const sheet = await api.getSheet(id);

        // --- SYNC NESTED SHEETS ---
        const { updatedNodes, connectionsChanged, validConnectionIds } =
          await syncNestedSheets(sheet);

        sheet.nodes = updatedNodes;
        if (connectionsChanged) {
          sheet.connections = sheet.connections.filter(
            (c) => c.id && validConnectionIds.has(c.id),
          );
          console.warn(
            'Removed invalid connections due to nested sheet updates',
          );
          alert(
            'Some connections were removed because the inputs/outputs of nested sheets have changed.',
          );
        }
        // --------------------------

        setCurrentSheet(sheet);
        await onLoadSuccess(sheet);
        setIsDirty(false);
        document.title = `Parascope - ${sheet.name}`;
      } catch (e) {
        console.error(e);
        alert(`Error loading sheet: ${e}`);
      } finally {
        setIsLoading(false);
      }
    },
    [onLoadSuccess, setIsDirty],
  );

  const handleSaveSheet = useCallback(async (graphData: { nodes: any[], connections: any[] }) => {
    if (!currentSheet) return;

    const performSave = async () => {
      // graphData is passed in
      const { nodes, connections } = graphData;
      
      return await api.updateSheet(currentSheet.id, {
        nodes,
        connections,
      });
    };

    try {
      const updatedSheet = await pRetry(performSave, {
        retries: 3,
        onFailedAttempt: (error) => {
          console.warn(
            `Save attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
          );
        },
      });

      if (updatedSheet) {
        setCurrentSheet(updatedSheet);
        setIsDirty(false);
        toast.success('Sheet saved successfully');
      }
    } catch (e) {
      console.error('Final save attempt failed:', e);
      toast.error('Error saving sheet after 3 attempts.');
    }
  }, [currentSheet, setIsDirty]);

  const handleRenameSheet = useCallback(
    async (name: string) => {
      if (!currentSheet) return;
      try {
        const updatedSheet = await api.updateSheet(currentSheet.id, { name });
        setCurrentSheet(updatedSheet);
        toast.success('Sheet renamed successfully');
      } catch (e) {
        console.error(e);
        alert(`Error renaming sheet: ${e}`);
      }
    },
    [currentSheet],
  );

  return {
    currentSheet,
    setCurrentSheet,
    isLoading,
    handleLoadSheet,
    handleSaveSheet,
    handleRenameSheet,
  };
}
