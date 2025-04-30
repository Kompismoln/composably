/**
 * Parse that markdown
 *
 * Features:
 * - Add basic DaisyUI classes
 * - Decrease headings
 * - Create toc from headings and put in data.
 * - Set placeholders for slots
 * - Unicode emoji support
 * - Definition lists
 * - Gfm
 * - Slightly extended table functions
 * - Can take options
 */
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkLint from 'remark-lint';
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

import parseHeadings from './unified-plugins/headings';
import addLinkClass from './unified-plugins/daisyui';
import parseSlots from './unified-plugins/slots';
import {
  remarkDefinitionList,
  defListHastHandlers
} from './unified-plugins/definitionList';

import type { ComponentContent } from './types';

/* Take a prepared markdown object and return a { html, data } object.
 *
 * This function should really have a return type.
 * Why doesnt the linter complain?
 */
export const parse = async (content: ComponentContent) => {
  try {
    const result = await unified()
      .use(() => (_, vfile: VFile) => {
        vfile.data.meta = { options: content.options };
      })
      .use(remarkParse)
      .use(emoji, { accessible: true })
      .use(remarkLint)
      .use(parseHeadings)
      .use(parseSlots)
      .use(remarkGfm)
      .use(remarkDefinitionList)
      .use(remarkDirective)
      .use(remarkExtendedTable)

      .use(remarkRehype, {
        fragment: true,
        handlers: {
          ...extendedTableHandlers,
          ...defListHastHandlers
        }
      })
      .use(rehypeHighlight, {
        detect: true,
        ignoreMissing: true,
        languages: all
      })
      .use(addLinkClass)

      .use(rehypeStringify)

      .process(content.markdown as string);

    content.html = String(result.value).replace(
      /<svelte-component data-slot="([^"]+)"([^>]*)><\/svelte-component>/g,
      '<slots.$1.component {...slots.$1} />'
    );

    delete content.markdown;
    Object.keys(result.data.props || {}).forEach((key) => {
      content[key] = result.data.props[key];
    });
    Object.keys(content.parent || {}).forEach((key) => {
      content[key] = content.parent[key];
    });
    delete content.parent;

    return content;
  } catch (error: any) {
    throw new Error(
      `Failed to parse input: "${content.markdown.slice(0, 50)}" - ${error}`
    );
  }
};
