import CodeEditor from '@uiw/react-textarea-code-editor';
import type React from 'react';
import { PortsEditor } from './PortsEditor';

interface FunctionEditorProps {
  data: Record<string, any>;
  setData: (data: Record<string, any>) => void;
  inputs: { key: string; socket_type: string }[];
  setInputs: (inputs: { key: string; socket_type: string }[]) => void;
  outputs: { key: string; socket_type: string }[];
  setOutputs: (outputs: { key: string; socket_type: string }[]) => void;
  isGenerating: boolean;
}

export const FunctionEditor: React.FC<FunctionEditorProps> = ({
  data,
  setData,
  inputs,
  setInputs,
  outputs,
  setOutputs,
  isGenerating,
}) => {
  return (
    <>
      <div className="form-group">
        <label htmlFor="node-code">Python Code:</label>
        <div style={{ overflow: 'auto' }}>
          <CodeEditor
            id="node-code"
            value={data.code || ''}
            language="py"
            placeholder="result = x + 1"
            onChange={(e: any) => setData({ ...data, code: e.target.value })}
            readOnly={isGenerating}
            padding={15}
            rows={30}
            indentWidth={4}
            style={{ minWidth: 'max-content', fontFamily: 'monospace' }}
          />
        </div>
        <small>
          Use input names as variables. Assign result to output names.
        </small>
      </div>

      <div className="io-section">
        <PortsEditor
          title="Inputs"
          items={inputs}
          setItems={setInputs}
          isDisabled={isGenerating}
          addButtonLabel="Add Input"
          defaultNamePrefix="input"
        />
        <PortsEditor
          title="Outputs"
          items={outputs}
          setItems={setOutputs}
          isDisabled={isGenerating}
          addButtonLabel="Add Output"
          defaultNamePrefix="output"
        />
      </div>
    </>
  );
};
