import type { ContentTraverser } from './types.d.ts';

/* Take an anything and traverse all objects and arrays.
 * Call callback on non-empty objects when filter returns true.
 */
export const contentTraverser: ContentTraverser = async ({
  obj,
  callback,
  filter
}) => {
  if (Array.isArray(obj)) {
    const newArr = await Promise.all(
      obj.map((item) => contentTraverser({ obj: item, filter, callback }))
    );
    return newArr;
  }
  if (typeof obj === 'object' && obj !== null) {
    if (obj instanceof Date) {
      return obj;
    }

    let newObj = obj;
    if (filter(obj)) {
      newObj = await callback(obj);
    }

    const entries = await Promise.all(
      Object.entries(newObj).map(async ([key, item]) => {
        if (typeof item !== 'object' || item !== null || !Array.isArray(item)) {
          return [key, item];
        }
        const newItem = await contentTraverser({
          obj: item,
          filter,
          callback
        });
        return [key, newItem];
      })
    );

    return Object.fromEntries(entries);
  }
  return obj;
};

export const shortHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = (hash << 5) - hash + str.charCodeAt(i);
  return ('0000' + (hash >>> 0).toString(36)).slice(-4);
};
