import { defineConfig } from 'vite';
import path from 'node:path';
import { globSync } from 'node:fs';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
         input: globSync('src/lib/**/*.{ts,js,svelte}', {
        ignore: ['**/*.test.*', '**/*.spec.*'],
      }),
      output: {
        // Customize as needed:
        preserveModules: true,
        dir: 'dist',
        format: 'es',
      },
    },
    target: 'node18', // optional but recommended
    ssr: true,
  },
  plugins: [
        dts({
      include: ['src/lib'],
      outDir: 'dist',
      skipDiagnostics: false
    })
  ],
});
