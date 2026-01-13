import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type React from 'react';

interface PortItem {
  key: string;
  socket_type: string;
}

interface PortsEditorProps {
  title: string;
  items: PortItem[];
  setItems: (items: PortItem[]) => void;
  isDisabled: boolean;
  addButtonLabel: string;
  defaultNamePrefix: string;
}

export const PortsEditor: React.FC<PortsEditorProps> = ({
  title,
  items,
  setItems,
  isDisabled,
  addButtonLabel,
  defaultNamePrefix,
}) => {
  const isValidPythonIdentifier = (name: string) => {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  const handleChangeName = (index: number, newName: string) => {
    const newItems = [...items];
    newItems[index].key = newName;
    setItems(newItems);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newItems = [...items];
      [newItems[index], newItems[index - 1]] = [
        newItems[index - 1],
        newItems[index],
      ];
      setItems(newItems);
    } else if (direction === 'down' && index < items.length - 1) {
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [
        newItems[index + 1],
        newItems[index],
      ];
      setItems(newItems);
    }
  };

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleAdd = () => {
    let name = defaultNamePrefix;
    let counter = 1;
    while (items.some((i) => i.key === name)) {
      name = `${defaultNamePrefix}_${counter}`;
      counter++;
    }
    setItems([...items, { key: name, socket_type: 'any' }]);
  };

  return (
    <div className="io-column">
      <h3>{title}</h3>
      <ul style={{ padding: 0 }}>
        {items.map((item, idx) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: Order matters here
            key={idx}
            style={{
              display: 'flex',
              gap: '5px',
              marginBottom: '5px',
              alignItems: 'center',
            }}
          >
            <input
              value={item.key}
              onChange={(e) => handleChangeName(idx, e.target.value)}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                borderColor: isValidPythonIdentifier(item.key)
                  ? undefined
                  : 'red',
              }}
              title={
                isValidPythonIdentifier(item.key)
                  ? ''
                  : 'Invalid Python identifier'
              }
              disabled={isDisabled}
            />
            <button
              type="button"
              onClick={() => handleMove(idx, 'up')}
              disabled={isDisabled || idx === 0}
              style={{ padding: '2px' }}
            >
              <ArrowUp size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleMove(idx, 'down')}
              disabled={isDisabled || idx === items.length - 1}
              style={{ padding: '2px' }}
            >
              <ArrowDown size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="danger"
              style={{ padding: '2px' }}
              disabled={isDisabled}
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={handleAdd} disabled={isDisabled}>
        + {addButtonLabel}
      </button>
    </div>
  );
};
