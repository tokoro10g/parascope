import type React from 'react';

interface AIGeneratorProps {
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  aiUrls: string;
  setAiUrls: (urls: string) => void;
  aiImage: string | null;
  setAiImage: (image: string | null) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
  aiEnabled: boolean;
  hasExistingContent: boolean;
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({
  aiPrompt,
  setAiPrompt,
  aiUrls,
  setAiUrls,
  aiImage,
  setAiImage,
  isGenerating,
  handleGenerate,
  aiEnabled,
  hasExistingContent,
}) => {
  if (!aiEnabled) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAiImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
          marginBottom: '5px',
        }}
      >
        <span style={{ fontWeight: 500 }}>Generate with Gemini AI</span>
        {isGenerating && (
          <span style={{ fontSize: '0.8em', color: '#9c27b0' }}>
            Generating...
          </span>
        )}
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          id="ai-prompt"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder={
            hasExistingContent
              ? 'e.g. Add the triangle area to the output. Write the description based on the code.'
              : 'e.g. Calculate the hypotenuse of a right angle triangle'
          }
          style={{ width: '100%' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isGenerating) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />

        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={aiUrls}
            onChange={(e) => setAiUrls(e.target.value)}
            placeholder="Reference URLs (one per line)..."
            rows={2}
            style={{
              flex: 1,
              fontSize: '0.85em',
              resize: 'vertical',
              minHeight: '38px',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxWidth: '120px',
            }}
          >
            <label
              className="button"
              style={{
                fontSize: '0.8em',
                padding: '4px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--button-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {aiImage ? 'Change Img' : 'Upload Img'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
            {aiImage && (
              <button
                type="button"
                onClick={() => setAiImage(null)}
                className="btn"
                style={{
                  fontSize: '0.8em',
                  padding: '2px',
                  color: 'var(--danger-color)',
                  border: 'none',
                  background: 'transparent',
                  minWidth: 'unset',
                }}
              >
                Clear Image
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !aiPrompt.trim()}
          className="btn primary"
          style={{ width: '100%', marginTop: '4px', minWidth: 'unset' }}
        >
          {hasExistingContent ? 'Edit with AI' : 'Generate'}
        </button>
      </div>
    </div>
  );
};
