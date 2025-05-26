import matter from 'gray-matter';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';
import { parseComponentContent } from './parsers.js';
import { contentTraverser, toAbsolutePath } from './utils.js';
import { colocate } from './validators.js';
import {
  PageNotFoundError,
  FileNotFoundError,
  UnsupportedFileExtensionError,
  UnlikelyCodePathError
} from './errors.js';

import type {
  Config,
  Fragment,
  ComponentValidator,
  SourcePageContent,
  SourceComponentContent
} from './types.d.ts';

export const filetypes = ['js', 'ts', 'json', 'yaml', 'yml', 'md'];

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
    let fragment: Fragment | null = null;

    if (!filetypes.includes(fileExt.slice(1))) {
      throw new UnsupportedFileExtensionError(fileExt);
    }

    if (['.js', '.ts'].includes(fileExt)) {
      let module;
      try {
        module = await import(/* @vite-ignore */ absPath);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ERR_MODULE_NOT_FOUND'
        ) {
          throw new FileNotFoundError(absPath);
        }
        throw error;
      }
      if (typeof module.default === 'function') {
        fragment = module.default(this.reportFileDependency) as Fragment;
      } else {
        fragment = module.default as Fragment;
      }
    } else {
      let fileContent;
      try {
        fileContent = await fs.readFile(absPath, 'utf-8');
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          throw new FileNotFoundError(absPath);
        }
        throw error;
      }

      if (fileExt === '.md') {
        const { data, content: body } = matter(fileContent);
        fragment = { ...data, body };
      }
      if (['.yml', '.yaml'].includes(fileExt)) {
        fragment = yaml.load(fileContent) as Fragment;
      }
      if (fileExt === '.json') {
        fragment = JSON.parse(fileContent);
      }
    }

    if (fragment === null) {
      throw new UnlikelyCodePathError(this);
    }

    this.reportFileDependency(absPath);
    return fragment;
  }

  /**
   * Find and parse a content file by trying different extensions.
   * Uses the instance's parseFileContent method.
   * @param localPath Relative path within contentRoot (without extension).
   * @returns Parsed the path and content from the first matching file found.
   * @throws PageNotFoundError if no matching file is found.
   */
  private async findAndParseContentFile(localPath: string): Promise<Fragment> {
    localPath ||= this.config.indexFile;

    for (const ext of filetypes) {
      const absPath = `${toAbsolutePath(localPath, this.config)}.${ext}`;
      try {
        const content = await this.parseFileContent(absPath);
        return content;
      } catch (error) {
        if (error instanceof FileNotFoundError) {
          continue;
        }
        throw error;
      }
    }
    throw new PageNotFoundError(localPath);
  }

  /**
   * Recursively load and merge fragment files referenced in an object.
   * Uses the instance's parseFileContent method.
   * @param obj The object potentially containing fragment references.
   * @returns A Promise resolving to a new object with fragments loaded.
   */
  private async loadAndAttachFragments(obj: Fragment): Promise<Fragment> {
    let currentResult: Fragment = { ...obj };

    if ('_' in currentResult && typeof currentResult._ === 'string') {
      const absPath = toAbsolutePath(currentResult._, this.config);
      const fragmentContent = await this.parseFileContent(absPath);

      delete currentResult._;
      currentResult = { ...fragmentContent, ...currentResult };
    }

    const processedFragments: Fragment = {};
    const keys = Object.keys(currentResult);

    for (const key of keys) {
      if (
        key.startsWith('_') &&
        key.length > 1 &&
        typeof currentResult[key] === 'string'
      ) {
        const newKey = key.slice(1); // Remove the leading underscore

        const absPath = toAbsolutePath(currentResult[key], this.config);
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
    if ('markdown' in content && typeof content.markdown === 'string') {
      const parsedContent = await parseComponentContent(content, this.config);
      this.reportVirtualComponent(parsedContent);
      return parsedContent;
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
      callback: (obj) => this.loadAndAttachFragments(obj)
    })) as SourcePageContent;

    // 2. Validate and transform regular components based on schema
    pageData = (await contentTraverser({
      obj: pageData,
      filter: (obj) =>
        typeof obj?.component === 'string' &&
        !obj.component.startsWith(this.config.componentPrefix),
      callback: (obj) =>
        this.processComponentValidation(obj as SourceComponentContent)
    })) as SourcePageContent;

    // 3. Process virtual components (e.g., parse markdown) AND trigger callback
    pageData = (await contentTraverser({
      obj: pageData,
      filter: (obj) =>
        typeof obj?.component === 'string' &&
        obj.component.startsWith(this.config.componentPrefix),
      callback: async (obj) => {
        const processedComp = await this.processVirtualComponent(
          obj as SourceComponentContent
        );
        return processedComp;
      }
    })) as SourcePageContent;

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
  const pattern = `**/*.@(${filetypes.join('|')})`;

  const cwd = toAbsolutePath('/', config);

  const result = globSync(pattern, { cwd })
    .filter((filePath: string) => path.basename(filePath)[0] !== '_')
    .map((filePath: string) => {
      const { dir, name } = path.parse(filePath);
      const sitePath = path.join(dir, name);

      return sitePath === config.indexFile ? '' : sitePath.replace(/\\/g, '/');
    });

  return result;
};

// --- Test Export ---
export const __test__ = { ContentLoader };
