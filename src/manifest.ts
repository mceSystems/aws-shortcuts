import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'AWS Shortcut',
  version: pkg.version,
  description: pkg.description,
  permissions: [
    'storage',
    'tabs',
    'webRequest',
    'sidePanel',
    'cookies',
    'notifications',
    'scripting',
    'alarms',
  ],
  host_permissions: [
    'https://*.awsapps.com/*',
    'https://portal.sso.*.amazonaws.com/*',
    'https://*.console.aws.amazon.com/*',
    'https://*.signin.aws.amazon.com/*',
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'AWS Shortcut',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://*.awsapps.com/start/*'],
      js: ['src/content/portal.ts'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://*.console.aws.amazon.com/*'],
      js: ['src/content/console.ts'],
      run_at: 'document_idle',
    },
  ],
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+A',
        mac: 'Command+Shift+A',
      },
      description: 'Open AWS Shortcut palette',
    },
  },
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['<all_urls>'],
    },
  ],
});
