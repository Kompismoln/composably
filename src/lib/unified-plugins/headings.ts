import { visit } from 'unist-util-visit';
import type { Root, Heading } from 'mdast';
import type { VFile } from 'vfile';
import { toString } from 'mdast-util-to-string';
import type { HeadingData } from '../types.d.ts';

/* Do heading stuff
 * - Add id
 * - Decrease depth
 * - Store heading in data for TOC
 */
export default function parseHeadings() {
  return (tree: Root, file: VFile) => {
    const headings: HeadingData[] = [];

    visit(tree, 'heading', (node) => {
      const id = headerId(node);
      headings.push({
        depth: node.depth,
        text: toString(node),
        id: id
      });
      if (file.data.meta?.options?.decreaseHeadings !== false) {
        node.depth++;
      }
    });
    file.data.props ??= {};
    file.data.props.headings = headings;
  };
}

export function headerId(node: Heading) {
  const idRegex = / {#(?<id1>[^}]+)}$| \|\|(?<id2>[^|]+)\|\|$/;
  const textNode = node.children.at(-1);
  if (textNode?.type !== 'text') {
    return;
  }

  const text = textNode.value.trimEnd();

  const matched = idRegex.exec(text);

  if (!matched || !matched.groups) {
    return;
  }

  textNode.value = text.slice(0, matched.index);

  const { id1, id2 } = matched.groups;
  const id = id1 || id2;

  node.data ??= {};
  node.data.hProperties ??= {};
  node.data.hProperties.id = id;

  return id;
}
