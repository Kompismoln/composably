import { expect, test, describe, beforeEach, afterEach } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { composably } from '$lib/vite.js';
import type { Config } from '$lib/types.d.ts';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempTestProjectRoot = path.resolve(__dirname, 'temp-hmr-project');
const tempContentDir = path.resolve(tempTestProjectRoot, 'content');

// Helper to create temporary files
async function setupTestFiles(files: Record<string, string>) {
  await fs.rm(tempContentDir, { recursive: true, force: true });
  await fs.mkdir(tempContentDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempContentDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }
}

// Helper to modify a file and wait a bit for the watcher
async function modifyFile(relativePath: string, newContent: string) {
  const fullPath = path.join(tempContentDir, relativePath);
  await fs.writeFile(fullPath, newContent);
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

async function deleteFile(relativePath: string) {
  const fullPath = path.join(tempContentDir, relativePath);
  await fs.unlink(fullPath);
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

describe('Composably Plugin HMR', () => {
  let server: ViteDevServer;
  let pluginUserConfig: Config;

  beforeEach(async () => {
    await setupTestFiles({
      'mypage.md': 'Initial Page',
      'to-delete.md': 'delete me',
      'keeper.md': 'keep me',
      'existing.md': 'content'
    });
    await fs.mkdir(tempTestProjectRoot, { recursive: true });
    pluginUserConfig = {
      root: tempTestProjectRoot,
      contentRoot: 'content',
      componentRoot: 'components'
    };

    server = await createServer({
      root: tempTestProjectRoot,
      configFile: false,
      server: { middlewareMode: true, watch: { awaitWriteFinish: true } },
      plugins: [await composably(pluginUserConfig)]
    });

    const actualViteRoot = server.config.root;
    expect(actualViteRoot).toBe(tempTestProjectRoot);
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(tempTestProjectRoot, { recursive: true, force: true });
  });
  test('should reload page content when its source file changes', async () => {
    const initialModule = await server.ssrLoadModule(
      '\0composably:content/mypage'
    );
    const initialContent = await initialModule.default();
    expect(initialContent).toEqual({ body: 'Initial Page' });

    await modifyFile('mypage.md', 'Updated Page');

    const updatedModule = await server.ssrLoadModule(
      '\0composably:content/mypage'
    );
    const updatedContent = await updatedModule.default();
    expect(updatedContent).toEqual({ body: 'Updated Page' });
  }, 100000);
  test('should update content list when a new file is added', async () => {
    let listModule = await server.ssrLoadModule('composably:content');
    await expect(listModule.default('existing')).resolves.toBeDefined();
    await expect(listModule.default('newpage')).rejects.toThrow(/Not in:/);

    await modifyFile('newpage.md', 'newpage');

    listModule = await server.ssrLoadModule('\0composably:content');
    const newPageModule = await listModule.default('newpage');
    expect(newPageModule).toEqual({ body: 'newpage' });
  }, 100000);

  test('should update content list and caches when a file is deleted', async () => {
    let listModule = await server.ssrLoadModule('\0composably:content');
    await expect(listModule.default('to-delete')).resolves.toBeDefined();

    await deleteFile('to-delete.md');

    listModule = await server.ssrLoadModule('\0composably:content');
    await expect(listModule.default('to-delete')).rejects.toThrow(/Not in:/);
    await expect(listModule.default('keeper')).resolves.toBeDefined();
  }, 100000);
});
