import type { NodeEditor } from 'rete';
import type { AreaPlugin } from 'rete-area-plugin';
import { v4 as uuidv4 } from 'uuid';
import { ParascopeNode } from './ParascopeNode';
import type { AreaExtra, NodeType, Schemes } from './types';

export function createFactory(
  instance: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  calcCenterPosition: () => { x: number; y: number },
  notifyGraphChange: () => void,
) {
  const getUniqueLabel = (
    label: string,
    type: NodeType,
    excludeNodeId?: string,
  ) => {
    const isReservedType =
      type === 'input' || type === 'constant' || type === 'output';
    if (!isReservedType) return label;

    let newLabel = label;
    let counter = 1;
    const nodes = instance.getNodes() as ParascopeNode[];

    const exists = (l: string) =>
      nodes.some(
        (n) => n.type === type && n.label === l && n.id !== excludeNodeId,
      );

    while (exists(newLabel)) {
      newLabel = `${label} (${counter})`;
      counter++;
    }

    return newLabel;
  };

  const addNode = async (
    type: NodeType,
    label: string,
    inputs: { key: string; socket_type?: string }[],
    outputs: { key: string; socket_type?: string }[],
    data: Record<string, any>,
    position?: { x: number; y: number },
  ): Promise<ParascopeNode> => {
    const id = uuidv4();
    const uniqueLabel = getUniqueLabel(label, type);

    const node = new ParascopeNode(type, uniqueLabel, inputs, outputs, data);
    node.id = id;
    node.dbId = id;

    await instance.addNode(node);
    const pos = position || calcCenterPosition();
    await area.translate(node.id, pos);

    notifyGraphChange();
    return node;
  };

  const duplicateNode = async (nodeId: string) => {
    const originalNode = instance.getNode(nodeId) as ParascopeNode;
    if (!originalNode) return;

    const type = originalNode.type;
    const label = originalNode.label;
    const inputs = Object.keys(originalNode.inputs).map((key) => ({ key }));
    const outputs = Object.keys(originalNode.outputs).map((key) => ({ key }));
    const data = JSON.parse(JSON.stringify(originalNode.data));

    const originalView = area.nodeViews.get(nodeId);
    const pos = originalView
      ? { x: originalView.position.x + 50, y: originalView.position.y + 50 }
      : calcCenterPosition();

    return await addNode(type, label, inputs, outputs, data, pos);
  };

  return {
    getUniqueLabel,
    addNode,
    duplicateNode,
  };
}
