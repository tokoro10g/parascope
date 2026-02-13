import type React from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { ClassicPreset } from 'rete';
import { API_BASE } from '@/core/api';

export class MarkdownControl extends ClassicPreset.Control {
  private listeners: (() => void)[] = [];
  public content: string;

  constructor(content: string) {
    super();
    this.content = content || '';
  }

  setContent(content: string) {
    this.content = content;
    this.listeners.forEach((l) => {
      l();
    });
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

const transformUrl = (url: string) => {
  if (
    url.startsWith('/attachments/') ||
    url.startsWith('/api/v1/attachments/')
  ) {
    const normalizedUrl = url.startsWith('/attachments/')
      ? `/api/v1${url}`
      : url;
    return `${API_BASE}${normalizedUrl}`;
  }
  return url;
};

export const MarkdownControlComponent: React.FC<{ data: MarkdownControl }> = ({
  data,
}) => {
  const [content, setContent] = useState(data.content);

  useEffect(() => {
    setContent(data.content);
    return data.subscribe(() => {
      setContent(data.content);
    });
  }, [data]);

  return (
    <div
      className="markdown-control overflow-anywhere markdown-preview"
      role="presentation"
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={transformUrl}
      >
        {content || '*Empty comment*'}
      </ReactMarkdown>
    </div>
  );
};
