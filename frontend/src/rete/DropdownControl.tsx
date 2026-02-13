import type React from 'react';
import { useEffect, useState } from 'react';
import { ClassicPreset } from 'rete';

export class DropdownControl extends ClassicPreset.Control {
  private listeners: (() => void)[] = [];
  public options: string[];
  public value: string;
  public onChange: (value: string) => void;
  public readonly: boolean;
  public isExample: boolean;

  constructor(
    options: string[],
    value: string,
    onChange: (value: string) => void,
    readonly: boolean = false,
    isExample: boolean = false,
  ) {
    super();
    this.options = options;
    this.value = value;
    this.onChange = onChange;
    this.readonly = readonly;
    this.isExample = isExample;
  }

  setValue(val: string) {
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

export const DropdownControlComponent: React.FC<{ data: DropdownControl }> = ({
  data,
}) => {
  const [value, setValue] = useState(data.value);

  useEffect(() => {
    setValue(data.value);
    return data.subscribe(() => setValue(data.value));
  }, [data]);

  return (
    <select
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        data.setValue(val);
        data.onChange(val);
      }}
      disabled={data.readonly}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ fontFamily: 'monospace' }}
    >
      <option key="" value=""></option>
      {data.options.map((opt) => (
        <option key={opt} value={opt}>
          {data.isExample ? `( ${opt} )` : opt}
        </option>
      ))}
    </select>
  );
};
