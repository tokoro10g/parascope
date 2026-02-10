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
  let marquee: {
    start: { x: number; y: number };
    screenStart: { x: number; y: number };
    el: HTMLDivElement;
  } | null = null;

  area.addPipe(async (context) => {
    if (context.type === 'nodepicked') {
      const pickedId = context.data.id;
      const accumulate = lastEvent
        ? options.accumulating.active(lastEvent)
        : false;
      const isSelected = selector.isSelected({ id: pickedId, label: 'node' });

      if (isSelected && accumulate) {
        // Toggle off if already selected and modifier is pressed
        await selector.remove({ id: pickedId, label: 'node' });
        twitch = null;
        return;
      }

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

      const isBackground =
        context.data.event.target === area.area.content.holder.parentNode;
      const accumulate = options.accumulating.active(context.data.event);

      if (isBackground && accumulate) {
        const { x, y } = context.data.position;
        const screenX = context.data.event.clientX;
        const screenY = context.data.event.clientY;

        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.border = '1px solid var(--primary-color)';
        el.style.backgroundColor = 'rgba(var(--primary-color-rgb), 0.1)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '1000';
        document.body.appendChild(el);

        marquee = {
          start: { x, y },
          screenStart: { x: screenX, y: screenY },
          el,
        };
        // Prevent area dragging
        return;
      }
    } else if (context.type === 'pointermove') {
      if (twitch !== null) twitch++;
      lastEvent = context.data.event;

      if (marquee) {
        const screenX = context.data.event.clientX;
        const screenY = context.data.event.clientY;

        const x = Math.min(screenX, marquee.screenStart.x);
        const y = Math.min(screenY, marquee.screenStart.y);
        const w = Math.abs(screenX - marquee.screenStart.x);
        const h = Math.abs(screenY - marquee.screenStart.y);

        marquee.el.style.left = `${x}px`;
        marquee.el.style.top = `${y}px`;
        marquee.el.style.width = `${w}px`;
        marquee.el.style.height = `${h}px`;
        return;
      }
    } else if (context.type === 'pointerup') {
      const isBackground =
        context.data.event.target === area.area.content.holder.parentNode;

      if (marquee) {
        const { x: x1, y: y1 } = marquee.start;
        const { x: x2, y: y2 } = context.data.position;

        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);

        const nodes = instance.getNodes();
        const selectedNodes = nodes.filter((node) => {
          const view = area.nodeViews.get(node.id);
          if (!view) return false;
          const { x, y } = view.position;
          const w = (node as any).width || 180;
          const h = (node as any).height || 150;

          return x < maxX && x + w > minX && y < maxY && y + h > minY;
        });

        if (selectedNodes.length > 0) {
          // If shift is NOT pressed, clear previous selection?
          // For now, let's follow the 'accumulate' logic.
          // But usually marquee select either adds to selection or replaces it.
          // If Ctrl is held, it should probably add.
          const accumulate = options.accumulating.active(context.data.event);
          if (!accumulate) {
            await selector.unselectAll();
          }

          for (const node of selectedNodes) {
            await add(node.id, true);
          }
        }

        document.body.removeChild(marquee.el);
        marquee = null;
        twitch = null;
        return;
      }

      if (twitch !== null && twitch < 4) {
        if (context.data.event.button !== 2 || isBackground) {
          selector.unselectAll();
        }
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
    isMarqueeActive: () => marquee !== null,
  };
}
