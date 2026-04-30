import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { initCatalogStore } from '@/shared/catalogStore';
import { App } from './App';

void initCatalogStore();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
