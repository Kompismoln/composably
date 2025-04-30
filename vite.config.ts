import { svelteTesting } from '@testing-library/svelte/vite';
import composably from './src/lib/vite.js';
import { defineConfig } from 'vite';

const config = {
  componentRoot: 'src/components',
  contentRoot: 'src/content',
  indexFile: 'index'
};

export default defineConfig({
  plugins: [composably(config)],
  test: {
    workspace: [
      {
        extends: './vite.config.ts',
        plugins: [svelteTesting()],
        test: {
          name: 'client',
          environment: 'jsdom',
          clearMocks: true,
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
          setupFiles: ['./vitest-setup-client.ts']
        }
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      }
    ]
  }
});
