import type { Root } from 'hast';
import type { Plugin } from 'unified';
import { classnames } from 'hast-util-classnames';
import { visit } from 'unist-util-visit';

const rehypeClassAdder: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h2') {
        classnames(node, ['h2-class']);
      }
    });
  };
};

export default rehypeClassAdder;
