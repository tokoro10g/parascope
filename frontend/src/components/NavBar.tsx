import { ArrowLeft, LogOut } from 'lucide-react';
import type React from 'react';
import { ParascopeLogo } from './ParascopeLogo';

interface NavBarProps {
  user: string | null;
  onBack: (e: React.MouseEvent) => void;
  onLogout: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({ user, onBack, onLogout }) => {
  return (
    <div
      className="nav-bar"
      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      <ParascopeLogo size={16} />
      <span style={{ fontWeight: 'bold' }}>Parascope</span>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 0,
          font: 'inherit',
        }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingRight: '10px',
        }}
      >
        <span style={{ fontSize: '0.9em', color: 'white' }}>{user}</span>
        <button
          type="button"
          onClick={onLogout}
          title="Change User"
          className="nav-link"
        >
          <LogOut size={16} /> Change User
        </button>
      </div>
    </div>
  );
};
