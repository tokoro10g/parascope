import type React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { ClassicPreset } from 'rete';
import { API_BASE } from '../api';

export class MarkdownControl extends ClassicPreset.Control {
  public content: string;

  constructor(content: string) {
    super();
    this.content = content;
  }

  setContent(content: string) {
    this.content = content;
  }
}

const transformUrl = (url: string) => {
  if (url.startsWith('/attachments/')) {
    return `${API_BASE}${url}`;
  }
  return url;
};

export const MarkdownControlComponent: React.FC<{ data: MarkdownControl }> = ({
  data,
}) => {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this is for Rete event management
    <div
      className="node-markdown-content"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      role="presentation"
      style={{
        padding: '10px',
        color: '#424242',
        fontSize: '0.9em',
        background: 'rgba(255, 255, 255, 0.3)',
        borderRadius: '4px',
        marginTop: '5px',
        maxHeight: '300px',
        overflowY: 'auto',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={transformUrl}
      >
        {data.content || '*Empty comment*'}
      </ReactMarkdown>
    </div>
  );
};
