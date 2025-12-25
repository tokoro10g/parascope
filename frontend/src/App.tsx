import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { SheetEditor } from './components/SheetEditor';
import { Login } from './components/Login';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';
import './rete.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            } />
            <Route path="/folder/:folderId" element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            } />
            <Route path="/sheet/:sheetId" element={
              <RequireAuth>
                <SheetEditor />
              </RequireAuth>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
