import type { ViteDevServer, Plugin, ResolvedConfig } from 'vite';
import type { PartialConfig, Config } from './types.d.ts';

import { default as Debug } from 'debug';
import path from 'node:path';
import { filetypes } from './content.js';
import { toAbsolutePath } from './utils.js';
import { resolveConfig } from './config.js';

import {
  getEntries,
  invalidateAndGetAffectedItems,
  virtualContentSource,
  virtualPageSource,
  virtualComponentSource
} from './cache.js';

const logBase = Debug('composably');
const logConfig = Debug('composably:config');
const logLoad = Debug('composably:load');
const logHMR = Debug('composably:hmr');

export function composably(partialConfig: PartialConfig): Plugin {
  const config = resolveConfig(partialConfig);

  return {
    name: 'svelte-composably',
    enforce: 'pre',

    configResolved(viteResolvedConfig: ResolvedConfig) {
      config.root = viteResolvedConfig.root;
      logConfig(`Composably Plugin: Project root resolved to ${config.root}`);
    },

    resolveId(source: string) {
      if (source === config.contentPrefix) {
        return `\0${config.contentPrefix}`;
      }
      if (source.startsWith(`${config.contentPrefix}/`)) {
        const entry = source.slice(config.contentPrefix.length + 1);
        if (getEntries(config).has(entry)) {
          return `\0${source}`;
        }
      }
      if (source.startsWith(config.componentPrefix)) {
        // Standard practice is to add a null byte prefix here,
        // but a null byte prefix on virtual components prevents the svelte-plugin
        // from picking them up, so we don't. It's probably ok.
        return source;
      }
    },

    async load(id) {
      if (id === `\0${config.contentPrefix}`) {
        logLoad('Loading content list:', `\0${config.contentPrefix}`);
        return virtualContentSource(config);
      }

      if (id.startsWith(`\0${config.contentPrefix}/`)) {
        const entryPath = id.slice(`\0${config.contentPrefix}/`.length);
        logLoad('Loading page:', id, `(Entry: ${entryPath || '/'})`);
        return virtualPageSource(entryPath, config);
      }

      if (id.startsWith(config.componentPrefix)) {
        logLoad('Loading Virtual Component:', id, `(Name: ${id})`);
        return virtualComponentSource(id);
      }

      return null;
    },

    handleHotUpdate({ file, server }) {
      logHMR(`HMR triggered by: ${file}`);
      return getModulesToReload(file, server, config);
    },

    configureServer(server) {
      logBase(
        'Composably Plugin: configureServer - Performing initial content scan...'
      );

      server.watcher.on('add', (filePath) =>
        handleFileEvent(filePath, 'add', config, server)
      );

      server.watcher.on('unlink', (filePath) =>
        handleFileEvent(filePath, 'unlink', config, server)
      );
    }
  };
}

function handleFileEvent(
  filePath: string,
  eventType: 'add' | 'unlink' | 'change',
  config: Config,
  server: ViteDevServer
) {
  const contentPathPrefix = toAbsolutePath(path.sep, config);

  if (filePath.startsWith(contentPathPrefix)) {
    const fileExtension = path.extname(filePath).substring(1);
    if (
      filetypes.includes(fileExtension) &&
      path.basename(filePath)[0] !== '_'
    ) {
      const mod = server.moduleGraph.getModuleById(`\0${config.contentPrefix}`);
      if (mod) {
        logHMR(
          `Invalidating \0${config.contentPrefix} due to ${eventType} ${filePath}`
        );
        server.moduleGraph.invalidateModule(mod);
        server.ws.send({
          type: 'update',
          updates: [
            {
              type: 'js-update',
              path: mod.url,
              acceptedPath: mod.url,
              timestamp: Date.now()
            }
          ]
        });
      }
    }
  }
}

function getModulesToReload(
  file: string,
  server: ViteDevServer,
  config: Config
) {
  logHMR(`HMR: File changed: ${file}. Querying cache for affected items.`);

  const { affectedEntryPaths, affectedVirtualComponentIds } =
    invalidateAndGetAffectedItems(file);

  const modulesToReload = new Set<import('vite').ModuleNode>();

  if (
    affectedEntryPaths.length === 0 &&
    affectedVirtualComponentIds.length === 0
  ) {
    logHMR(
      `HMR: Cache reported no direct page or VC invalidations for ${file}.`
    );
    return undefined;
  }

  logHMR(
    `HMR: Cache invalidation for ${file}.` +
      `Affected Entries: [${affectedEntryPaths.join(', ')}].` +
      `Affected VCs: [${affectedVirtualComponentIds.join(', ')}]`
  );

  for (const entryPath of affectedEntryPaths) {
    const pageModuleId = `\0${config.contentPrefix}/${entryPath}`;
    const pageMod = server.moduleGraph.getModuleById(pageModuleId);
    if (pageMod) {
      logHMR(`HMR: Invalidating page module in graph: ${pageModuleId}`);
      server.moduleGraph.invalidateModule(pageMod);
      modulesToReload.add(pageMod);
    } else {
      logHMR(
        `HMR: Page module ${pageModuleId} not found in graph (may not be loaded by any client yet).`
      );
    }
  }

  for (const vcId of affectedVirtualComponentIds) {
    const vcMod = server.moduleGraph.getModuleById(vcId);
    if (vcMod) {
      logHMR(`HMR: Invalidating virtual component module in graph: ${vcId}`);
      server.moduleGraph.invalidateModule(vcMod);
      modulesToReload.add(vcMod);
    } else {
      logHMR(`HMR: Virtual component module ${vcId} not found in graph.`);
    }
  }

  if (modulesToReload.size > 0) {
    logHMR(
      'HMR: Requesting reload for modules:',
      Array.from(modulesToReload).map((m) => m.id || m.url)
    );
    return Array.from(modulesToReload);
  }

  return undefined;
}
