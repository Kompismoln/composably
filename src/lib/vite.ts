import type { Plugin } from 'vite';
import { discoverContentPaths, loadContent } from './content.js';
import type { PageContent, ComponentContent, Config } from './types.d.ts';
import { sveltekit } from '@sveltejs/kit/vite';

// --- Define constants for virtual module IDs ---

// User-facing prefix (used in import statements)
const PLUGIN_PREFIX = 'composably:';

// Specific virtual module IDs (user-facing)
// e.g., import contentList from 'composably:content';
const VIRTUAL_CONTENT = `${PLUGIN_PREFIX}content`;
// e.g., import page from 'composably:content/about';
const VIRTUAL_PAGE = `${PLUGIN_PREFIX}content/`;
// e.g., import Comp from 'composably:component:MyVirtualComp';
const VIRTUAL_COMPONENT = `${PLUGIN_PREFIX}component/`;

// Resolved IDs (internal, prefixed with null byte)
const RESOLVED_CONTENT = `\0${VIRTUAL_CONTENT}`;
const RESOLVED_PAGE = `\0${VIRTUAL_PAGE}`;

// Suffix for virtual component imports (ensure it's consistent)
const COMPONENT_SUFFIX = '.svelte';
// ---------------------------------------------

export default async function composably(
  config: Config
): Promise<Plugin[]> {
  const composablyPlugin = await plugin(config);
  const sveltePlugins = await sveltekit();
  return [composablyPlugin, ...sveltePlugins];
}

async function plugin(config: Config): Promise<Plugin> {
  let entries: string[] | null = null;

  const getEntries = (refresh = false) => {
    if (refresh || !entries) {
      entries = discoverContentPaths(config);
    }
    return entries ?? [];
  };

  let content: Record<string, Promise<PageContent>>;
  let virtualComponents: Record<string, ComponentContent> = {};
  const getContent = (
    refresh = false
  ): Record<string, Promise<PageContent>> => {
    if (refresh || !content) {
      console.log('Refreshing content cache...');
      // Clear previous virtual components if refreshing fully
      virtualComponents = {};
      // Ensure entries are discovered (passing config)
      const currentEntries = getEntries(refresh);

      content = Object.fromEntries(
        currentEntries.map((path) => {
          const pagePromise = loadContent(
            path,
            config,
            // Provide the callback to capture virtual components
            (processedVirtualComponent) => {
              // Ensure component name exists before using as key
              if (processedVirtualComponent?.component) {
                virtualComponents[processedVirtualComponent.component] =
                  processedVirtualComponent;
              } else {
                console.warn(
                  `Processed virtual component from page ${path} lacks a component name.`,
                  processedVirtualComponent
                );
              }
            }
          );
          return [path, pagePromise];
        })
      );
    }
    return content;
  };

  return {
    name: 'svelte-composably',
    enforce: 'pre',

    // --- resolveId Hook ---
    // Maps user-facing IDs to internal resolved IDs (\0 prefix)
    resolveId(source: string): string | undefined {
      if (source === VIRTUAL_CONTENT) {
        return RESOLVED_CONTENT;
      }
      if (source.startsWith(VIRTUAL_PAGE)) {
        const path = source.slice(VIRTUAL_PAGE.length)
        return `${RESOLVED_PAGE}${path}`;
      }
      if (source.startsWith(VIRTUAL_COMPONENT)) {
        const path = source.slice(VIRTUAL_COMPONENT.length)
        return `${VIRTUAL_COMPONENT}${path}`;
      }
    },

    async load(id, opts) {
      if (id === RESOLVED_CONTENT) {
        const tpl = (p: string) =>
          `'${p}': () => import('${VIRTUAL_PAGE}${p}')`;
        const code = `export default { ${getEntries().map(tpl).join(',\n')} }; `;
        return code;
      }

      if (id.startsWith(RESOLVED_PAGE)) {
        const path = id.slice(RESOLVED_PAGE.length);
        const page = await getContent()[path];

        let code = `export default async () => (${JSON.stringify(page)});`;

        code = code.replace(/"component":"([^"]+)"/g, (_, path) => {
          const virt = path.startsWith(VIRTUAL_COMPONENT);
          const imp = virt ? path : `/${config.componentRoot}/${path}`;
          return `"component":(await import('${imp}.svelte')).default`;
        });
        return code;
      }

      if (id.startsWith(VIRTUAL_COMPONENT)) {
        const path = id.slice(0, -'.svelte'.length);
        console.log(path)
        const content = virtualComponents[path];

        const { component, ...props } = content;
        const propString = `{ ${Object.keys(props).join(', ')} }`;
        const scriptString = `<script>\nlet ${propString} = $props();\n</script>\n`;

        return `
          ${scriptString}
          ${props.html}
        `;
      }
    },

    async handleHotUpdate({ file, modules, server }) {
      getContent(true);

      const contentFiles = new Set(modules.map((m) => m.id || ''));

      const modulesToRefresh = [];

      if (contentFiles.has('composably:content')) {
        modulesToRefresh.push(
          ...server.moduleGraph.getModuleById('composably:content')
        );
      }

      for (const entry of getEntries()) {
        const contentModuleId = `composably:content/${entry}`;
        const mod = server.moduleGraph.getModuleById(contentModuleId);
        if (mod) {
          modulesToRefresh.push(mod);
        }
      }

      return modulesToRefresh.filter(Boolean);
    }
  };
}
