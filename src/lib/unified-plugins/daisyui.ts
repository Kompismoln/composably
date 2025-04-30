import type { Root } from 'hast';
import { classnames } from 'hast-util-classnames';
import { visit } from 'unist-util-visit';

export default function daisyUI() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'input') {
        if (node.properties?.type === 'checkbox') {
          node.properties.disabled = false;
          classnames(node, ['checkbox', 'checkbox-primary']);
        }
      }
      if (node.tagName === 'a') {
        classnames(node, ['link']);
      }
    });
  };
}
