import type { ClassicPreset } from 'rete';
import './CustomSocket.css';

const formatValue = (value: any): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-3 && value !== 0)) {
      return value.toExponential(4);
    }
    return parseFloat(value.toFixed(4)).toString();
  }
  const str = String(value);
  return str.length > 10 ? str.substring(0, 10) + '...' : str;
};

export function CustomSocket(props: { data: ClassicPreset.Socket }) {
  const { name } = props.data;
  const value = (props.data as any).value;
  const isOutput = (props.data as any).isOutput;

  return (
    <div
      className="custom-socket-wrapper"
      style={{
        position: 'relative',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      <div className={`custom-socket custom-socket-${name}`} title={name} />
      {value !== undefined && (
        <div
          className="socket-value"
          style={{
            position: 'absolute',
            ...(isOutput
              ? { left: '100%', marginLeft: '8px' }
              : { right: '100%', marginRight: '8px' }),
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'var(--text-color)',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {formatValue(value)}
        </div>
      )}
    </div>
  );
}
