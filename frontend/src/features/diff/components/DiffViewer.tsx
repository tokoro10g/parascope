import type React from 'react';
import { computeLineDiff, formatValue } from '../utils/diff';
import '../styles/diff.css';

interface LineDiffProps {
  oldStr: string;
  newStr: string;
}

export const LineDiff: React.FC<LineDiffProps> = ({ oldStr, newStr }) => {
  const result = computeLineDiff(oldStr, newStr);

  return (
    <div className="diff-line-view">
      {result.map((line, idx) => (
        <div
          key={`${line.type}-${line.text}-${idx}`}
          className={`diff-line ${line.type}`}
        >
          <span className="diff-line-marker">
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
          </span>
          <span className="diff-line-text">{line.text || ' '}</span>
        </div>
      ))}
    </div>
  );
};

interface DiffValueProps {
  oldVal: any;
  newVal: any;
}

export const DiffValue: React.FC<DiffValueProps> = ({ oldVal, newVal }) => {
  if (oldVal === null && newVal === 'created') {
    return <span className="diff-new">★ Node Created</span>;
  }

  if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
    return <span>{formatValue(oldVal)}</span>;
  }

  // Handle line-by-line diff for multi-line strings
  if (
    typeof oldVal === 'string' &&
    typeof newVal === 'string' &&
    (oldVal.includes('\n') || newVal.includes('\n'))
  ) {
    return (
      <details className="diff-spoiler" open={false}>
        <summary className="diff-spoiler-summary">View changes</summary>
        <LineDiff oldStr={oldVal} newStr={newVal} />
      </details>
    );
  }

  // Handle Arrays
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const removed = oldVal.filter(
      (x) => !newVal.some((y) => JSON.stringify(x) === JSON.stringify(y)),
    );
    const added = newVal.filter(
      (x) => !oldVal.some((y) => JSON.stringify(x) === JSON.stringify(y)),
    );

    if (removed.length > 0 || added.length > 0) {
      return (
        <details className="diff-spoiler" open={false}>
          <summary className="diff-spoiler-summary">
            View array changes ({removed.length} removed, {added.length} added)
          </summary>
          <div className="diff-object">
            {removed.map((item, i) => (
              <div
                key={`rem-${JSON.stringify(item)}-${i}`}
                className="diff-object-row"
              >
                <span className="diff-key removed">-</span>
                <span className="diff-old">{formatValue(item)}</span>
              </div>
            ))}
            {added.map((item, i) => (
              <div
                key={`add-${JSON.stringify(item)}-${i}`}
                className="diff-object-row"
              >
                <span className="diff-key added">+</span>
                <span className="diff-new">{formatValue(item)}</span>
              </div>
            ))}
          </div>
        </details>
      );
    }
  }

  // If both are objects (and not null), show structural diff
  if (
    oldVal !== null &&
    newVal !== null &&
    typeof oldVal === 'object' &&
    typeof newVal === 'object' &&
    !Array.isArray(oldVal) &&
    !Array.isArray(newVal)
  ) {
    const allKeys = Array.from(
      new Set([...Object.keys(oldVal), ...Object.keys(newVal)]),
    );
    const changedKeys = allKeys.filter(
      (k) => JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k]),
    );

    return (
      <details className="diff-spoiler" open={false}>
        <summary className="diff-spoiler-summary">
          View structural changes ({changedKeys.length} fields)
        </summary>
        <div className="diff-object">
          {changedKeys.map((k) => {
            const isRemoved = !(k in newVal);
            const isAdded = !(k in oldVal);

            return (
              <div key={k} className="diff-object-row">
                <span
                  className={`diff-key ${isRemoved ? 'removed' : isAdded ? 'added' : ''}`}
                >
                  {k}:
                </span>
                {isRemoved ? (
                  <span className="diff-old">{formatValue(oldVal[k])}</span>
                ) : isAdded ? (
                  <span className="diff-new">{formatValue(newVal[k])}</span>
                ) : (
                  <DiffValue oldVal={oldVal[k]} newVal={newVal[k]} />
                )}
              </div>
            );
          })}
        </div>
      </details>
    );
  }

  const isCode =
    typeof oldVal === 'string' &&
    typeof newVal === 'string' &&
    (oldVal.includes('\n') || newVal.includes('\n'));

  return (
    <div className={`diff-delta ${isCode ? 'diff-code' : ''}`}>
      <span className="diff-old">{formatValue(oldVal)}</span>
      <span className="diff-arrow"> → </span>
      <span className="diff-new">{formatValue(newVal)}</span>
    </div>
  );
};
