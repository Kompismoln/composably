import type { Plugin, ResolvedConfig } from 'vite';
import { filetypes } from './content.js';
import { default as Debug } from 'debug';
import path from 'node:path';

import {
  getEntries,
  getOrLoadPage,
  virtualComponentCache,
  fileToContentEntries,
  invalidateCacheForFile,
  virtualContentSource
} from './cache.js';

import type { Config, SourcePageContent } from './types.d.ts';

import { toAbsolutePath } from './utils.js';

const logBase = Debug('composably');
const logConfig = Debug('composably:config');
const logLoad = Debug('composably:load');
const logHMR = Debug('composably:hmr');

const PLUGIN_PREFIX = 'composably:';

// Specific virtual module IDs (user-facing)
// Usage: import content from 'composably:content';
const VIRTUAL_CONTENT = `${PLUGIN_PREFIX}content`;

// Usage: import about from 'composably:content/about';
const VIRTUAL_PAGE = `${PLUGIN_PREFIX}content/`;

// Usage: import Comp from 'composably:component/[short-hash].svelte';
const VIRTUAL_COMPONENT = `${PLUGIN_PREFIX}component/`;

// Resolved IDs (internal, prefixed with null byte)
const RESOLVED_CONTENT = `\0${VIRTUAL_CONTENT}`;
const RESOLVED_PAGE = `\0${VIRTUAL_PAGE}`;

const COMPONENT_SUFFIX = '.svelte';

// Empty source map for virtual components
// Not critical but it silences Sveltes warnings about missing source files.
const VIRTUAL_SOURCEMAP = {
  version: 3,
  sources: [],
  names: [],
  mappings: ''
};

// ---------------------------------------------

