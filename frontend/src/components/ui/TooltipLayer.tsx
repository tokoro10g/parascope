import { AlertTriangle, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { NodeEditorWrapper } from '@/core/rete';

interface TooltipLayerProps {
  editor: NodeEditorWrapper | null;
}

export const TooltipLayer: React.FC<TooltipLayerProps> = ({ editor }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [errors, setErrors] = useState<
    { id: string; x: number; y: number; w: number; h: number; msg: string }[]
  >([]);
  const [dismissedErrors, setDismissedErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!editor) return;

    let animationFrameId: number;

    const render = () => {
      const area = editor.area.area;
      if (area?.transform) {
        setTransform({ ...area.transform });
      }

      const newErrors = [];
      for (const node of editor.instance.getNodes()) {
        if (node.error) {
          // Check if this exact error message was dismissed
          if (dismissedErrors[node.id] === node.error) continue;

          const view = editor.area.nodeViews.get(node.id);
          if (view) {
            newErrors.push({
              id: node.id,
              x: view.position.x,
              y: view.position.y,
              w: view.element.offsetWidth,
              h: view.element.offsetHeight,
              msg: node.error,
            });
          }
        } else if (dismissedErrors[node.id]) {
          // Cleanup dismissal if error is gone
          setDismissedErrors((prev) => {
            const next = { ...prev };
            delete next[node.id];
            return next;
          });
        }
      }
      setErrors(newErrors);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [editor, dismissedErrors]);

  const handleDismiss = (id: string, msg: string) => {
    setDismissedErrors((prev) => ({ ...prev, [id]: msg }));
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
        }}
      >
        {errors.map((e) => (
          <div
            key={e.id}
            style={{
              position: 'absolute',
              transform: `translate(${e.x}px, ${e.y}px)`,
              width: e.w,
              height: e.h,
            }}
          >
            <div
              className="node-error-tooltip"
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '8px',
                backgroundColor: '#ff5252',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.85em',
                minWidth: 'max-content',
                maxWidth: '600px',
                whiteSpace: 'pre-wrap',
                overflowX: 'auto',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
              }}
            >
              <AlertTriangle
                size={14}
                style={{ marginTop: '2px', flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{e.msg}</span>
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation(); // Prevent affecting node selection
                  handleDismiss(e.id, e.msg);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0',
                  marginLeft: '4px',
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 'auto',
                }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
              <div
                style={{
                  position: 'absolute',
                  top: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ff5252',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
