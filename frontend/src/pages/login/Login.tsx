import type React from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/contexts/AuthContext';
import { ParascopeLogo } from '../../components/ui/ParascopeLogo';
import './Login.css';

export const Login: React.FC = () => {
  const [name, setName] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authConfig, setAuthConfig] = useState<{
    username_regex: string;
    username_description: string;
  } | null>(null);

  useEffect(() => {
    document.title = 'Login - Parascope';
    api.getAuthConfig().then(setAuthConfig).catch(console.error);
  }, []);

  const isValid = (input: string) => {
    if (!input.trim()) return false;
    const regexStr = authConfig?.username_regex || '^[a-zA-Z0-9_ ]+$';
    try {
      const regex = new RegExp(regexStr);
      return regex.test(input);
    } catch (e) {
      console.error('Invalid regex:', e);
      return true;
    }
  };

  const from = location.state?.from || '/';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid(name)) {
      login(name.trim());
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div
          style={{
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <ParascopeLogo size={64} strokeColor="var(--text-color)" />
        </div>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>
          Welcome to Parascope
        </h1>
        <p style={{ marginBottom: '30px', color: 'var(--text-secondary)' }}>
          Please enter your user name to continue
        </p>

        <form onSubmit={handleSubmit}>
          {authConfig?.username_description && (
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.9em',
                marginBottom: '10px',
              }}
            >
              {authConfig.username_description}
            </p>
          )}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
            className="login-input"
          />
          <button
            type="submit"
            disabled={!isValid(name)}
            className="btn primary"
            style={{ width: '100%' }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};
