import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './ScrollablePanel.css';

interface ScrollButtonProps {
  onClick: () => void;
}

const ScrollButton: React.FC<ScrollButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="btn scroll-indicator-button"
    title="Scroll to bottom"
    style={{ minWidth: 'unset' }}
  >
    <ChevronDown size={20} />
  </button>
);

interface ScrollablePanelProps {
  children: React.ReactNode;
  className?: string;
  dependencies?: any[];
}

export const ScrollablePanel: React.FC<ScrollablePanelProps> = ({
  children,
  className,
  dependencies = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showIndicator, setShowIndicator] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const canScroll = el.scrollHeight > el.clientHeight;
      const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 5;
      setShowIndicator(canScroll && !isAtBottom);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: User provided dependencies
  useEffect(() => {
    checkScroll();
  }, [checkScroll, ...dependencies]);

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className={className}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {children}
      </div>
      {showIndicator && <ScrollButton onClick={scrollToBottom} />}
    </div>
  );
};
