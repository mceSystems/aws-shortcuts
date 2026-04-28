import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <div style={{ padding: 32, maxWidth: 880, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
          AWS Shortcut · Settings
        </h1>
        <p style={{ color: 'var(--ink-500)' }}>options page placeholder</p>
      </div>
    </StrictMode>,
  );
}
