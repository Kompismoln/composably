import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import remarkDirective from 'remark-directive';
import rehypeHighlight from 'rehype-highlight';
import { all } from 'lowlight';
import emoji from 'remark-emoji';
import {
  remarkExtendedTable,
  extendedTableHandlers
} from 'remark-extended-table';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import type { VFile } from 'vfile';

import parseHeadings from './unified-plugins/headings.js';
import parseSlots from './unified-plugins/slots.js';
import {
  remarkDefinitionList,
  defListHastHandlers
} from './unified-plugins/definitionList.js';

import type {
  SourceComponentContent,
  SourceVirtualComponentContent,
  Config
} from './types.d.ts';
import { UnlikelyCodePathError } from './errors.js';

function transformBraces(str: string): string {
  return str
    .replace(/{{/g, '__DOUBLE_LEFT__')
    .replace(/}}/g, '__DOUBLE_RIGHT__')
    .replace(/{/g, '__SINGLE_LEFT__')
    .replace(/}/g, '__SINGLE_RIGHT__')
    .replace(/__SINGLE_LEFT__/g, "{'{'}")
    .replace(/__SINGLE_RIGHT__/g, "{'}'}")
    .replace(/__DOUBLE_LEFT__/g, '{')
    .replace(/__DOUBLE_RIGHT__/g, '}');
}

function transformSlots(html: string): string {
  return html.replace(
    /<svelte-component data-slot="([^"]+)"([^>]*)><\/svelte-component>/g,
    '<slots.$1.component {...slots.$1} />' // Assuming svelte syntax is desired output
  );
}

async function parseMarkdownString(
  markdown: string,
  initialData: Record<string, unknown> = {},
  config: Config
): Promise<VFile> {
  const processor = unified()
    .use(() => (_, vfile: VFile) => {
      vfile.data = { ...vfile.data, ...initialData };
    })
    .use(remarkParse)
    .use(emoji, { accessible: true })
    .use(parseHeadings)
    .use(parseSlots)
    .use(remarkGfm)
    .use(remarkDefinitionList)
    .use(remarkDirective)
    .use(remarkExtendedTable);

  (config.remarkPlugins || []).forEach((plugin) => {
    if (plugin) processor.use(plugin);
  });

  processor.use(remarkRehype, {
    fragment: true,
    allowDangerousHtml: true,
    handlers: {
      ...extendedTableHandlers,
      ...defListHastHandlers
    }
  });

  processor.use(rehypeHighlight, {
    detect: true,
    ignoreMissing: true,
    languages: all
  });

  (config.rehypePlugins || []).forEach((plugin) => {
    if (plugin) processor.use(plugin);
  });

  processor.use(rehypeStringify, {
    allowDangerousHtml: true
  });

  return processor.process(markdown);
}

export const parseComponentContent = async (
  content: SourceComponentContent,
  config: Config
): Promise<SourceVirtualComponentContent> => {
  if (typeof content.markdown !== 'string') {
    throw new UnlikelyCodePathError(this);
  }

  const initialVFileData = {
    meta: { options: content.options || {} }
  };

  const result = await parseMarkdownString(
    content.markdown,
    initialVFileData,
    config
  );

  let processedHtml = String(result.value);
  processedHtml = transformBraces(processedHtml);
  processedHtml = transformSlots(processedHtml);

  const processedContent: SourceVirtualComponentContent = {
    component: content.component,
    html: processedHtml
  };

  if (result.data && typeof result.data === 'object') {
    Object.keys(result.data).forEach((key) => {
      if (key !== 'meta' && key !== 'props') {
        processedContent[key] = result.data[key];
      }
    });

    if (result.data.props && typeof result.data.props === 'object') {
      Object.entries(result.data.props || {}).forEach(([key, value]) => {
        if (value) processedContent[key] = value;
      });
    }
  }

  if (content.parent && typeof content.parent === 'object') {
    Object.keys(content.parent).forEach((key) => {
      processedContent[key] = (content.parent as Record<string, unknown>)[key];
    });
  }

  return processedContent;
};
