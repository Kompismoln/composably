import type { Root, Heading } from 'mdast';
import type { VFile } from 'vfile';
export default function parseHeadings(): (tree: Root, file: VFile) => void;
export declare function headerId(node: Heading): string | undefined;
