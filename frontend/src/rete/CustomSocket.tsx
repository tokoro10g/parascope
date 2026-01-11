import { ClassicPreset } from 'rete';
import './CustomSocket.css';

export function CustomSocket(props: { data: ClassicPreset.Socket }) {
  const { name } = props.data;
  
  return (
    <div
      className={`custom-socket custom-socket-${name}`}
      title={name}
    />
  );
}
