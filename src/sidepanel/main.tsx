import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import './sidepanel.module.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <div style={{ padding: 16, color: 'var(--ink-500)' }}>
        AWS Shortcut · side panel placeholder
      </div>
    </StrictMode>,
  );
}
