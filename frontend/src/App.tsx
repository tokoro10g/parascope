import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { SheetEditor } from './components/SheetEditor';
import './App.css';
import './common.css';
import './rete.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sheet/:sheetId" element={<SheetEditor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
