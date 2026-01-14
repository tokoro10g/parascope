import CodeEditor from '@uiw/react-textarea-code-editor';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE } from '../../api';

interface DescriptionEditorProps {
  data: Record<string, any>;
  setData: (data: Record<string, any>) => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  isGenerating: boolean;
  transformUrl: (url: string) => string;
  getAttachmentUrl: (filename: string) => string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleInsertToDescription: () => void;
  handleRemoveAttachment: () => void;
}

export const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  data,
  setData,
  showPreview,
  setShowPreview,
  isGenerating,
  transformUrl,
  getAttachmentUrl,
  handleFileUpload,
  handleInsertToDescription,
  handleRemoveAttachment,
}) => {
  return (
    <>
      <div className="form-group">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '5px',
          }}
        >
          <label htmlFor="node-description" style={{ marginBottom: 0 }}>
            Description (Markdown):
          </label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            disabled={isGenerating}
            style={{
              fontSize: '0.8em',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <div
            className="markdown-preview"
            style={{
              border: '1px solid var(--border-color)',
              padding: '10px',
              minHeight: '100px',
              borderRadius: '4px',
              background: 'var(--input-bg)',
              color: 'var(--text-color)',
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              urlTransform={transformUrl}
            >
              {data.description || '*No description*'}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <CodeEditor
              id="node-description"
              value={data.description || ''}
              language="md"
              placeholder="Enter description here..."
              onChange={(e: any) =>
                setData({ ...data, description: e.target.value })
              }
              readOnly={isGenerating}
              padding={15}
              indentWidth={2}
              style={{ minWidth: 'max-content', fontFamily: 'monospace' }}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <div
          style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
          }}
        >
          Attachment:
        </div>
        {data.attachment ? (
          <div className="attachment-preview" style={{ marginTop: '5px' }}>
            <img
              src={API_BASE + getAttachmentUrl(data.attachment)}
              alt="Attachment"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                display: 'block',
                marginBottom: '10px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={API_BASE + getAttachmentUrl(data.attachment)}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--link-color, #007bff)' }}
              >
                Open Original
              </a>
              <button
                type="button"
                onClick={handleInsertToDescription}
                disabled={isGenerating}
              >
                Insert into Description
              </button>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                disabled={isGenerating}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isGenerating}
          />
        )}
      </div>
    </>
  );
};
