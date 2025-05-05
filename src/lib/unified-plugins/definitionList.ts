// === Augmentation End ===

// Now, the rest of your plugin code...
import {
  defListFromMarkdown,
  defListToMarkdown
} from 'mdast-util-definition-list';
import { defList } from 'micromark-extension-definition-list';
import type { Processor } from 'unified';

export { defListHastHandlers } from 'mdast-util-definition-list';
export { defListHastToMdast } from 'hast-util-definition-list';

export function remarkDefinitionList(this: Processor): void {
  // `data` will now be correctly typed thanks to the augmentation above
  const data = this.data();

  // TypeScript now knows about these properties without the hack
  const micromarkExtensions =
    data.micromarkExtensions ?? (data.micromarkExtensions = []);
  const fromMarkdownExtensions =
    data.fromMarkdownExtensions ?? (data.fromMarkdownExtensions = []);
  const toMarkdownExtensions =
    data.toMarkdownExtensions ?? (data.toMarkdownExtensions = []);

  micromarkExtensions.push(defList);
  fromMarkdownExtensions.push(defListFromMarkdown);
  toMarkdownExtensions.push(defListToMarkdown);
}

export default remarkDefinitionList;
