import matter from 'gray-matter';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';
import { parseComponentContent } from './parsers.js';
import { contentTraverser } from './utils.js';
import { colocate } from './validators.js';

import type {
  SourceComponentContent,
  Config,
  SourcePageContent,
  Fragment
} from './types.d.ts';

const filetypes = ['js', 'ts', 'json', 'yaml', 'yml', 'md'];

/**
 * Loads, parses, and processes content for a given site path, returning a Promise
 * for the final page content. It uses a callback to report processed virtual
 * components *during* its execution, enabling lazy loading while still capturing
 * necessary side data.
 *
 * @param localPath The site path (e.g., 'about/team' or '').
 * @param config The application configuration object.
 * @param reportVirtualComponent A callback function invoked whenever a virtual
 * component is successfully processed. It receives the processed component content.
 * @param reportFileDependency A callback function invoked whenever a file is
 * loaded during the content processing.
 * @returns A Promise resolving to the fully processed page data (type SourcePageContent).
 */
export const loadContent = async (
  localPath: string,
  config: Config,
  reportVirtualComponent: (component: SourceComponentContent) => void,
  reportFileDependency: (filePath: string) => void
): Promise<SourcePageContent> => {
  // Decide which name to map the empty path to.
  localPath ||= config.indexFile || 'index';

  // Finding the root content file
  const { absPath, content } = await findAndParseContentFile(localPath, config);

  let pageData = content as SourcePageContent;

  // Report the main file as a dependency
  reportFileDependency(absPath);

  // Apply transformations using the contentTraverser utility.
  // The traverser constructs a new object from pageData.

  // 1. Load and attach fragments recursively
  pageData = (await contentTraverser({
    obj: pageData,
    filter: (obj) =>
      typeof obj === 'object' &&
      obj !== null &&
      Object.keys(obj).some((key) => key.startsWith('_')),
    callback: (obj) => loadAndAttachFragments(obj, config, reportFileDependency)
  })) as SourcePageContent;

  // 2. Validate and transform regular components based on schema
  pageData = (await contentTraverser({
    obj: pageData,
    filter: (obj) =>
      typeof obj?.component === 'string' &&
      !obj.component.startsWith('composably:'),
    callback: (obj) => {
      const validator = config.validator || colocate;
      const newObj = validator(
        obj as SourceComponentContent,
        reportFileDependency,
        config
      );
      return newObj;
    }
  })) as SourcePageContent;

  // 3. Process virtual components (e.g., parse markdown) AND trigger callback
  pageData = (await contentTraverser({
    obj: pageData,
    filter: (obj) =>
      typeof obj?.component === 'string' &&
      obj.component.startsWith('composably:'),
    // Callback: Process the virtual component AND call the provided handler
    callback: async (obj) => {
      const processedComp = await processVirtualComponent(
        obj as SourceComponentContent,
        config
      );
      // Call the callback with the processed component
      // Ensure processedComp has the necessary structure (e.g., component name)
      reportVirtualComponent(processedComp);

      // Return the processed component to potentially update the tree
      return processedComp;
    }
  })) as SourcePageContent;

  // After all traversals, the final pageData is ready.
  return pageData;
};

/**
 * Discovers potential content entry paths within the content root.
 * Filters out fragment files (starting with '_') and maps paths for routing.
 * Assumes it runs in a context where synchronous I/O is acceptable
 * (e.g., build time).
 *
 * @param config The application configuration object.
 * @returns An array of site paths corresponding to content files.
 */
export const discoverContentPaths = (config: Config): string[] => {
  const pattern = path.join(
    config.contentRoot,
    // Match any file with the specified extensions
    `**/*.@(${filetypes.join('|')})`
  );

  return (
    globSync(pattern)
      // Filter out files starting with underscore (fragments)
      .filter((filePath: string) => path.basename(filePath)[0] !== '_')
      // Map absolute path to relative site path
      .map((filePath: string) => {
        const relativePath = path.relative(config.contentRoot, filePath);
        const { dir, name } = path.parse(relativePath);
        const sitePath = path.join(dir, name);

        // Handle index file mapping (e.g., 'index' -> '')
        return sitePath === (config.indexFile || 'index')
          ? ''
          : sitePath.replace(/\\/g, '/'); // Normalize to forward slashes
      })
  );
};

// --- File Parsing Logic ---

/**
 * Find and parse a content file by trying different extensions.
 * @param localPath Relative path within contentRoot (without extension).
 * @param config The application configuration object.
 * @returns Parsed the path and content from the first matching file found.
 * @throws Error if no matching file is found.
 */
const findAndParseContentFile = async (
  localPath: string,
  config: Config
): Promise<{ absPath: string; content: Fragment }> => {
  for (const ext of filetypes) {
    const absPath = `${toAbsolutePath(localPath, config)}.${ext}`;
    try {
      // Check existence first to provide clearer ENOENT handling if needed,
      // though readFile will also throw ENOENT. Stat adds an extra check.
      // await fs.access(filePath); // Optional: uncomment if finer-grained
      // error handling is needed
      const content = await parseFileContent(absPath);
      return { absPath, content };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = String((error as { code: unknown }).code);
        if (['ENOENT', 'ERR_MODULE_NOT_FOUND'].includes(errorCode)) {
          continue;
        }
      }
      // Log or handle other errors more specifically if needed
      console.error(`Error parsing file ${absPath}:`, error);
      throw error; // Re-throw other errors (permissions, syntax errors, etc.)
    }
  }
  // If loop completes without finding a file
  throw new Error(
    `Content file not found for path: '${localPath}' (checked extensions: ${filetypes.join(', ')}) in ${config.contentRoot}`
  );
};

