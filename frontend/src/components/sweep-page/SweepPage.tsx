import { useEffect, useRef, useState } from 'react';
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
} from 'react-resizable-panels';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

import { NavBar } from '../NavBar';
import './SweepPage.css';
import { SweepResults } from './SweepResults';
import { SweepSidebar } from './SweepSidebar';
import { useSweepState } from './useSweepState';

export const SweepPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');
  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const resultsPanelRef = useRef<PanelImperativeHandle>(null);

  const {
    sheet,
    sheetId,
    nodes,
    inputOptions,
    outputOptions,
    // Consolidated State
    primaryInput,
    updatePrimary,
    secondaryInput,
    updateSecondary,
    // Common
    inputOverrides,
    setInputOverrides,
    outputNodeIds,
    toggleOutput,
    loading,
    error,
    handleRun,
    results,
    metadata,
    headers,
    handleSweepInputChange,
  } = useSweepState();

  // Programmatically resize panels on mobile to ensure full-width tabs
  useEffect(() => {
    const resizePanels = () => {
      if (isMobile) {
        if (activeTab === 'config') {
          sidebarPanelRef.current?.resize('100%');
          resultsPanelRef.current?.resize('0%');
        } else {
          sidebarPanelRef.current?.resize('0%');
          resultsPanelRef.current?.resize('100%');
        }
      }
    };

    const timer = setTimeout(resizePanels, 0);
    return () => clearTimeout(timer);
  }, [isMobile, activeTab]);

  // State to track theme colors
  const [theme, setTheme] = useState({
    text: '#213547',
    grid: '#ccc',
    font: 'system-ui, sans-serif',
    background: '#fff',
  });

  // Update theme on mount and system change
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);

    const updateTheme = () => {
      const rootStyles = getComputedStyle(document.documentElement);
      const bodyStyles = getComputedStyle(document.body);

      const textColor = bodyStyles.getPropertyValue('--text-color').trim();
      const borderColor = bodyStyles.getPropertyValue('--border-color').trim();
      const fontFamily = rootStyles.getPropertyValue('font-family').trim();
      const backgroundColor = bodyStyles.getPropertyValue('--bg-color').trim();

      setTheme({
        text: textColor || '#213547',
        grid: borderColor || '#ccc',
        font: fontFamily || 'system-ui, Avenir, Helvetica, Arial, sans-serif',
        background: backgroundColor || '#fff',
      });
    };

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    // Slight delay to ensure CSS is applied
    const timer = setTimeout(updateTheme, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener('change', updateTheme);
      clearTimeout(timer);
    };
  }, []);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  const onRunAndSwitch = async () => {
    if (isMobile) setActiveTab('results');
    await handleRun();
  };

  return (
    <div className="sweep-page">
      <NavBar user={user} onBack={handleBack} onLogout={logout} />

      {isMobile && (
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-button ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Results
          </button>
        </div>
      )}

      <div className="sweep-content">
        <Group
          id="sweep-group"
          orientation={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%', height: '100%' }}
        >
          <Panel
            id="sidebar-panel"
            panelRef={sidebarPanelRef}
            defaultSize={
              isMobile ? (activeTab === 'config' ? '100%' : '0%') : '35%'
            }
            minSize={isMobile ? 0 : 450}
            maxSize={isMobile ? '100%' : '80%'}
            style={{
              display: isMobile && activeTab !== 'config' ? 'none' : 'flex',
              flexDirection: 'column',
            }}
          >
            <SweepSidebar
              inputOptions={inputOptions}
              outputOptions={outputOptions}
              primaryInput={primaryInput}
              updatePrimary={updatePrimary}
              secondaryInput={secondaryInput}
              updateSecondary={updateSecondary}
              onInputChange={handleSweepInputChange}
              inputOverrides={inputOverrides}
              setInputOverrides={setInputOverrides}
              outputNodeIds={outputNodeIds}
              toggleOutput={toggleOutput}
              loading={loading}
              error={error}
              onRun={onRunAndSwitch}
            />
          </Panel>
          <Separator
            style={
              isMobile
                ? { display: 'none' }
                : { width: '4px', background: '#ccc', cursor: 'col-resize' }
            }
          />
          <Panel
            id="results-panel"
            panelRef={resultsPanelRef}
            defaultSize={
              isMobile ? (activeTab === 'results' ? '100%' : '0%') : '65%'
            }
            minSize={isMobile ? 0 : 300}
            style={{
              display: isMobile && activeTab !== 'results' ? 'none' : 'flex',
              flexDirection: 'column',
            }}
          >
            <SweepResults
              sheetName={sheet?.name || 'Loading...'}
              sheetId={sheetId}
              versionId={searchParams.get('versionId') || undefined}
              results={results}
              metadata={metadata}
              headers={headers}
              nodes={nodes}
              inputNodeId={primaryInput.nodeId}
              theme={theme}
            />
          </Panel>
        </Group>
      </div>
    </div>
  );
};
