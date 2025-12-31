import { CaseLower, Import, LogIn, LogOut, Sigma } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Presets } from 'rete-react-plugin';
import './custom-node.css';

const styles: Record<string, { background: string; borderColor: string }> = {
  parameter: { background: 'rgba(110, 218, 110, 0.8)', borderColor: '#4caf50' },
  function: { background: 'rgba(100, 181, 246, 0.8)', borderColor: '#2196f3' },
  input: { background: 'rgba(255, 183, 77, 0.8)', borderColor: '#ff9800' },
  output: { background: 'rgba(186, 104, 200, 0.8)', borderColor: '#9c27b0' },
  sheet: { background: 'rgba(77, 208, 225, 0.8)', borderColor: '#00bcd4' },
};

const icons: Record<string, any> = {
  parameter: CaseLower,
  function: Sigma,
  input: LogIn,
  output: LogOut,
  sheet: Import,
};

export function CustomNode(props: any) {
  const { data } = props;
  const type = data.type;
  const typeClass = `node-${type}`;
  const ref = useRef<HTMLDivElement>(null);

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
            color: 'white',
            zIndex: 1,
          }}
        >
          <Icon size={16} />
        </div>
      )}
    </div>
  );
}
