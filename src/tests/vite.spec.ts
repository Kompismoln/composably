import { expect, test, describe, beforeEach, afterEach } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { composably } from '../lib/vite.js';
import type { Config } from '../lib/types.d.ts';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ErrorCode } from '../lib/errors.js';

const TIMEOUT = 100000;
const MODIFY_DELAY = 3000;
const DELETE_DELAY = 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Helper to create temporary files
//
async function setupTestFiles(
  files: Record<string, string>,
  contentRoot: string
) {
  await fs.rm(contentRoot, { recursive: true, force: true });
  await fs.mkdir(contentRoot, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(contentRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }
}

// Helper to modify a file and wait a bit for the watcher
async function modifyFile(
  relativePath: string,
  newContent: string,
  contentRoot: string
) {
  const fullPath = path.join(contentRoot, relativePath);
  await fs.writeFile(fullPath, newContent);
  await new Promise((resolve) => setTimeout(resolve, MODIFY_DELAY));
}

async function deleteFile(relativePath: string, contentRoot: string) {
  const fullPath = path.join(contentRoot, relativePath);
  await fs.unlink(fullPath);
  await new Promise((resolve) => setTimeout(resolve, DELETE_DELAY));
}

describe('Module loading', () => {
  let server: ViteDevServer;
  let config: Config;
  const root = path.resolve(__dirname, 'temp-vite-virtual-modules');
  const contentRoot = path.resolve(root, 'content');

  beforeEach(async () => {
    await setupTestFiles(
      {
        'exist.md': 'I exist'
      },
      contentRoot
    );

    config = {
      root,
      contentRoot,
      componentRoot: '_'
    };

    server = await createServer({
      root,
      plugins: [await composably(config)]
    });

    expect(server.config.root).toBe(root);
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(root, { recursive: true, force: true });
  });

  test('should load existing page', async () => {
    const mypage = await server.ssrLoadModule('\0composably:content/exist');
    const mypageContent = await mypage.default();
    expect(mypageContent).toEqual({ body: 'I exist' });
  });

  test('should load non-existing page', async () => {
    await expect(
      server.ssrLoadModule('\0composably:content/no')
    ).rejects.toThrow(expect.objectContaining({ name: 'PageNotFoundError' }));
  });
});

describe('Hot module replacement', () => {
  let server: ViteDevServer;
  let pluginUserConfig: Config;
  const root = path.resolve(__dirname, 'temp-vite-hmr');
  const contentRoot = path.resolve(root, 'content');

  beforeEach(async () => {
    await setupTestFiles(
      {
        'mypage.md': 'Initial Page',
        'to-delete.md': 'delete me',
        'keeper.md': 'keep me',
        'existing.md': 'content'
      },
      contentRoot
    );

    pluginUserConfig = {
      root,
      contentRoot,
      componentRoot: '_'
    };

    server = await createServer({
      root,
      configFile: false,
      server: {
        middlewareMode: true,
        watch: {
          awaitWriteFinish: true
        }
      },
      plugins: [await composably(pluginUserConfig)]
    });

    expect(server.config.root).toBe(root);
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(root, { recursive: true, force: true });
  });

  test(
    'should reload page content when its source file changes',
    async () => {
      const initialModule = await server.ssrLoadModule(
        '\0composably:content/mypage'
      );
      const initialContent = await initialModule.default();
      expect(initialContent).toEqual({ body: 'Initial Page' });

      await modifyFile('mypage.md', 'Updated Page', contentRoot);

      const updatedModule = await server.ssrLoadModule(
        '\0composably:content/mypage'
      );
      const updatedContent = await updatedModule.default();
      expect(updatedContent).toEqual({ body: 'Updated Page' });
    },
    TIMEOUT
  );

  test(
    'should update content list when a new file is added',
    async () => {
      let listModule = await server.ssrLoadModule('composably:content');

      await expect(listModule.default('existing')).resolves.toBeDefined();

      await expect(listModule.default('newpage')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.CONTENT_ENTRY_NOT_FOUND })
      );

      await modifyFile('newpage.md', 'newpage', contentRoot);

      listModule = await server.ssrLoadModule('\0composably:content');

      const newPageModule = await listModule.default('newpage');

      expect(newPageModule).toEqual({ body: 'newpage' });
    },
    TIMEOUT
  );

  test(
    'should update content list when a file is deleted',
    async () => {
      let listModule = await server.ssrLoadModule('\0composably:content');
      await expect(listModule.default('to-delete')).resolves.toBeDefined();

      await deleteFile('to-delete.md', contentRoot);

      listModule = await server.ssrLoadModule('\0composably:content');
      await expect(listModule.default('to-delete')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.CONTENT_ENTRY_NOT_FOUND })
      );
      await expect(listModule.default('keeper')).resolves.toBeDefined();
    },
    TIMEOUT
  );
});
