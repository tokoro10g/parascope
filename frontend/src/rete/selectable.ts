import type { NodeEditor } from 'rete';
import type { AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import type { AreaExtra, Schemes } from './types';

export function customSelectableNodes(
  instance: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  selector: ReturnType<typeof AreaExtensions.selector>,
  options: {
    accumulating: { active: (e: PointerEvent | MouseEvent) => boolean };
  },
) {
  function selectNode(node: Schemes['Node']) {
    if (!(node as any).selected) {
      (node as any).selected = true;
      area.update('node', node.id);
    }
  }

  function unselectNode(node: Schemes['Node']) {
    if ((node as any).selected) {
      (node as any).selected = false;
      area.update('node', node.id);
    }
  }

  async function add(nodeId: string, accumulate: boolean) {
    const node = instance.getNode(nodeId);
    if (!node) return;

    await selector.add(
      {
        label: 'node',
        id: node.id,
        async translate(dx, dy) {
          const view = area.nodeViews.get(node.id);
          const current = view?.position;
          if (current) {
            await view.translate(current.x + dx, current.y + dy);
          }
        },
        unselect() {
          unselectNode(node);
        },
      },
      accumulate,
    );
    selectNode(node);
  }

  let twitch: number | null = 0;
  let lastEvent: PointerEvent | MouseEvent | null = null;

  area.addPipe(async (context) => {
    if (context.type === 'nodepicked') {
      const pickedId = context.data.id;
      const accumulate = lastEvent
        ? options.accumulating.active(lastEvent)
        : false;
      const isSelected = selector.isSelected({ id: pickedId, label: 'node' });

      selector.pick({ id: pickedId, label: 'node' });
      twitch = null;

      if (!isSelected || accumulate) {
        await add(pickedId, accumulate);
      }
    } else if (context.type === 'nodetranslated') {
      const { id, position, previous } = context.data;
      const dx = position.x - previous.x;
      const dy = position.y - previous.y;

      if (selector.isPicked({ id, label: 'node' })) {
        await selector.translate(dx, dy);
      }
    } else if (context.type === 'pointerdown') {
      twitch = 0;
      lastEvent = context.data.event;
    } else if (context.type === 'pointermove') {
      if (twitch !== null) twitch++;
      lastEvent = context.data.event;
    } else if (context.type === 'pointerup') {
      if (twitch !== null && twitch < 4 && context.data.event.button !== 2) {
        selector.unselectAll();
      }
      twitch = null;
      lastEvent = context.data.event;
    }
    return context;
  });

  return {
    select: add,
    unselect: async (nodeId: string) => {
      selector.remove({ id: nodeId, label: 'node' });
    },
  };
}
