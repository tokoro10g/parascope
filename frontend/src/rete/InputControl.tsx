import type React from 'react';
import { useEffect, useState } from 'react';
import { ClassicPreset } from 'rete';

export class InputControl extends ClassicPreset.Control {
  private listeners: (() => void)[] = [];
  public value: string | number;
  public onChange?: (value: any) => void;
  public readonly: boolean;
  public error: string | null = null;

  constructor(
    value: string | number,
    options: {
      readonly?: boolean;
      change?: (value: any) => void;
    } = {},
  ) {
    super();
    this.value = value;
    this.onChange = options.change;
    this.readonly = options.readonly || false;
  }

  setValue(val: string | number) {
    this.value = val;
    this.listeners.forEach((l) => {
      l();
    });
  }

  setError(err: string | null) {
    this.error = err;
    this.listeners.forEach((l) => {
      l();
    });
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const InputControlComponent: React.FC<{ data: InputControl }> = ({
  data,
}) => {
  const [value, setValue] = useState(data.value);
  const [error, setError] = useState<string | null>(data.error);

  useEffect(() => {
    setValue(data.value);
    setError(data.error);
    return data.subscribe(() => {
      setValue(data.value);
      setError(data.error);
    });
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);

    // Update data model
    data.setValue(val);
    if (data.onChange) {
      data.onChange(val);
    }
  };

  return (
    <input
      value={value}
      onChange={handleChange}
      readOnly={data.readonly}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        fontFamily: 'monospace',
        color: error ? 'red' : undefined,
        borderColor: error ? 'red' : undefined,
      }}
      title={error || ''}
      className={data.readonly ? 'node-input-readonly' : 'node-input'}
    />
  );
};
