import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { composably } from './src/lib/vite.js';
import composablyConfig from './composably.config.js';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/.direnv/**']
    }
  },
  plugins: [sveltekit(), composably(composablyConfig)],
  test: {
    coverage: {
      include: ['src/lib/**/*.{ts,js}']
    },
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
