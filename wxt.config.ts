import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  manifestVersion: 3,
  zip: {
    includeSources: [
      'src/**',
      'package.json',
      'bun.lock',
      'wxt.config.ts',
      'tsconfig.json',
      'amo-metadata.json',
    ],
  },
  manifest: ({ browser }) => {
    const icons = {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    };

    return {
      name: 'X Article to Markdown',
      description: 'Export X articles to Obsidian-ready Markdown',
      author: 'devtoubkal',
      permissions: ['activeTab', 'scripting'],
      icons,
      action: {
        default_title: 'Export to Markdown',
        default_icon: icons,
      },
      ...(browser === 'firefox' && {
        browser_specific_settings: {
          gecko: {
            id: 'x-article-to-markdown@devtoubkal.com',
            strict_min_version: '142.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      }),
    };
  },
});