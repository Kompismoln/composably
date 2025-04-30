import type { Plugin } from 'vite';
import { discoverContentPaths, loadContent, setConfig } from './content.loader';
import type { PageContent, ComponentContent } from './types';
import { sveltekit } from '@sveltejs/kit/vite'

let entries: string[];
const getEntries = (refresh = false) => {
  if (refresh || !entries) {
    entries = discoverContentPaths();
  }
  return entries;
};

let content: Record<string, Promise<PageContent>>;
let virtualComponents: Record<string, ComponentContent> = {};
const getContent = (refresh = false) => {
  if (refresh || !content) {
    entries = discoverContentPaths();
    content = Object.fromEntries(
      getEntries(refresh).map((p) => {
        return [
          p,
          loadContent(p, (c) => {
            virtualComponents[c.component] = c;
          })
        ];
      })
    );
  }
  return content;
};
export default async function composably(
  options: Record<string, string>
): Promise<Plugin[]> {
  return [
    (await plugin(options)),
    sveltekit()
  ];
};

async function plugin(
  options: Record<string, string>
): Promise<Plugin> {
  return {
    name: 'svelte-composably',
    enforce: 'pre',

    async buildStart() {
      setConfig(options);
    },

    async load(id, opts) {
      if (id === 'composably:content') {
        const tpl = (p: string) =>
          `'${p}': () => import('composably:content/${p}')`;
        const code = `export default { ${getEntries().map(tpl).join(',\n')} }; `;
        return code;
      }

      if (id.startsWith('composably:content/')) {
        const path = id.slice('composably:content/'.length);
        const page = await getContent()[path];

        let code = `export default async () => (${JSON.stringify(page)});`;

        code = code.replace(/"component":"([^"]+)"/g, (_, path) => {
          const virt = path.startsWith('composably:component');
          const imp = virt ? path : `/${options.componentRoot}/${path}`;
          return `"component":(await import('${imp}.svelte')).default`;
        });
        return code;
      }

      if (id.startsWith('composably:component')) {
        const path = id.slice(0, -'.svelte'.length);
        const content = virtualComponents[path];
        const isComponent = true;

        const { component, ...props } = content;
        const propString = `{ ${Object.keys(props).join(', ')} }`;
        const scriptString = `<script>\nlet ${propString} = $props();\n</script>\n`;

        const html = isComponent ? props.html : '{@html html}';

        return `
          ${scriptString}
          ${html}
        `;
      }
    },

    resolveId(source) {
      if (source.startsWith('composably:')) {
        return source;
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
