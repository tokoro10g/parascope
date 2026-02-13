import { ClassicPreset as Classic } from 'rete';
import { DropdownControl } from './components/DropdownControl';
import { InputControl } from './components/InputControl';
import { MarkdownControl } from './components/MarkdownControl';
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
  public calculatedValues: Record<string, any> = {};
  public notifyGraphChange?: () => void;
  public onInputValueChange?: (value: string) => void;
  public onCommit?: (oldValue: any, newValue: any) => void;
  public error?: string;

  constructor(
    type: NodeType,
    label: string,
    inputs: { key: string; socket_type?: string }[],
    outputs: { key: string; socket_type?: string }[],
    data: Record<string, any> = {},
  ) {
    super(label);
    this.type = type;
    this.data = data;

    inputs.forEach((inp) => {
      const s = new Classic.Socket('socket');
      (s as any).portKey = inp.key;
      (s as any).isOutput = false;
      this.addInput(inp.key, new Classic.Input(s, inp.key));
    });

    outputs.forEach((out) => {
      const s = new Classic.Socket('socket');
      (s as any).portKey = out.key;
      (s as any).isOutput = true;
      const output = new Classic.Output(s, out.key);
      if (this.type === 'sheet') {
        const sheetSocket = new Classic.Socket(
          out.socket_type === 'constant' ? 'socket-constant' : 'socket-output',
        );
        (sheetSocket as any).portKey = out.key;
        (sheetSocket as any).isOutput = true;
        output.socket = sheetSocket;
      }

      this.addOutput(out.key, output);
    });

    this.setupControl();
  }

  setupControl() {
    const data = this.data;
    const onCommit = this.onCommit;

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
          String(data.value ?? ''),
          (val: string) => {
            const oldVal = data.value;
            data.value = val;
            onCommit?.(oldVal, val);
          },
          false,
          this.type === 'input',
        ),
      );
      return;
    }

    if (this.type === 'output' && isOption) {
      this.addControl(
        'value',
        new InputControl(data.value ?? '', {
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
          isExample: this.type === 'input',
          commit: onCommit,
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
