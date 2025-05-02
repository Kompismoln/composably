import { h } from 'hastscript';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

export default function slots() {
  return (tree: Root) => {
    visit(tree, 'textDirective', (node) => {
      if (node.name !== 'rep') return;

      const data = node.data || (node.data = {});

      const hast = h(
        'span',
        { 'data-testid': 'remark-replaced' },
        'remark-replaced'
      );

      data.hName = hast.tagName;
      data.hProperties = hast.properties;
      data.hChildren = hast.children;
    });
  };
}
