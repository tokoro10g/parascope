import { useCallback, useEffect, useState } from 'react';
import type { NodeEditorWrapper } from '../rete';

export interface GraphState {
  nodes: any[];
  connections: any[];
}

export function useGraphState(editor: NodeEditorWrapper | null) {
  const [graph, setGraph] = useState<GraphState>({
    nodes: [],
    connections: [],
  });

  const sync = useCallback(() => {
    if (!editor) return;
    const data = editor.getGraphData();
    setGraph(data);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    // Initial sync
    sync();

    // Register as a listener for graph changes
    const unsubscribeGraph = editor.addGraphChangeListener(() => {
      sync();
    });

    return () => {
      unsubscribeGraph();
    };
  }, [editor, sync]);

  return { nodes: graph.nodes, connections: graph.connections, sync };
}
