import matter from 'gray-matter';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';
import { parseComponentContent } from './parsers.js';
import { contentTraverser } from './utils.js';
import { colocate } from './validators.js';
const filetypes = ['js', 'ts', 'json', 'yaml', 'yml', 'md'];
/**
 * Loads, parses, and processes content for a given site path, returning a Promise
 * for the final page content. It uses a callback to report processed virtual
 * components *during* its execution, enabling lazy loading while still capturing
 * necessary side data.
 *
 * @param searchPath The site path (e.g., 'about/team' or '').
 * @param config The application configuration object.
 * @param reportVirtualComponent A callback function invoked whenever a virtual
 * component is successfully processed. It receives the processed component content.
 * @returns A Promise resolving to the fully processed page data (type PageContent).
 */
export const loadContent = async (searchPath, config, reportVirtualComponent, reportFileDependency) => {
    // Return type is the Promise for the main content
    const fileSearchPath = searchPath === '' ? config.indexFile : searchPath;
    // Start by finding the root content file
    let { filePath, content: pageData } = await findAndParseContentFile(fileSearchPath, config);
    // Report the main file as a dependency
    if (!config.root) {
        throw new Error('The config.root property has not been set.');
    }
    reportFileDependency(path.resolve(config.root, filePath));
    // Apply transformations using the contentTraverser utility.
    // The traverser modifies pageData in place or returns a new object for pageData
    // to be reassigned to.
    // 1. Load and attach fragments recursively
    pageData = await contentTraverser({
        obj: pageData,
        filter: (obj) => typeof obj === 'object' &&
            obj !== null &&
            Object.keys(obj).some((key) => key.startsWith('_')),
        callback: (obj) => loadAndAttachFragments(obj, config, reportFileDependency)
    });
    // 2. Validate and transform regular components based on schema
    pageData = await contentTraverser({
        obj: pageData,
        filter: (obj) => typeof obj?.component === 'string' &&
            !obj.component.startsWith('composably:'),
        callback: (obj) => {
            const validator = (config.validator || colocate);
            return validator(obj, reportFileDependency, config);
        }
    });
    // 3. Process virtual components (e.g., parse markdown) AND trigger callback
    pageData = await contentTraverser({
        obj: pageData,
        filter: (obj) => typeof obj?.component === 'string' &&
            obj.component.startsWith('composably:'),
        // Callback: Process the virtual component AND call the provided handler
        callback: async (obj) => {
            const processedComp = await processVirtualComponent(obj, config);
            // Call the callback with the processed component
            // Ensure processedComp has the necessary structure (e.g., component name)
            reportVirtualComponent(processedComp);
            // Return the processed component to potentially update the tree
            return processedComp;
        }
    });
    // After all traversals, the final pageData is ready.
    return pageData; // Assert or validate final type
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
export const discoverContentPaths = (config) => {
    const pattern = path.join(config.contentRoot, 
    // Match any file with the specified extensions
    `**/*.@(${filetypes.join('|')})`);
    try {
        return (globSync(pattern)
            // Filter out files starting with underscore (fragments)
            .filter((filePath) => path.basename(filePath)[0] !== '_')
            // Map absolute path to relative site path
            .map((filePath) => {
            const relativePath = path.relative(config.contentRoot, filePath);
            const { dir, name } = path.parse(relativePath);
            const sitePath = path.join(dir, name);
            // Handle index file mapping (e.g., 'index' -> '')
            return sitePath === config.indexFile
                ? ''
                : sitePath.replace(/\\/g, '/'); // Normalize to forward slashes
        }));
    }
    catch (error) {
        console.error(`Error discovering content paths in ${config.contentRoot}:`, error);
        return []; // Return empty array on error
    }
};
// --- File Parsing Logic ---
/**
 * Parse file content based on its extension.
 * @param filePath Absolute path to the file.
 * @param fileExt File extension (e.g., '.md').
 * @returns Parsed data from the file.
 */
const parseFileContent = async (filePath) => {
    const fileExt = path.extname(filePath);
    if (['.js', '.ts'].includes(fileExt)) {
        // Using /* @vite-ignore */ is necessary for dynamic imports where the
        // exact path isn't known statically.
        // Ensure this works with your build tool configuration.
        // Consider security implications if filePath could be user-influenced.
        const module = await import(/* @vite-ignore */ filePath);
        return module.default; // Assuming default export contains the content
    }
    const fileContent = await fs.readFile(filePath, 'utf-8');
    if (fileExt === '.md') {
        const { data, content: body } = matter(fileContent);
        // Return frontmatter data and raw markdown content separately
        // The parsing of 'markdown' happens later in processVirtualComponent
        // if needed
        return { ...data, body };
    }
    if (['.yml', '.yaml'].includes(fileExt)) {
        return yaml.load(fileContent);
    }
    if (fileExt === '.json') {
        return JSON.parse(fileContent);
    }
    // Should not happen if called correctly, but acts as a safeguard.
    throw new Error(`Unsupported file extension: '${fileExt}' for file: ${filePath}`);
};
/**
 * Find and parse a content file by trying different extensions.
 * @param searchPath Relative path within contentRoot (without extension).
 * @param config The application configuration object.
 * @returns Parsed content from the first matching file found.
 * @throws Error if no matching file is found.
 */
const findAndParseContentFile = async (searchPath, config) => {
    for (const ext of filetypes) {
        const filePath = path.join(config.contentRoot, `${searchPath}.${ext}`);
        try {
            // Check existence first to provide clearer ENOENT handling if needed,
            // though readFile will also throw ENOENT. Stat adds an extra check.
            // await fs.access(filePath); // Optional: uncomment if finer-grained
            // error handling is needed
            const content = await parseFileContent(filePath);
            return { filePath, content };
        }
        catch (error) {
            // Continue loop only if file not found or module import failed
            // specifically because of missing file
            if (['ENOENT', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) {
                continue;
            }
            // Log or handle other errors more specifically if needed
            console.error(`Error parsing file ${filePath}:`, error);
            throw error; // Re-throw other errors (permissions, syntax errors, etc.)
        }
    }
    // If loop completes without finding a file
    throw new Error(`Content file not found for path: '${searchPath}' (checked extensions: ${filetypes.join(', ')}) in ${config.contentRoot}`);
};
// --- Fragment Handling ---
/**
 * Recursively load and merge fragment files referenced in an object.
 * Fragments are referenced by keys starting with '_'.
 * If the key is exactly '_', its content is merged into the parent.
 * Otherwise, the content is attached to a property named without the
 * underscore.
 * Note: Uses spread syntax to create new objects, aiming for immutability.
 *
 * @param obj The object potentially containing fragment references.
 * @param config The application configuration object.
 * @returns A new object with fragments loaded and merged.
 */
const loadAndAttachFragments = async (obj, config, reportFileDependency // Callback function signature
) => {
    // Base case: If it's not an object worth traversing, return as is.
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }
    let currentResult = { ...obj }; // Start with a shallow copy
    const contentPath = (fragmentPath) => {
        const filePath = path.join(config.contentRoot, fragmentPath);
        reportFileDependency(path.resolve(config.root, filePath));
        return filePath;
    };
    // 1. Handle root fragment reference ('_')
    if ('_' in currentResult && typeof currentResult._ === 'string') {
        const fragmentPath = contentPath(currentResult._);
        let fragmentContent = await parseFileContent(fragmentPath);
        // Recursively process fragments within the loaded fragment
        fragmentContent = await loadAndAttachFragments(fragmentContent, config, reportFileDependency);
        // Merge the fragment content, letting currentResult properties override
        // fragment properties if keys clash
        currentResult = { ...fragmentContent, ...currentResult };
        delete currentResult._; // Remove the reference key
    }
    // 2. Handle named fragment references ('_key')
    const fragmentKeys = Object.keys(currentResult).filter((key) => key.startsWith('_') &&
        key.length > 1 &&
        typeof currentResult[key] === 'string');
    if (fragmentKeys.length === 0) {
        return currentResult; // No named fragments to process
    }
    // Create a temporary object to hold the processed named fragments
    const processedFragments = {};
    for (const key of fragmentKeys) {
        const fragmentPath = contentPath(currentResult[key]);
        const newKey = key.slice(1); // Remove the leading underscore
        let fragmentContent = await parseFileContent(fragmentPath);
        // Recursively process fragments within the loaded fragment
        fragmentContent = await loadAndAttachFragments(fragmentContent, config, reportFileDependency);
        // Store processed fragment under the new key
        processedFragments[newKey] = fragmentContent;
        // Remove the reference key from the current result
        delete currentResult[key];
    }
    // Merge the processed fragments with the current result.
    // Ensure properties in currentResult take precedence over newly attached
    // fragments if keys clash.
    currentResult = { ...processedFragments, ...currentResult };
    return currentResult;
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
const processVirtualComponent = async (content, config) => {
    // Check if there's markdown content to parse
    if ('markdown' in content && typeof content.markdown === 'string') {
        try {
            // Assuming parseComponentContent now accepts config if needed, or uses
            // options from content
            // Pass necessary options if parseComponentContent requires them
            const parsedContent = await parseComponentContent(content, config);
            return parsedContent;
        }
        catch (error) {
            console.error(`Error parsing markdown for virtual component '${content.component || JSON.stringify(content).slice(0, 100)}':`, error);
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
