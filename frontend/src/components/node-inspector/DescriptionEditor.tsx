import CodeEditor from '@uiw/react-textarea-code-editor';
import { ExternalLink, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
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
            marginBottom: '8px',
          }}
        >
          <label htmlFor="node-description" style={{ marginBottom: 0 }}>
            Description (Markdown):
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!data.attachment && (
              <label
                className="btn"
                style={{
                  fontSize: '0.8em',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  minWidth: 'unset',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: 0,
                }}
              >
                <ImageIcon size={14} /> Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={isGenerating}
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              disabled={isGenerating}
              className="btn"
              style={{
                fontSize: '0.8em',
                padding: '4px 8px',
                cursor: 'pointer',
                minWidth: 'unset',
              }}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>

        {showPreview ? (
          <div
            className="markdown-preview overflow-anywhere"
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

      {data.attachment && (
        <div
          className="form-group"
          style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--panel-bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.9em' }}>
              Current Attachment
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleInsertToDescription}
                disabled={isGenerating}
                className="btn"
                title="Insert into Description"
                style={{
                  minWidth: 'unset',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.85em',
                }}
              >
                <Plus size={14} /> Insert
              </button>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                disabled={isGenerating}
                className="btn danger"
                title="Remove Attachment"
                style={{
                  minWidth: 'unset',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.85em',
                }}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
          <div
            style={{
              position: 'relative',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              background: '#000',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <img
              src={API_BASE + getAttachmentUrl(data.attachment)}
              alt="Attachment"
              style={{
                maxWidth: '100%',
                maxHeight: '150px',
                display: 'block',
              }}
            />
            <a
              href={API_BASE + getAttachmentUrl(data.attachment)}
              target="_blank"
              rel="noreferrer"
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Open Original"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}
    </>
  );
};
