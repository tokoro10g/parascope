import type React from 'react';

interface AIGeneratorProps {
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
  aiEnabled: boolean;
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({
  aiPrompt,
  setAiPrompt,
  isGenerating,
  handleGenerate,
  aiEnabled,
}) => {
  if (!aiEnabled) return null;

  return (
    <div
      className="form-group"
      style={{
        border: '1px solid var(--border-color)',
        padding: '10px',
        borderRadius: '4px',
        background: 'var(--panel-bg-secondary)',
        marginBottom: '15px',
      }}
    >
      <label
        htmlFor="ai-prompt"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Generate with Gemini AI</span>
        {isGenerating && (
          <span style={{ fontSize: '0.8em', color: '#9c27b0' }}>
            Generating...
          </span>
        )}
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id="ai-prompt"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="e.g. Calculate the hypotenuse of a right angle triangle"
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isGenerating) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !aiPrompt.trim()}
          style={{ whiteSpace: 'nowrap' }}
        >
          Generate
        </button>
      </div>
    </div>
  );
};
