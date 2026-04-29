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
    'webNavigation',
    'sidePanel',
    'cookies',
    'notifications',
    'scripting',
    'alarms',
    'declarativeNetRequest',
    'declarativeNetRequestWithHostAccess',
  ],
  host_permissions: [
    'https://*.awsapps.com/*',
    // AWS SSO portal API: per-region hosts (Chrome host pattern bans
    // mid-host wildcards). List known IAM Identity Center regions.
    'https://portal.sso.us-east-1.amazonaws.com/*',
    'https://portal.sso.us-east-2.amazonaws.com/*',
    'https://portal.sso.us-west-2.amazonaws.com/*',
    'https://portal.sso.eu-west-1.amazonaws.com/*',
    'https://portal.sso.eu-west-2.amazonaws.com/*',
    'https://portal.sso.eu-central-1.amazonaws.com/*',
    'https://portal.sso.eu-north-1.amazonaws.com/*',
    'https://portal.sso.ap-southeast-1.amazonaws.com/*',
    'https://portal.sso.ap-southeast-2.amazonaws.com/*',
    'https://portal.sso.ap-northeast-1.amazonaws.com/*',
    'https://portal.sso.ap-northeast-2.amazonaws.com/*',
    'https://portal.sso.ap-south-1.amazonaws.com/*',
    'https://portal.sso.ca-central-1.amazonaws.com/*',
    'https://portal.sso.sa-east-1.amazonaws.com/*',
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
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+A',
        mac: 'Command+Shift+A',
      },
      description: 'Open AWS Shortcut',
    },
  },
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['<all_urls>'],
    },
  ],
  content_scripts: [
    {
      matches: ['https://*.console.aws.amazon.com/*'],
      js: ['src/content/console.ts'],
      run_at: 'document_idle',
    },
  ],
});
