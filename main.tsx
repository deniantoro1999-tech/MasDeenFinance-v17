import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Apply tema sebelum mount (mencegah flash of wrong theme)
const savedTheme = localStorage.getItem('masdeen_theme') || 'dark';
if (savedTheme !== 'dark') {
  document.body.classList.add(`theme-${savedTheme}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