/**
 * Recursively load and merge fragment files referenced in an object.
 * Fragments are referenced by keys starting with '_'.
 * If the key is exactly '_', its content is merged into the parent.
 * Otherwise, the content is attached to a property named without the
 * underscore.
 * Note: Uses spread syntax to create new objects, aiming for immutability.
 *
 * @param obj The object potentially containing fragment references. Should be JSON-serializable.
 * @param config The application configuration object.
 * @param reportFileDependency Callback function to report file dependencies.
 * @returns A Promise resolving to a new object of the shape TExpected,
 * with fragments loaded and merged/attached.
 */
const loadAndAttachFragments = async (
  obj: Fragment,
  config: Config,
  reportFileDependency: (filePath: string) => void
): Promise<Fragment> => {
  let currentResult: Fragment = { ...obj }; // Start with a shallow copy

  // 1. Handle root fragment reference ('_')
  if ('_' in currentResult && typeof currentResult._ === 'string') {
    const absPath = toAbsolutePath(currentResult._, config);
    const fragmentContent = await parseFileContent(absPath);
    reportFileDependency(absPath);

    // Drop the fragment handle
    delete currentResult._;

    // Merge the fragment content. Let properties originally in currentResult
    // (other than '_') override fragment properties if keys clash.
    currentResult = { ...fragmentContent, ...currentResult };
  }

  // 2. Handle named fragment references ('_key') recursively and merge results
  const processedFragments: Fragment = {};

  // Iterate over a copy of keys, as we might modify currentResult
  const keys = Object.keys(currentResult);

  for (const key of keys) {
    if (
      key.startsWith('_') &&
      key.length > 1 &&
      typeof currentResult[key] === 'string'
    ) {
      const newKey = key.slice(1); // Remove the leading underscore

      const absPath = toAbsolutePath(currentResult[key], config);
      const fragmentContent = await parseFileContent(absPath);
      reportFileDependency(absPath);

      // Store processed fragment under the new key
      processedFragments[newKey] = fragmentContent;

      // Delete the old key
      delete currentResult[key];
    }
  }

  currentResult = { ...processedFragments, ...currentResult };
  return currentResult;
};

/**
 * Parse file content based on its extension.
 * @param filePath Absolute path to the file.
 * @param fileExt File extension (e.g., '.md').
 * @returns Parsed data from the file.
 */
const parseFileContent = async (absPath: string): Promise<Fragment> => {
  const fileExt = path.extname(absPath);

  if (['.js', '.ts'].includes(fileExt)) {
    // Using /* @vite-ignore */ is necessary for dynamic imports where the
    // exact path isn't known statically.
    // Ensure this works with your build tool configuration.
    // Consider security implications if filePath could be user-influenced.
    const module = await import(/* @vite-ignore */ absPath);
    return module.default; // Assuming default export contains the content
  }

  const fileContent = await fs.readFile(absPath, 'utf-8');

  if (fileExt === '.md') {
    const { data, content: body } = matter(fileContent);
    // Return frontmatter data and raw markdown content separately
    // The parsing of 'markdown' happens later in processVirtualComponent
    // if needed
    return { ...data, body };
  }
  if (['.yml', '.yaml'].includes(fileExt)) {
    return yaml.load(fileContent) as Fragment;
  }
  if (fileExt === '.json') {
    return JSON.parse(fileContent);
  }

  // Should not happen if called correctly, but acts as a safeguard.
  throw new Error(
    `Unsupported file extension: '${fileExt}' for file: ${absPath}`
  );
};

const toAbsolutePath = (localPath: string, config: Config): string => {
  if (!config.root) {
    throw new Error('The config.root property has not been set.');
  }
  const fullPath = path.join(config.contentRoot, localPath);
  const absolutePath = path.resolve(config.root, fullPath);

  return absolutePath;
};

// --- Component Processing ---

/**
 * Processes components marked as 'virtual', typically involving markdown
 * parsing.
 * @param content The component content object.
 * @param config The application configuration object
 * (needed by parseComponentContent if it's refactored).
 * @returns Processed component content, potentially with HTML rendered from
 * markdown.
 */
const processVirtualComponent = async (
  content: SourceComponentContent,
  config: Config
): Promise<SourceComponentContent> => {
  // Check if there's markdown content to parse
  if ('markdown' in content && typeof content.markdown === 'string') {
    try {
      // Assuming parseComponentContent now accepts config if needed, or uses
      // options from content
      // Pass necessary options if parseComponentContent requires them
      const parsedContent = await parseComponentContent(content, config);
      return parsedContent;
    } catch (error) {
      console.error(
        `Error parsing markdown for virtual component '${content.component || JSON.stringify(content).slice(0, 100)}':`,
        error
      );
      // Decide how to handle parsing errors: return original, throw, etc.
      // Returning original content might be safer for build processes
      return content;
    }
  }
  // If no markdown, return the content as is
  return content;
};

// --- Exported Functions ---

// For testing internal logic if needed, though testing via exported functions is preferred
export const __test__ = { loadAndAttachFragments };
