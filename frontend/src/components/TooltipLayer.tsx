import { AlertTriangle } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';

interface TooltipLayerProps {
  editor: any;
}

export const TooltipLayer: React.FC<TooltipLayerProps> = ({ editor }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [errors, setErrors] = useState<
    { id: string; x: number; y: number; w: number; h: number; msg: string }[]
  >([]);

  useEffect(() => {
    if (!editor) return;

    let animationFrameId: number;

    const render = () => {
      const area = editor.area.area;
      if (area?.transform) {
        setTransform({ ...area.transform });
      }

      const newErrors = [];
      for (const node of editor.editor.getNodes()) {
        if (node.error) {
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
        }
      }
      setErrors(newErrors);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [editor]);

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
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                maxWidth: '400px',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertTriangle size={14} />
              {e.msg}
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
