import type React from 'react';
import { useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { NavBar } from '../NavBar';
import './SweepPage.css';
import { SweepResults } from './SweepResults';
import { SweepSidebar } from './SweepSidebar';
import { useSweepState } from './useSweepState';

export const SweepPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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

  // State to track theme colors
  const [theme, setTheme] = useState({
    text: '#213547',
    grid: '#ccc',
    font: 'system-ui, sans-serif',
    background: '#fff',
  });

  // Update theme on mount and system change
  useEffect(() => {
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
      mediaQuery.removeEventListener('change', updateTheme);
      clearTimeout(timer);
    };
  }, []);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="sweep-page">
      <NavBar user={user} onBack={handleBack} onLogout={logout} />

      <div className="sweep-content">
        <Group
          orientation="horizontal"
          style={{ width: '100%', height: '100%' }}
        >
          <Panel defaultSize="35%" minSize="25%" maxSize="70%">
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
              onRun={handleRun}
            />
          </Panel>
          <Separator
            style={{ width: '4px', background: '#ccc', cursor: 'col-resize' }}
          />
          <Panel defaultSize="65%" minSize="30%">
            <SweepResults
              sheetName={sheet?.name || 'Loading...'}
              sheetId={sheetId}
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
