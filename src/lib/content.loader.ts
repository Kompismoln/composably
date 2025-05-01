import matter from 'gray-matter';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';

import { globSync } from 'node:fs';
import path from 'node:path';
import { getSchema } from './schemas.js';

import type { ComponentContent, Config } from './types.d.ts';
import { contentTraverser } from './utils.js';

const filetypes = ['js', 'ts', 'json', 'yaml', 'yml', 'md'];

export let config: Config;
export const setConfig = (newConfig: Config) => {
  config = newConfig;
};

/* Probe all filetypes in content root for search path.
 */
export const findPageContent = async (searchPath: string) => {
  for (const ext of filetypes) {
    const filePath = path.join(config.contentRoot, `${searchPath}.${ext}`);
    try {
      return await parseFile(filePath);
    } catch (error: any) {
      if (['ENOENT', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) {
        continue;
      }
      throw error;
    }
  }
  throw new Error(`No file matched '${searchPath}.@(${filetypes.join('|')})'`);
};

/* Parse file path and return data.
 */
export const parseFile = async (filePath: string): Promise<any> => {
  const fileExt = path.extname(filePath);

  if (['.js', '.ts'].includes(fileExt)) {
    return (await import(/* @vite-ignore */ filePath)).default;
  }

  const fileContent = await fs.readFile(filePath, 'utf-8');

  if (fileExt === '.md') {
    const { data, content: body } = matter(fileContent);
    return { ...data, body };
  }
  if (['.yml', '.yaml'].includes(fileExt)) {
    return yaml.load(fileContent);
  }
  if (fileExt === '.json') {
    return JSON.parse(fileContent);
  }
  /* Unusual: This will only happen if filePath has an unsupported filetype
   */
  throw new Error(`unsupported extension: '${fileExt}'.`);
};

/* Load the content of fragment file(s) and attach them to the content tree.
 *
 * If the key is just an underscore, use fragment properties as default for
 * the object itself.
 *
 * Otherwise, attach the fragment to the property with underscore removed.
 *
 * In both cases, delete the reference (key with underscore).
 *
 * (Whoops this function relies on mutation, that will definitely cause
 * trouble some day lol)
 */
export const parseFragment = async (obj: any) => {
  if (
    !obj ||
    typeof obj !== 'object' ||
    Array.isArray(obj) ||
    Object.keys(obj).length < 1
  ) {
    return obj;
  }

  let result = { ...obj };

  if ('_' in obj) {
    let fragment = await parseFile(path.join(config.contentRoot, obj._));
    fragment = await parseFragment(fragment);
    result = { ...fragment, ...result };
    delete result._;
  }

  const keys = Object.keys(result);
  const refs = keys.filter((key) => key[0] === '_');

  if (refs.length === 0) return result;

  for (const ref of refs) {
    let fragment = await parseFile(path.join(config.contentRoot, result[ref]));
    fragment = await parseFragment(fragment);
    delete result[ref];
    result = { [ref.slice(1)]: fragment, ...result };
  }

  return result;
};

/* Discover entries for sveltekit
 *
 * Runs only on build.
 *
 * All valid filetypes in content root are searched.
 * Any match is added as entry.
 *
 * SvelteKit will discover all non-orphan pages given the root page,
 * so this function isn't always needed.
 */
export const discoverContentPaths = () => {
  const pattern = path.join(
    config.contentRoot,
    `**/*.@(${filetypes.join('|')})`
  );

  return (
    globSync(pattern)
      // Strip contentRoot and file extension so that the paths mirrors site paths
      .map((file) => path.parse(path.relative(config.contentRoot, file)))
      // Ignore fragment files
      .filter(({ name }) => name?.[0] !== '_')
      // Alias index file to the empty path (site root)
      .map(({ dir, name }) => {
        const p = path.join(dir, name);
        const entry = p === config.indexFile ? '' : p;

        //console.info(`Adding entry: '${entry}'`);
        return entry;
      })
  );
};

export const loadContent = async (
  searchPath: string,
  virtualComponents: (v: ComponentContent) => void
) => {
  searchPath = searchPath === '' ? config.indexFile : searchPath;

  let page = await findPageContent(searchPath);

  page = await contentTraverser({
    obj: page,
    filter: (obj) => Object.keys(obj).some((key: string) => key[0] === '_'),
    callback: parseFragment
  });

  page = await contentTraverser({
    obj: page,
    filter: (obj) => {
      return 'component' in obj && !obj.component.startsWith('composably:');
    },
    callback: validateAndTransformComponent
  });

  page = await contentTraverser({
    obj: page,
    filter: (obj) =>
      'component' in obj && obj.component.startsWith('composably:'),
    callback: async (obj) => {
      const vComp = await processVirtualComponent(obj);
      obj = { ...obj, ...vComp };
      virtualComponents(obj);
      return obj;
    }
  });

  return page;
};

export const validateAndTransformComponent = async (
  content: ComponentContent
): Promise<ComponentContent> => {
  const path = `${config.componentRoot}/${content.component}.svelte`;
  let schema = await getSchema(path);

  if (!schema?.spa) {
    return content;
  }

  const result = await schema.spa(content);

  if (!result.success) {
    throw new Error(
      `Component '${content.component}' failed validation: ${result.error.message}`
    );
  }
  return result.data;
};

const processVirtualComponent = async (content: ComponentContent) => {
  const parse = (await import('./markdown.js')).parse;
  if ('markdown' in content) {
    const parsedContent = await parse(content);
    return parsedContent;
  }
  return content;
};
