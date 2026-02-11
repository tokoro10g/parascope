import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ClassicPreset } from 'rete';

export class InputControl extends ClassicPreset.Control {
  private listeners: (() => void)[] = [];
  public value: string | number;
  public onChange?: (value: any) => void;
  public onCommit?: (oldValue: any, newValue: any) => void;
  public readonly: boolean;
  public error: string | null = null;

  constructor(
    value: string | number,
    options: {
      readonly?: boolean;
      change?: (value: any) => void;
      commit?: (oldValue: any, newValue: any) => void;
    } = {},
  ) {
    super();
    this.value = value;
    this.onChange = options.change;
    this.onCommit = options.commit;
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
  const [value, setValue] = useState(data.value ?? '');
  const [error, setError] = useState<string | null>(data.error);
  const initialValue = useRef(data.value ?? '');

  useEffect(() => {
    setValue(data.value ?? '');
    setError(data.error);
    return data.subscribe(() => {
      setValue(data.value ?? '');
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

  const handleFocus = () => {
    initialValue.current = data.value ?? '';
  };

  const handleBlur = () => {
    const currentVal = data.value ?? '';
    const startVal = initialValue.current ?? '';
    if (startVal !== currentVal) {
      data.onCommit?.(startVal, currentVal);
      initialValue.current = currentVal;
    }
  };

  return (
    <input
      value={value ?? ''}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlur();
          (e.currentTarget as HTMLInputElement).blur();
        }
        e.stopPropagation();
      }}
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
      className={data.readonly ? 'control-input-readonly' : 'control-input'}
    />
  );
};
