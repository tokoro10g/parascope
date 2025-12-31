import { Play } from 'lucide-react';
import type React from 'react';

export interface EvaluatorInput {
  id: string;
  label: string;
  value: string | number;
}

export interface EvaluatorOutput {
  id: string;
  label: string;
  value?: any;
}

interface EvaluatorBarProps {
  sheetName?: string;
  inputs: EvaluatorInput[];
  outputs: EvaluatorOutput[];
  onInputChange: (id: string, value: string) => void;
  onCalculate: () => void;
  isCalculating: boolean;
  errorNodeId?: string | null;
}

export const EvaluatorBar: React.FC<EvaluatorBarProps> = ({
  sheetName,
  inputs,
  outputs,
  onInputChange,
  onCalculate,
  isCalculating,
  errorNodeId,
}) => {
  const numberFormat = new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: 6,
    useGrouping: false,
  });
  return (
    <div className="toolbar evaluator-bar">
      <div className="signature">
        <span className="sheet-name">{sheetName || 'Sheet'}</span>
        <span className="paren">(</span>
        {inputs.map((input, i) => (
          <span key={input.id} className="input-param">
            <label htmlFor={input.id}>{input.label}=</label>
            <input
              id={input.id}
              type="text"
              value={input.value}
              onChange={(e) => onInputChange(input.id, e.target.value)}
              placeholder="val"
              className={input.id === errorNodeId ? 'input-error' : ''}
              style={{ width: '60px', marginLeft: '4px' }}
            />
            {i < inputs.length - 1 && <span className="comma">, </span>}
          </span>
        ))}
        <span className="paren">)</span>
        <span className="arrow"> =&gt; </span>
        <span className="paren">[</span>
        {outputs.map((output, i) => {
          let displayValue = '?';
          if (output.value !== undefined && !isCalculating) {
            let value = output.value;
            const valueAsNumber = Number.parseFloat(value);
            if (!Number.isNaN(valueAsNumber)) {
              value = numberFormat.format(valueAsNumber);
            }
            displayValue = value;
          }
          return (
            <span key={output.id} className="output-param">
              <span className="label">{output.label}:</span>
              <span
                key={output.value}
                className={`value ${displayValue === '?' || 'value-blink'}`}
              >
                {displayValue}
              </span>
              {i < outputs.length - 1 && <span className="comma">, </span>}
            </span>
          );
        })}
        <span className="paren">]</span>
      </div>
      <button
        type="button"
        onClick={onCalculate}
        disabled={isCalculating}
        className="calculate-btn"
        style={{ marginLeft: 'auto' }}
        title="Run Calculation"
      >
        {isCalculating ? '...' : <Play size={18} fill="currentColor" />}
      </button>
    </div>
  );
};
