import { Toaster } from 'react-hot-toast';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { RequireAuth } from './components/RequireAuth';
import { SheetEditor } from './components/SheetEditor';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';
import './rete.css';

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--panel-bg)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/folder/:folderId"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/sheet/:sheetId"
              element={
                <RequireAuth>
                  <SheetEditor />
                </RequireAuth>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
