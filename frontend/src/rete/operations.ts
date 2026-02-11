import { ClassicPreset as Classic, type NodeEditor } from 'rete';
import type { AreaPlugin } from 'rete-area-plugin';
import type { HistoryPlugin } from 'rete-history-plugin';
import type { ParascopeNode } from './ParascopeNode';
import type { AreaExtra, Schemes } from './types';

export function createOperations(
  instance: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  history: HistoryPlugin<Schemes>,
  notifyGraphChange: () => void,
) {
  const syncSockets = async (
    n: ParascopeNode,
    socketUpdates: { key: string; socket_type?: string }[],
    isInput: boolean,
  ) => {
    const currentSockets = isInput ? n.inputs : n.outputs;
    const newKeys = new Set(socketUpdates.map((i) => i.key));
    const keysToRemove = Object.keys(currentSockets).filter(
      (key) => !newKeys.has(key),
    );

    for (const key of keysToRemove) {
      const connections = instance
        .getConnections()
        .filter((c) =>
          isInput
            ? c.target === n.id && c.targetInput === key
            : c.source === n.id && c.sourceOutput === key,
        );
      for (const c of connections) {
        await instance.removeConnection(c.id);
      }
      if (isInput) n.removeInput(key);
      else n.removeOutput(key);
    }

    socketUpdates.forEach((item) => {
      const sockets = isInput ? n.inputs : n.outputs;
      if (!sockets[item.key]) {
        let socketName = 'socket';
        if (!isInput && n.type === 'sheet') {
          socketName =
            item.socket_type === 'constant'
              ? 'socket-constant'
              : 'socket-output';
        }
        const s = new Classic.Socket(socketName);
        (s as any).portKey = item.key;
        (s as any).isOutput = !isInput;

        if (isInput) n.addInput(item.key, new Classic.Input(s, item.key));
        else n.addOutput(item.key, new Classic.Output(s, item.key));
      }
    });

    const orderedSockets: Record<string, any> = {};
    socketUpdates.forEach((item) => {
      const sockets = isInput ? n.inputs : n.outputs;
      if (sockets[item.key]) {
        orderedSockets[item.key] = sockets[item.key];
      }
    });

    if (isInput) n.inputs = orderedSockets;
    else n.outputs = orderedSockets;
  };

  const apply = async (n: ParascopeNode, u: any, replaceData = false) => {
    if (u.label !== undefined) n.label = u.label;
    if (u.type !== undefined) {
      n.type = u.type;
    }
    if (u.data) {
      if (replaceData) n.data = { ...u.data };
      else n.data = { ...n.data, ...u.data };
    }

    if (u.inputs) await syncSockets(n, u.inputs, true);
    if (u.outputs) await syncSockets(n, u.outputs, false);

    n.setupControl();
    await area.update('node', n.id);
  };

  const updateNode = async (nodeId: string, updates: any) => {
    const node = instance.getNode(nodeId) as ParascopeNode;
    if (!node) return;

    const oldState = {
      label: node.label,
      type: node.type,
      data: JSON.parse(JSON.stringify(node.data)),
      inputs: Object.keys(node.inputs).map((key) => ({ key })),
      outputs: Object.keys(node.outputs).map((key) => ({ key })),
    };

    await apply(node, updates);
    notifyGraphChange();

    history.add({
      undo: async () => {
        const n = instance.getNode(nodeId) as ParascopeNode;
        if (n) {
          await apply(n, oldState, true);
          notifyGraphChange();
        }
      },
      redo: async () => {
        const n = instance.getNode(nodeId) as ParascopeNode;
        if (n) {
          await apply(n, updates, false);
          notifyGraphChange();
        }
      },
    });
  };

  const removeNode = async (nodeId: string) => {
    const node = instance.getNode(nodeId);
    if (!node) return;

    const connections = instance.getConnections().filter((c) => {
      return c.source === nodeId || c.target === nodeId;
    });
    for (const c of connections) {
      await instance.removeConnection(c.id);
    }

    await instance.removeNode(nodeId);
    notifyGraphChange();
  };

  return {
    updateNode,
    removeNode,
  };
}
