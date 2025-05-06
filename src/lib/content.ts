import matter from 'gray-matter';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';
import { parseComponentContent } from './parsers.js';
import { contentTraverser, toAbsolutePath } from './utils.js';
import { colocate } from './validators.js';

import type {
  Config,
  Fragment,
  ComponentValidator,
  SourcePageContent,
  SourceComponentContent
} from './types.d.ts';

const filetypes = ['js', 'ts', 'json', 'yaml', 'yml', 'md'];

class ContentLoader {
  private config: Config;
  private reportVirtualComponent: (component: SourceComponentContent) => void;
  private reportFileDependency: (filePath: string) => void;
  private validator: ComponentValidator;

  constructor(
    config: Config,
    reportVirtualComponent: (component: SourceComponentContent) => void,
    reportFileDependency: (filePath: string) => void
  ) {
    this.config = config;
    this.reportVirtualComponent = reportVirtualComponent;
    this.reportFileDependency = reportFileDependency;
    this.validator = config.validator || colocate;
  }

  /**
   * Parse file content based on its extension. Reports file dependency.
   * @param absPath Absolute path to the file.
   * @returns Parsed data from the file.
   */
  private async parseFileContent(absPath: string): Promise<Fragment> {
    const fileExt = path.extname(absPath);

    this.reportFileDependency(absPath);

    if (['.js', '.ts'].includes(fileExt)) {
      // Using /* @vite-ignore */ is necessary for dynamic imports where the
      // exact path isn't known statically.
      const module = await import(/* @vite-ignore */ absPath);
      if (typeof module.default === 'function') {
        return module.default(this.reportFileDependency) as Fragment;
      }
      return module.default as Fragment;
    }

    const fileContent = await fs.readFile(absPath, 'utf-8');

    if (fileExt === '.md') {
      const { data, content: body } = matter(fileContent);
      return { ...data, body };
    }
    if (['.yml', '.yaml'].includes(fileExt)) {
      return yaml.load(fileContent) as Fragment;
    }
    if (fileExt === '.json') {
      return JSON.parse(fileContent);
    }

    throw new Error(
      `Unsupported file extension: '${fileExt}' for file: ${absPath}`
    );
  }