export async function composably(config: Config): Promise<Plugin> {
  return {
    name: 'svelte-composably',
    enforce: 'pre',

    configResolved(viteResolvedConfig: ResolvedConfig) {
      config.root = viteResolvedConfig.root;
      logConfig(`Composably Plugin: Project root resolved to ${config.root}`);
      getEntries(config, true);
    },

    resolveId(source: string): string | undefined {
      if (source === VIRTUAL_CONTENT) {
        return `\0${VIRTUAL_CONTENT}`;
      }
      if (source.startsWith(VIRTUAL_PAGE)) {
        const entry = source.slice(VIRTUAL_PAGE.length);
        if (getEntries(config).has(entry)) {
          return `\0${source}`;
        }
        console.warn(
          `Attempted to resolve non-existent content entry: ${entry}`
        );
        return undefined;
      }
      if (source.startsWith(VIRTUAL_COMPONENT)) {
        // Null byte prefix on virtual components prevents the svelte-plugin
        // from picking them up, so they are not added here.
        return source;
      }
      return undefined;
    },

    async load(id) {
      if (id === `\0${VIRTUAL_CONTENT}`) {
        logLoad('Loading:', `\0${VIRTUAL_CONTENT}`);
        const entries = getEntries(config, true);
        return virtualContentSource(entries);
      }

      // --- Load specific page content ---
      // Match resolved ID: \0composably:content/about
      if (id.startsWith(`\0${VIRTUAL_PAGE}`)) {
        const entryPath = id.slice(`\0${VIRTUAL_PAGE}`.length);

        logLoad('Loading:', id, `(Entry: ${entryPath || '/'})`);

        const page: SourcePageContent = await getOrLoadPage(entryPath, config);

        // Stringify and replace components
        // Consider caching the result of this expensive operation too,
        // invalidated when the page content or component code changes.
        let code = `export default async () => (${JSON.stringify(page)});`;
        code = code.replace(/"component":"([^"]+)"/g, (_, compPath) => {
          const isVirtual = compPath.startsWith(VIRTUAL_COMPONENT);
          const importPath = isVirtual
            ? `${compPath}.svelte` // Append suffix for virtual Svelte components
            : `/${config.componentRoot}/${compPath}.svelte`; // Path to real component
          return `"component":(await import('${importPath}')).default`;
        });
        return code;
      }

      // --- Load virtual component code ---
      // Match ID like composably:component/MyVirtualComp.svelte
      // Ensure the ID includes the suffix if resolveId doesn't add \0
      const vcMatch = id.match(
        new RegExp(
          `^${VIRTUAL_COMPONENT.replace(':', '\\:')}(.+)${COMPONENT_SUFFIX}$`
        )
      );
      if (!vcMatch) {
        return null; // Let other plugins handle other IDs
      }
      const vcName = `${VIRTUAL_COMPONENT}${vcMatch[1]}`; // Reconstruct the key used in the cache
      logLoad('Loading Virtual Component:', id, `(Name: ${vcName})`);

      const cachedVC = virtualComponentCache.get(vcName);

      if (!cachedVC) {
        console.warn(
          `Virtual component data not found in cache for: ${vcName}`
        );
        // Attempt to reload the source page? This might be complex.
        // Or rely on HMR invalidation to fix it.
        // For now, return an error/empty component.
        return `<script>console.error("Virtual component ${vcName} not loaded.");</script>`;
      }

      const { data } = cachedVC;
      const { component: _, ...props } = data; // Destructure the SourceComponentContent

      // Including html enable {@html props.html}, which could be useful,
      // If not it should be deleted upstream
      const propKeys = Object.keys(props).filter((k) => k !== 'html');

      const propString = `{ ${propKeys.join(', ')} } = $props();`;
      const scriptString =
        propKeys.length > 0 ? `<script>\nlet ${propString};\n</script>\n` : '';

      return {
        code: `${scriptString}\n${props.html || ''}`,
        map: VIRTUAL_SOURCEMAP
      };
    },

    async handleHotUpdate({ file, server }) {
      logHMR(`HMR triggered by: ${file}`);
      const absolutePath = file; // Assuming 'file' is absolute path

      // Check if the changed file affects any content entry
      const affectedEntries = fileToContentEntries.get(absolutePath);
      const modulesToReload = new Set<import('vite').ModuleNode>();

      if (affectedEntries && affectedEntries.size > 0) {
        logHMR(`File ${absolutePath} affects entries:`, affectedEntries);

        // Invalidate caches for affected entries AND their virtual components
        invalidateCacheForFile(absolutePath); // Use the helper

        // Find the Vite modules to reload
        for (const entryPath of affectedEntries) {
          // 1. Reload the page module (`\0composably:content/entryPath`)
          const pageModuleId = `${RESOLVED_PAGE}${entryPath}`;
          const pageMod = server.moduleGraph.getModuleById(pageModuleId);
          if (pageMod) {
            logHMR(`Invalidating page module: ${pageModuleId}`);
            server.moduleGraph.invalidateModule(pageMod);
            modulesToReload.add(pageMod);
          } else {
            logHMR(
              `Page module not found in graph (may not be loaded yet): ${pageModuleId}`
            );
          }

          // 2. Reload affected virtual component modules
          // We need the VCs associated *before* invalidation, so retrieve before full cleanup
          // (Alternatively, invalidateCacheForFile could return affected VC IDs)
          // Let's assume virtualComponentCache might still hold *stale* data linking back
          // A better way: iterate virtualComponentCache *before* invalidation
          for (const [vcId, vcData] of virtualComponentCache.entries()) {
            // Check cache before full clear
            if (vcData.sourceEntryPath === entryPath) {
              const vcModuleId = `${vcId}.svelte`; // Append suffix
              const vcMod = server.moduleGraph.getModuleById(vcModuleId);
              if (vcMod) {
                logHMR(`Invalidating virtual component module: ${vcModuleId}`);
                server.moduleGraph.invalidateModule(vcMod);
                modulesToReload.add(vcMod);
              } else {
                logHMR(`VC module not found in graph: ${vcModuleId}`);
              }
            }
          }
        }
      } else {
        logHMR(
          `File ${absolutePath} does not directly affect known content entries.`
        );
      }

      if (modulesToReload.size > 0) {
        logHMR(
          'Requesting reload for modules:',
          Array.from(modulesToReload).map((m) => m.id || m.url)
        );
        return Array.from(modulesToReload);
      }

      // If the file didn't affect any of our modules, let Vite handle it normally.
      return undefined; // Explicitly return undefined if we didn't handle it
    },

    // Optional: configureServer hook to perform initial scan
    configureServer(server) {
      logBase(
        'Composably Plugin: configureServer - Performing initial content scan...'
      );
      getEntries(config, true);
      const contentPathPrefix = toAbsolutePath(path.sep, config);

      const handleFileEvent = async (
        filePath: string,
        eventType: 'add' | 'unlink' | 'change'
      ) => {
        // Filter for files within the content directory and with correct extensions
        if (filePath.startsWith(contentPathPrefix)) {
          const fileExtension = path.extname(filePath).substring(1);
          if (
            filetypes.includes(fileExtension) &&
            path.basename(filePath)[0] !== '_'
          ) {
            const mod = server.moduleGraph.getModuleById(RESOLVED_CONTENT);
            if (mod) {
              logHMR(
                `Invalidating ${RESOLVED_CONTENT} due to ${eventType} ${filePath}`
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
      };

      server.watcher.on('add', (filePath) => handleFileEvent(filePath, 'add'));
      server.watcher.on('unlink', (filePath) =>
        handleFileEvent(filePath, 'unlink')
      );
    }
  };
}
