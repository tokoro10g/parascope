import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ClassicPreset } from 'rete';

export class InputControl extends ClassicPreset.Control {
  private listeners: (() => void)[] = [];
  public value: string | number;
  public onChange?: (value: any) => void;
  public readonly: boolean;
  public min?: number;
  public max?: number;

  constructor(
    value: string | number,
    options: {
      readonly?: boolean;
      change?: (value: any) => void;
      min?: number;
      max?: number;
    } = {},
  ) {
    super();
    this.value = value;
    this.onChange = options.change;
    this.readonly = options.readonly || false;
    this.min = options.min;
    this.max = options.max;
  }


  setValue(val: string | number) {
    this.value = val;
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
  const [isValid, setIsValid] = useState(true);

  const validate = useCallback(
    (val: string | number) => {
      if (val === '' || val === undefined || val === null) {
        setIsValid(true);
        return;
      }
      const num = Number(val);
      if (
        (data.min !== undefined || data.max !== undefined) &&
        Number.isNaN(num)
      ) {
        setIsValid(false);
        return;
      }

      let valid = true;
      if (data.min !== undefined && num < data.min) valid = false;
      if (data.max !== undefined && num > data.max) valid = false;
      setIsValid(valid);
    },
    [data.min, data.max],
  );

  useEffect(() => {
    setValue(data.value);
    validate(data.value);
    return data.subscribe(() => {
      setValue(data.value);
      validate(data.value);
    });
  }, [data, validate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    validate(val);

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
        color: isValid ? undefined : 'red',
        borderColor: isValid ? undefined : 'red',
      }}
      title={
        !isValid
          ? `Value must be between ${data.min ?? '-Inf'} and ${data.max ?? '+Inf'}`
          : ''
      }
    />
  );
};