  /**
   * Find and parse a content file by trying different extensions.
   * Uses the instance's parseFileContent method.
   * @param localPath Relative path within contentRoot (without extension).
   * @returns Parsed the path and content from the first matching file found.
   * @throws Error if no matching file is found.
   */
  private async findAndParseContentFile(localPath: string): Promise<Fragment> {
    localPath ||= this.config.indexFile || 'index'; // Default index logic here

    for (const ext of filetypes) {
      const absPath = `${toAbsolutePath(localPath, this.config)}.${ext}`;
      try {
        // Call the instance's parsing method. It handles the existence check
        // (by attempting to read/import) and reporting the dependency.
        const content = await this.parseFileContent(absPath);
        return content;
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          const errorCode = String((error as { code: unknown }).code);
          // Rely on ENOENT/ERR_MODULE_NOT_FOUND from parseFileContent
          if (['ENOENT', 'ERR_MODULE_NOT_FOUND'].includes(errorCode)) {
            continue; // File not found with this extension, try next
          }
        }
        // Re-throw other errors (permissions, syntax errors, etc.)
        console.error(`Error processing file ${absPath}:`, error);
        throw error;
      }
    }
    // If loop completes without finding a file
    throw new Error(
      `Content file not found for path: '${localPath}' (checked extensions: ${filetypes.join(', ')}) in ${this.config.contentRoot}`
    );
  }

  /**
   * Recursively load and merge fragment files referenced in an object.
   * Uses the instance's parseFileContent method.
   * @param obj The object potentially containing fragment references.
   * @returns A Promise resolving to a new object with fragments loaded.
   */
  private async loadAndAttachFragments(obj: Fragment): Promise<Fragment> {
    let currentResult: Fragment = { ...obj }; // Start with a shallow copy

    // 1. Handle root fragment reference ('_')
    if ('_' in currentResult && typeof currentResult._ === 'string') {
      const absPath = toAbsolutePath(currentResult._, this.config);
      // Use the instance's parser, it handles dependency reporting
      const fragmentContent = await this.parseFileContent(absPath);

      delete currentResult._;
      currentResult = { ...fragmentContent, ...currentResult };
    }

    // 2. Handle named fragment references ('_key') recursively and merge results
    const processedFragments: Fragment = {};
    const keys = Object.keys(currentResult); // Iterate over a copy of keys

    for (const key of keys) {
      if (
        key.startsWith('_') &&
        key.length > 1 &&
        typeof currentResult[key] === 'string'
      ) {
        const newKey = key.slice(1); // Remove the leading underscore

        const absPath = toAbsolutePath(currentResult[key], this.config);
        // Use the instance's parser, it handles dependency reporting
        const fragmentContent = await this.parseFileContent(absPath);

        processedFragments[newKey] = fragmentContent;
        delete currentResult[key];
      }
    }

    currentResult = { ...processedFragments, ...currentResult };
    return currentResult;
  }

  /**
   * Processes components marked as 'virtual', typically involving markdown
   * parsing. Reports virtual components via the instance callback.
   * @param content The component content object.
   * @returns Processed component content.
   */
  private async processVirtualComponent(
    content: SourceComponentContent
  ): Promise<SourceComponentContent> {
    // Check if there's markdown content to parse
    if ('markdown' in content && typeof content.markdown === 'string') {
      try {
        const parsedContent = await parseComponentContent(content, this.config);
        this.reportVirtualComponent(parsedContent);
        return parsedContent;
      } catch (error) {
        const descr = JSON.stringify(content).slice(0, 100);
        console.error(
          `Error parsing markdown for virtual component '${descr}':`,
          error
        );
        throw error;
      }
    }
    return content;
  }

  /**
   * Processes regular components using the validator.
   * Assumes validator needs reportFileDependency.
   * @param content The component content object.
   * @returns Validated/transformed component content.
   */
  private async processComponentValidation(
    content: SourceComponentContent
  ): Promise<SourceComponentContent> {
    const newObj = await this.validator(
      content,
      this.reportFileDependency,
      this.config
    );
    return newObj;
  }

  /**
   * Loads, parses, and processes content for a given site path.
   * This is the main public method.
   * @param localPath The site path (e.g., 'about/team' or '').
   * @returns A Promise resolving to the fully processed page data.
   */
  async loadContent(localPath: string): Promise<SourcePageContent> {
    const content = await this.findAndParseContentFile(localPath);
    let pageData = content as SourcePageContent;

    // 1. Load and attach fragments recursively
    pageData = (await contentTraverser({
      obj: pageData,
      filter: (obj) =>
        typeof obj === 'object' &&
        obj !== null &&
        Object.keys(obj).some((key) => key.startsWith('_')),
      // Pass the instance method as the callback
      callback: (obj) => this.loadAndAttachFragments(obj)
    })) as SourcePageContent;

    // 2. Validate and transform regular components based on schema
    pageData = (await contentTraverser({
      obj: pageData,
      filter: (obj) =>
        typeof obj?.component === 'string' &&
        !obj.component.startsWith('composably:'),
      // Pass the instance method as the callback
      callback: (obj) =>
        this.processComponentValidation(obj as SourceComponentContent)
    })) as SourcePageContent;

    // 3. Process virtual components (e.g., parse markdown) AND trigger callback
    pageData = (await contentTraverser({
      obj: pageData,
      filter: (obj) =>
        typeof obj?.component === 'string' &&
        obj.component.startsWith('composably:'),
      // Pass the instance method as the callback
      callback: async (obj) => {
        const processedComp = await this.processVirtualComponent(
          obj as SourceComponentContent
        );
        // reportVirtualComponent is called inside processVirtualComponent now
        return processedComp;
      }
    })) as SourcePageContent;

    // After all traversals, the final pageData is ready.
    return pageData;
  }
}

// The main exported function now creates and uses the loader instance
export const loadContent = async (
  localPath: string,
  config: Config,
  reportVirtualComponent: (component: SourceComponentContent) => void,
  reportFileDependency: (filePath: string) => void
): Promise<SourcePageContent> => {
  const loader = new ContentLoader(
    config,
    reportVirtualComponent,
    reportFileDependency
  );
  return loader.loadContent(localPath);
};

// --- Discovery Logic (can remain separate if synchronous) ---

/**
 * Discovers potential content entry paths within the content root.
 * Filters out fragment files (starting with '_') and maps paths for routing.
 * Assumes it runs in a context where synchronous I/O is acceptable
 * (e.g., build time discovery phase).
 *
 * @param config The application configuration object.
 * @returns An array of site paths corresponding to content files.
 */
export const discoverContentPaths = (config: Config): string[] => {
  const pattern = path.join(
    config.contentRoot,
    `**/*.@(${filetypes.join('|')})`
  );

  return globSync(pattern)
    .filter((filePath: string) => path.basename(filePath)[0] !== '_')
    .map((filePath: string) => {
      const relativePath = path.relative(config.contentRoot, filePath);
      const { dir, name } = path.parse(relativePath);
      const sitePath = path.join(dir, name);

      return sitePath === (config.indexFile || 'index')
        ? ''
        : sitePath.replace(/\\/g, '/'); // Normalize to forward slashes
    });
};

// --- Test Export ---
export const __test__ = { ContentLoader };
