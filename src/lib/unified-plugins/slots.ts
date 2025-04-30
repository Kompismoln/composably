import { h } from 'hastscript';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

export default function slots() {
  return (tree: Root) => {
    visit(tree, 'containerDirective', (node) => {
      if (node.name !== 'slot') return;

      const data = node.data || (node.data = {});
      const id = node.attributes?.id;

      const hast = h('div', { 'data-slot': id });

      data.hName = hast.tagName;
      data.hProperties = hast.properties;
    });
    visit(tree, 'leafDirective', (node) => {
      const data = node.data || (node.data = {});

      const hast = h('svelte-component', { 'data-slot': node.name });

      data.hName = hast.tagName;
      data.hProperties = hast.properties;
    });
  };
}
