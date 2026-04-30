import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { CatalogSection } from './CatalogSection';
import { HarvestSection } from './HarvestSection';
import styles from './options.module.css';

const isDev = import.meta.env.DEV;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.title}>AWS Shortcut · Settings</h1>
          <p className={styles.subtitle}>Catalog and preferences for the popup.</p>
        </header>
        <main className={styles.main}>
          <CatalogSection />
          {isDev && <HarvestSection />}
        </main>
      </div>
    </StrictMode>,
  );
}
