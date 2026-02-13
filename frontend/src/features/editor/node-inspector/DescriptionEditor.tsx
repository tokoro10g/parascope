import CodeEditor from '@uiw/react-textarea-code-editor';
import { ExternalLink, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { API_BASE, api } from '../../../core/api';
import './DescriptionEditor.css';

interface DescriptionEditorProps {
  data: Record<string, any>;
  setData: (
    data:
      | Record<string, any>
      | ((prev: Record<string, any>) => Record<string, any>),
  ) => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  isGenerating: boolean;
  transformUrl: (url: string) => string;
  getAttachmentUrl: (filename: string) => string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleInsertToDescription: (filename: string) => void;
  handleRemoveAttachment: (filename: string) => void;
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
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault(); // Stop default paste if it's an image
          try {
            const result = await api.uploadAttachment(file);
            const url = getAttachmentUrl(result.filename);
            const markdownImage = `![Attachment](${url})`;

            setData((prev) => {
              const currentDesc = prev.description || '';
              return {
                ...prev,
                attachments: [...(prev.attachments || []), result.filename],
                description: currentDesc
                  ? `${currentDesc}\n${markdownImage}`
                  : markdownImage,
              };
            });
          } catch (error) {
            console.error('Paste upload failed:', error);
          }
        }
      }
    }
  };

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
              placeholder="Enter description here... (Tip: Paste images directly here)"
              onChange={(e: any) =>
                setData({ ...data, description: e.target.value })
              }
              onPaste={handlePaste}
              readOnly={isGenerating}
              padding={15}
              indentWidth={2}
              style={{ minWidth: 'max-content', fontFamily: 'monospace' }}
            />
          </div>
        )}
      </div>

      {data.attachments && data.attachments.length > 0 && (
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
              Attachments ({data.attachments.length})
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            {data.attachments.map((filename: string) => (
              <div
                key={filename}
                className="attachment-container"
                style={{
                  position: 'relative',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  background: '#000',
                  display: 'flex',
                  flexDirection: 'column',
                  aspectRatio: '1/1',
                }}
              >
                <img
                  src={API_BASE + getAttachmentUrl(filename)}
                  alt="Attachment"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div
                  className="attachment-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleInsertToDescription(filename)}
                    className="btn"
                    title="Insert into Description"
                    style={{
                      minWidth: 'unset',
                      padding: '6px',
                      background: 'var(--primary-color)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(filename)}
                    className="btn danger"
                    title="Remove Attachment"
                    style={{
                      minWidth: 'unset',
                      padding: '6px',
                      border: 'none',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  <a
                    href={API_BASE + getAttachmentUrl(filename)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '6px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Open Original"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
