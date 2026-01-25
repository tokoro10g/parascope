import { ArrowLeft, LogOut } from 'lucide-react';
import type React from 'react';
import { ParascopeLogo } from './ParascopeLogo';
import './NavBar.css';

interface NavBarProps {
  user: string | null;
  onBack: (e: React.MouseEvent) => void;
  onLogout: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({ user, onBack, onLogout }) => {
  return (
    <div className="nav-bar">
      <div className="nav-logo-container">
        <ParascopeLogo size={16} />
        <span>Parascope</span>
      </div>
      <button type="button" onClick={onBack} className="nav-back-button">
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </button>
      <div className="nav-user-section">
        <span className="nav-user-name">{user}</span>
        <button
          type="button"
          onClick={onLogout}
          title="Change User"
          className="nav-logout-button"
        >
          <LogOut size={16} />
          <span>Change User</span>
        </button>
      </div>
    </div>
  );
};
