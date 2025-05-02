import type { ComponentContent, Config } from './types.d.ts';
/**
 * Options for customizing the parsing process.
 */
export interface ParseOptions {}
/**
 * Parses designated fields within a ComponentContent object.
 * Currently focuses on parsing a 'markdown' field into an 'html' field,
 * applying various transformations and plugin processing.
 *
 * @param content The input ComponentContent object. Expected to have a field
 * (default 'markdown') containing the markdown string, and potentially
 * an 'config' field for metadata and a 'parent' field for property inheritance.
 * @param config Optional configuration for the parser, including injectable plugins
 * and field names.
 * @returns A Promise resolving to the modified ComponentContent object with parsed HTML,
 * extracted data, and merged properties.
 * @throws Throws an error if parsing fails.
 */
export declare const parseComponentContent: (
  content: ComponentContent,
  config: Config
) => Promise<ComponentContent>;
