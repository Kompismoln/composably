import {
  defListFromMarkdown,
  defListToMarkdown
} from 'mdast-util-definition-list';
import { defList } from 'micromark-extension-definition-list';
import type { Processor } from 'unified';

export { defListHastHandlers } from 'mdast-util-definition-list';
export { defListHastToMdast } from 'hast-util-definition-list';

export function remarkDefinitionList(this: Processor): void {
  const data = this.data();

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
