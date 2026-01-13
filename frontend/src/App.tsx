import { Toaster } from 'react-hot-toast';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { Dashboard } from './components/dashboard';
import { Login } from './components/Login';
import { RequireAuth } from './components/RequireAuth';
import { SheetEditor } from './components/sheet-editor';
import { SweepPage } from './components/sweep-page';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';
import './rete.css';

const Layout = () => (
  <div className="App">
    <Outlet />
  </div>
);

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/login', element: <Login /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: '/folder/:folderId',
        element: (
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: '/sheet/:sheetId',
        element: (
          <RequireAuth>
            <SheetEditor />
          </RequireAuth>
        ),
      },
      {
        path: '/sheet/:sheetId/sweep',
        element: (
          <RequireAuth>
            <SweepPage />
          </RequireAuth>
        ),
      },
    ],
  },
]);

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
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
