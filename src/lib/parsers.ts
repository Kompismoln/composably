/**
 * Unified/Remark/Rehype parser module for component content.
 *
 * Features:
 * - Parses markdown fields within a SourceComponentContent object.
 * - Allows injection of custom remark and rehype plugins.
 * - Decrease headings and create TOC (via default plugin).
 * - Set placeholders for slots (via default plugin).
 * - Unicode emoji support (via default plugin).
 * - Definition lists (via default plugin).
 * - Gfm (via default plugin).
 * - Slightly extended table functions (via default plugin).
 * - Brace transformation for template literals.
 * - Component insertion via slot syntax.
 * - Prop transfer from parsed data and parent object.
 */
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

// Default plugins (can be customized further)
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

// --- Helper Functions ---

/**
 * Transforms curly braces to avoid conflicts with template syntax.
 * {{ }} becomes {}
 * { } becomes {'{'} / {'}'}
 * @param str Input HTML string
 * @returns String with braces transformed
 */
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

/**
 * Replaces placeholder elements with Svelte-like slot syntax.
 * @param html Input HTML string
 * @returns String with slot syntax
 */
function transformSlots(html: string): string {
  return html.replace(
    /<svelte-component data-slot="([^"]+)"([^>]*)><\/svelte-component>/g,
    '<slots.$1.component {...slots.$1} />' // Assuming svelte syntax is desired output
  );
}

/**
 * Parses a markdown string using unified and configured plugins.
 *
 * @param markdown The markdown string to parse.
 * @param initialData Data to pre-populate the VFile with (e.g., config).
 * @param config Parser config including custom plugins.
 * @returns A promise resolving to the processed VFile.
 */
async function parseMarkdownString(
  markdown: string,
  initialData: Record<string, unknown> = {},
  config: Config
): Promise<VFile> {
  const processor = unified()
    // 1. Initial setup and metadata injection
    .use(() => (_, vfile: VFile) => {
      vfile.data = { ...vfile.data, ...initialData };
    })
    // 2. Base Markdown Parsing and Remark Plugins
    .use(remarkParse)
    .use(emoji, { accessible: true }) // Default: emoji
    .use(parseHeadings) // Default: Headings & TOC
    .use(parseSlots) // Default: Slot placeholders
    .use(remarkGfm) // Default: GitHub Flavored Markdown
    .use(remarkDefinitionList) // Default: Definition Lists
    .use(remarkDirective) // Default: Directives
    .use(remarkExtendedTable); // Default: Extended Tables

  // 3. Inject custom Remark plugins
  (config.remarkPlugins || []).forEach((plugin) => {
    // Ensure plugin is not null/undefined before using
    if (plugin) processor.use(plugin);
  });

  // 4. Bridge to Rehype
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

// --- Main Exported Function ---

/**
 * Parses designated fields within a SourceComponentContent object.
 * Currently focuses on parsing a 'markdown' field into an 'html' field,
 * applying various transformations and plugin processing.
 *
 * @param content The input SourceComponentContent object. Expected to have a field
 * (default 'markdown') containing the markdown string, and potentially
 * an 'config' field for metadata and a 'parent' field for property inheritance.
 * @param config Optional configuration for the parser, including injectable plugins
 * and field names.
 * @returns A Promise resolving to the modified SourceComponentContent object with parsed HTML,
 * extracted data, and merged properties.
 * @throws Throws an error if parsing fails.
 */
export const parseComponentContent = async (
  content: SourceComponentContent,
  config: Config
): Promise<SourceVirtualComponentContent> => {
  if (typeof content.markdown !== 'string') {
    throw new UnlikelyCodePathError(this);
  }

  const markdownInput = content.markdown as string;

  // Prepare initial data for the VFile
  const initialVFileData = {
    meta: { options: content.options || {} } // Pass component options if available
  };

  // 1. Parse the markdown string using the unified pipeline
  const result = await parseMarkdownString(
    markdownInput,
    initialVFileData,
    config
  );

  // 2. Post-processing on the resulting HTML string
  let processedHtml = String(result.value);
  processedHtml = transformBraces(processedHtml); // Handle {{}} and {}
  processedHtml = transformSlots(processedHtml); // Handle <svelte-component...> placeholders

  // 3. Update the content object
  // Add the generated HTML
  content.html = processedHtml;

  // Merge properties extracted by plugins (e.g., toc from parseHeadings)
  // Ensure result.data exists and is an object
  if (result.data && typeof result.data === 'object') {
    Object.keys(result.data).forEach((key) => {
      // Avoid overwriting essential fields like 'meta' unless intended
      if (key !== 'meta' && key !== 'props') {
        content[key] = result.data[key];
      }
    });

    // Specifically merge 'props' extracted from data onto the root level
    if (result.data.props && typeof result.data.props === 'object') {
      Object.entries(result.data.props || {}).forEach(([key, value]) => {
        if (value) content[key] = value;
      });
    }
  }

  // Merge properties from the parent object, potentially overwriting
  // properties extracted from markdown or existing ones.
  if (content.parent && typeof content.parent === 'object') {
    Object.keys(content.parent).forEach((key) => {
      content[key] = (content.parent as Record<string, unknown>)[key];
    });
    delete content.parent; // Clean up parent field
  }

  // Remove the original markdown field
  delete content.markdown;

  // Return the modified content object
  return content as SourceVirtualComponentContent;
};
