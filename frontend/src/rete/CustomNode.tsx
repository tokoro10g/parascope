import {
  CaseLower,
  Import,
  LogIn,
  LogOut,
  MessageSquare,
  Sigma,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Presets } from 'rete-react-plugin';
import './custom-node.css';

const styles: Record<string, { background: string; borderColor: string }> = {
  constant: { background: 'rgba(236, 64, 122, 0.8)', borderColor: '#ec407a' },
  function: { background: 'rgba(100, 181, 246, 0.8)', borderColor: '#2196f3' },
  input: { background: 'rgba(255, 183, 77, 0.8)', borderColor: '#ff9800' },
  output: { background: 'rgba(110, 218, 110, 0.8)', borderColor: '#4caf50' },
  sheet: { background: 'rgba(77, 208, 225, 0.8)', borderColor: '#00bcd4' },
  comment: { background: 'rgba(245, 245, 245, 0.95)', borderColor: '#bdbdbd' },
};

const icons: Record<string, any> = {
  constant: CaseLower,
  function: Sigma,
  input: LogIn,
  output: LogOut,
  sheet: Import,
  comment: MessageSquare,
};

export function CustomNode(props: any) {
  const { data } = props;
  const type = data.type;
  const typeClass = `node-${type}`;
  const ref = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(data.label);
  const lastClickRef = useRef(0);

  useEffect(() => {
    setTempLabel(data.label);
  }, [data.label]);

  const commitEdit = () => {
    setIsEditing(false);
    if (tempLabel !== data.label) {
      window.dispatchEvent(
        new CustomEvent('parascope-node-update', {
          detail: { id: data.id, label: tempLabel },
        }),
      );
    }
  };

  useEffect(() => {
    const wrapper = ref.current;
    if (wrapper && !isEditing) {
      const handlePointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        // Check if the click is on the title element or its children
        if (target.closest('.title')) {
          const now = Date.now();
          if (now - lastClickRef.current < 300) {
            // Double click detected on title
            e.stopPropagation(); // Stop bubbling to Rete (shuts down drag/global handlers)
            setIsEditing(true);
          }
          lastClickRef.current = now;
        }
      };

      // We attach to the wrapper DIV. Since 'pointerdown' bubbles from Title -> Wrapper -> Container,
      // catching it here allows us to stop it before Rete's AreaPlugin (on Container) sees it.
      wrapper.addEventListener('pointerdown', handlePointerDown);
      return () => {
        wrapper.removeEventListener('pointerdown', handlePointerDown);
      };
    }
  }, [isEditing]);

  // Apply styles on every render to ensure they persist over Rete's updates
  useEffect(() => {
    if (ref.current) {
      // When not using display: contents, the wrapper is ref.current.
      // The actual node element is the first child.
      const nodeEl = ref.current.firstElementChild as HTMLElement;
      if (nodeEl) {
        nodeEl.classList.remove(
          ...Object.keys(styles).map((key) => {
            return `node-${key}`;
          }),
        );
        nodeEl.classList.add(typeClass);

        if (data.selected) {
          nodeEl.classList.add('node-selected');
        } else {
          nodeEl.classList.remove('node-selected');
        }

        if (data.error) {
          nodeEl.classList.add('node-error');
        } else {
          nodeEl.classList.remove('node-error');
        }

        const bg = styles[type]?.background;
        const bc = styles[type]?.borderColor;

        if (bg) nodeEl.style.setProperty('background', bg, 'important');
        if (bc) nodeEl.style.setProperty('border-color', bc, 'important');

        // Force auto size
        nodeEl.style.setProperty('width', 'auto', 'important');
        nodeEl.style.setProperty('height', 'auto', 'important');

        // Find title element and add padding for the icon
        const title = nodeEl.querySelector('.title') as HTMLElement;
        if (title) {
          title.style.paddingRight = '30px'; // Make space for the icon
        }
      }
    }
  });

  // Setup ResizeObserver to update node dimensions in Rete's data model
  useEffect(() => {
    if (ref.current) {
      const nodeEl = ref.current.firstElementChild as HTMLElement;
      if (nodeEl) {
        const updateDimensions = () => {
          if (nodeEl.offsetWidth > 0 && nodeEl.offsetHeight > 0) {
            data.width = nodeEl.offsetWidth;
            data.height = nodeEl.offsetHeight;
          }
        };

        // Initial update
        updateDimensions();

        // Observe changes
        const observer = new ResizeObserver(updateDimensions);
        observer.observe(nodeEl);

        return () => observer.disconnect();
      }
    }
  }, [data]); // Only re-run if the node instance changes

  const Icon = icons[type];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Presets.classic.Node {...props} />
      {Icon && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            pointerEvents: 'none',
            color: type === 'comment' ? '#424242' : 'white',
            zIndex: 1,
          }}
        >
          <Icon size={16} />
        </div>
      )}
      {isEditing && (
        <input
          value={tempLabel}
          onChange={(e) => setTempLabel(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') {
              setTempLabel(data.label);
              setIsEditing(false); // Stop prop?
            }
            e.stopPropagation(); // Prevent Rete shortcuts while typing
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="node-title-input"
        />
      )}
    </div>
  );
}
