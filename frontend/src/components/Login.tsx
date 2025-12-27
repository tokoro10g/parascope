import type React from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ParascopeLogo } from './ParascopeLogo';

export const Login: React.FC = () => {
  const [name, setName] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const usernameRegex = import.meta.env.VITE_USERNAME_REGEX;
  const usernameDescription = import.meta.env.VITE_USERNAME_DESCRIPTION;

  const isValid = (input: string) => {
    if (!input.trim()) return false;
    if (usernameRegex) {
      try {
        const regex = new RegExp(usernameRegex);
        return regex.test(input);
      } catch (e) {
        console.error('Invalid regex in env:', e);
        return true;
      }
    }
    return true;
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
          Please enter your name to continue
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
            className="login-input"
          />
          {usernameDescription && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
              {usernameDescription}
            </p>
          )}
          <button
            type="submit"
            disabled={!isValid(name)}
            className="login-button"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};
