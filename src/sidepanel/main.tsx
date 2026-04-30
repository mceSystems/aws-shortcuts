import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { initCatalogStore } from '@/shared/catalogStore';
import { App } from '@/panel/App';

void initCatalogStore();

const root = document.getElementById('root');
if (root) {
  // No <StrictMode> wrapper: in dev it double-mounts, which made
  // ServiceSearch's input ref + focus effects race and broke Enter.
  createRoot(root).render(<App />);
}
