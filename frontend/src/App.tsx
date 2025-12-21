import { useRete } from 'rete-react-plugin';
import viteLogo from '/vite.svg';
import reactLogo from './assets/react.svg';
import reteLogo from './assets/rete.svg';
import { createEditor } from './rete';
import './common.css';
import './App.css';
import './rete.css';

function App() {
  const [ref] = useRete(createEditor);

  return (
    <>
      <div>
        <a href="https://retejs.org" target="_blank" rel="noreferrer noopener">
          <img src={reteLogo} className="logo rete-logo" alt="Rete logo" />
        </a>
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer noopener">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer noopener">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Rete + Vite + React</h1>
      <div ref={ref} className="rete" />
    </>
  );
}

export default App;
