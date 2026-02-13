import type { ClassicPreset } from 'rete';
import { formatHumanReadableValue } from '../../utils';
import './CustomSocket.css';

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
      {value !== undefined && value !== null && (
        <div
          className="socket-value"
          style={{
            ...(isOutput
              ? { left: '100%', marginLeft: '8px' }
              : { right: '100%', marginRight: '8px' }),
          }}
        >
          {formatHumanReadableValue(String(value))}
        </div>
      )}
    </div>
  );
}
