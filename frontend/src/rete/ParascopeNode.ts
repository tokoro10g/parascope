import { ClassicPreset as Classic } from 'rete';
import { DropdownControl } from './DropdownControl';
import { InputControl } from './InputControl';
import { MarkdownControl } from './MarkdownControl';
import type { NodeType } from './types';

export const socket = new Classic.Socket('socket');

export class ParascopeNode extends Classic.Node {
  width = 180;
  height = 150;
  public dbId?: string; // ID from the database
  public type: NodeType;
  public x = 0;
  public y = 0;
  public data: Record<string, any>;
  public onChange?: (value: any) => void;
  public error?: string;

  constructor(
    type: NodeType,
    label: string,
    inputs: { key: string; socket_type: string }[],
    outputs: { key: string; socket_type: string }[],
    data: Record<string, any> = {},
    onChange?: (value: any) => void,
  ) {
    super(label);
    this.type = type;
    this.data = data;
    this.onChange = onChange;

    inputs.forEach((inp) => {
      this.addInput(inp.key, new Classic.Input(socket, inp.key));
    });

    outputs.forEach((out) => {
      const s = new Classic.Socket('socket');
      const output = new Classic.Output(s, out.key);
      if (type === 'sheet') {
        output.socket = new Classic.Socket(
          out.socket_type === 'constant' ? 'socket-constant' : 'socket-output',
        );
      }

      this.addOutput(out.key, output);
    });

    this.setupControl();
  }

  setupControl() {
    const data = this.data;
    const onChange = this.onChange;

    if (this.controls.value) {
      this.removeControl('value');
    }
    if (this.controls.description) {
      this.removeControl('description');
    }

    if (this.type === 'lut') {
      return;
    }

    if (this.type === 'comment') {
      this.addControl(
        'description',
        new MarkdownControl(this.data.description || ''),
      );
      return;
    }

    // Function and Sheet nodes don't need standard value controls
    if (this.type === 'function' || this.type === 'sheet') {
      return;
    }

    const isOption = data.dataType === 'option';
    const isInputOrParam = this.type === 'input' || this.type === 'constant';

    if (isInputOrParam && isOption && data.options) {
      this.addControl(
        'value',
        new DropdownControl(
          data.options,
          String(data.value ?? data.options[0] ?? ''),
          (val) => onChange?.(val),
        ),
      );
      return;
    }

    if (this.type === 'output' && isOption) {
      this.addControl(
        'value',
        new InputControl(data.value, {
          readonly: true,
        }),
      );
      return;
    }

    const value = data.value ?? '';

    if (isInputOrParam) {
      this.addControl(
        'value',
        new InputControl(value, {
          readonly: false,
          change: onChange,
        }),
      );
    } else if (this.type === 'output') {
      this.addControl(
        'value',
        new InputControl(value, {
          readonly: true,
        }),
      );
    }
  }
}
