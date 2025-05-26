import { default as Debug } from 'debug';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverContentPaths, loadContent } from './content.js';
import { UnlikelyCodePathError } from './errors.js';

import type {
  SourceComponentContent,
  Config,
  SourcePageContent
} from './types.d.ts';

const logCache = Debug('composably:cache');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pageCache = new Map<
  string,
  {
    promise: Promise<string>;
    sourceFiles: Set<string>;
  }
>();

export const virtualComponentCache = new Map<
  string,
  {
    data: SourceComponentContent;
    sourceEntryPath: string;
  }
>();

const fileToContentEntries = new Map<string, Set<string>>();
const entryToVirtualComponents = new Map<string, Set<string>>();
let entries: Set<string> | null = null;

export async function virtualPageSource(
  entryPath: string,
  config: Config
): Promise<string> {
  if (pageCache.has(entryPath)) {
    logCache(`[CACHE HIT] Returning cached page source for ${entryPath}`);
    return pageCache.get(entryPath)!.promise;
  }
  logCache(`[CACHE MISS] Generating page source for ${entryPath}`);

  const currentSourceFiles = new Set<string>();
  const generatedVirtualComponents = new Set<string>();

  const processingPromise: Promise<string> = loadContent(
    entryPath,
    config,
    // Virtual Component Callback
    (processedVirtualComponent) => {
      const vcId = processedVirtualComponent.component;
      logCache(`Caching virtual component: ${vcId} from entry: ${entryPath}`);
      virtualComponentCache.set(vcId, {
        data: processedVirtualComponent,
        sourceEntryPath: entryPath
      });
      generatedVirtualComponents.add(vcId);
    },
    // File Dependency Callback
    (absolutePath) => {
      let existingEntries = fileToContentEntries.get(absolutePath);
      if (!existingEntries) {
        existingEntries = new Set();
        fileToContentEntries.set(absolutePath, existingEntries);
      }
      if (!existingEntries.has(entryPath)) {
        logCache(
          `Registering dependency: ${entryPath || '/'} -> ${absolutePath}`
        );
        existingEntries.add(entryPath);
        currentSourceFiles.add(absolutePath);
      } else {
        logCache(
          `Skipping duplicate dependency registration: ${entryPath || '/'} -> ${absolutePath}`
        );
      }
    }
  )
    .then(async (pageContent: SourcePageContent) => {
      logCache(
        `Successfully loaded content for ${entryPath}, now transforming to string.`
      );
      try {
        const code = `export default async () => (${JSON.stringify(pageContent)});`;

        return code.replace(/"component":"([^"]+)"/g, (_, compPath) => {
          const importPath = compPath.startsWith('composably:component/')
            ? compPath
            : `/${config.componentRoot}/${compPath}.svelte`;
          return `"component":(await import('${importPath}')).default`;
        });
      } catch (transformError) {
        logCache(
          `Error during page content transformation for ${entryPath}:`,
          transformError
        );

        throw transformError;
      }
    })
    .catch((error) => {
      logCache(
        `Error in content processing pipeline for ${entryPath}. Cleaning up. Error:`,
        error
      );

      pageCache.delete(entryPath);
      currentSourceFiles.forEach((f) =>
        fileToContentEntries.get(f)?.delete(entryPath)
      );
      generatedVirtualComponents.forEach((vcId) =>
        virtualComponentCache.delete(vcId)
      );
      entryToVirtualComponents.delete(entryPath);

      throw error;
    });

  pageCache.set(entryPath, {
    promise: processingPromise,
    sourceFiles: currentSourceFiles
  });

  entryToVirtualComponents.set(entryPath, generatedVirtualComponents);

  logCache(
    `Returning processing promise for ${entryPath} (to be awaited by Vite's load hook)`
  );
  return processingPromise;
}

export function getEntries(config: Config, refresh = false): Set<string> {
  if (refresh || !entries) {
    entries = new Set(discoverContentPaths(config));
  }
  return entries ?? new Set();
}

export function virtualContentSource(config: Config) {
  const entriesSet = getEntries(config, true);
  const entryList = Array.from(entriesSet);

  const cases = entryList
    .map(
      (p) =>
        `case '${p}': return (await import('composably:content/${p}')).default();`
    )
    .join('\n');

  const entryNames = `[${entryList.map((e) => `'${e}'`).join(',')}]`;

  return [
    `import { ContentEntryNotFoundError } from '${path.posix.join(__dirname, 'errors.ts')}';`,
    `export default async function loadPageContent(path) { switch (path) {`,
    `${cases}`,
    `default: throw new ContentEntryNotFoundError(path, ${entryNames});`,
    `}}`
  ].join('\n');
}

export function virtualComponentSource(id: string) {
  const cachedVC = virtualComponentCache.get(id);

  if (!cachedVC) {
    console.error(`Virtual component data not found in cache for: ${id}`);
    throw new UnlikelyCodePathError(id);
  }

  const { component: _, ...props } = cachedVC.data;
  const propKeys = Object.keys(props).filter((k) => k !== 'html');
  const propString = `{ ${propKeys.join(', ')} } = $props();`;
  const scriptString =
    propKeys.length > 0 ? `<script>\nlet ${propString};\n</script>\n` : '';

  return {
    code: `${scriptString}\n${props.html || ''}`,
    map: { version: 3, sources: [], names: [], mappings: '' } // Basic sourcemap
  };
}

export function invalidateAndGetAffectedItems(filePath: string): {
  affectedEntryPaths: string[];
  affectedVirtualComponentIds: string[];
} {
  const affectedEntryPaths: string[] = [];
  const affectedVirtualComponentIds: string[] = [];
  logCache(`Invalidation process started for file: ${filePath}`);

  const entriesDependingOnThisFile = fileToContentEntries.get(filePath);

  if (entriesDependingOnThisFile && entriesDependingOnThisFile.size > 0) {
    logCache(
      `File ${filePath} affects entries:`,
      Array.from(entriesDependingOnThisFile)
    );
    entriesDependingOnThisFile.forEach((entryPath) => {
      if (pageCache.delete(entryPath)) {
        logCache(`Invalidated page cache for entry: ${entryPath}`);
        affectedEntryPaths.push(entryPath);
      }
      const vcsGeneratedByThisEntry = entryToVirtualComponents.get(entryPath);
      if (vcsGeneratedByThisEntry) {
        logCache(
          `Entry ${entryPath} generated VCs:`,
          Array.from(vcsGeneratedByThisEntry)
        );
        vcsGeneratedByThisEntry.forEach((vcId) => {
          if (virtualComponentCache.delete(vcId)) {
            logCache(`Invalidated virtual component cache for: ${vcId}`);
            affectedVirtualComponentIds.push(vcId);
          }
        });
        entryToVirtualComponents.delete(entryPath);
        logCache(`Cleared entryToVirtualComponents for entry: ${entryPath}`);
      }
    });
    fileToContentEntries.delete(filePath);
    logCache(`Cleared fileToContentEntries for changed file: ${filePath}`);
  } else {
    logCache(
      `File ${filePath} does not directly affect any known content entries.`
    );
  }
  return { affectedEntryPaths, affectedVirtualComponentIds };
}
