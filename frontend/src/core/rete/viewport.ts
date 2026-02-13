import type { NodeEditor } from 'rete';
import { AreaExtensions, type AreaPlugin } from 'rete-area-plugin';
import type { AreaExtra, Schemes } from './types';

export function createViewport(
  instance: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  selectableNodes: {
    select: (nodeId: string, accumulate: boolean) => Promise<void>;
    unselect: (nodeId: string) => Promise<void>;
  },
  selector: ReturnType<typeof AreaExtensions.selector>,
) {
  const calcCenterPosition = () => {
    const bounds = area.container.getBoundingClientRect();
    const zoom = area.area.transform.k;
    const x = (bounds.width / 2 - area.area.transform.x) / zoom;
    const y = (bounds.height / 2 - area.area.transform.y) / zoom;
    return { x, y };
  };

  const calcCursorPosition = () => {
    const { x, y } = area.area.pointer;
    if (Number.isNaN(x) || Number.isNaN(y) || (x === 0 && y === 0)) {
      return calcCenterPosition();
    }
    return { x, y };
  };

  const zoomToNode = (nodeId: string) => {
    const node = instance.getNode(nodeId);
    if (node) {
      AreaExtensions.zoomAt(area, [node]);
    }
  };

  const zoomToFit = async (nodes?: any[]) => {
    const nodesToZoom = nodes || instance.getNodes();
    await AreaExtensions.zoomAt(area, nodesToZoom);
  };

  const selectNode = (nodeId: string, accumulate: boolean) => {
    selectableNodes.select(nodeId, accumulate);
  };

  const unselectAll = () => {
    selector.unselectAll();
  };

  return {
    calcCenterPosition,
    calcCursorPosition,
    zoomToNode,
    zoomToFit,
    selectNode,
    unselectAll,
  };
}
