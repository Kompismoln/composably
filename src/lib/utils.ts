import type { ContentTraverser, Fragment } from './types.d.ts';

/* Take an anything and traverse all objects and arrays.
 * Call callback on non-empty objects when filter returns true.
 */
export const contentTraverser: ContentTraverser = async ({
  obj,
  callback,
  filter
}) => {
  if (Array.isArray(obj)) {
    const results = await Promise.all(
      obj.map((item) => contentTraverser({ obj: item, filter, callback }))
    );
    const newArr = results.flat() as Fragment[];
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
        if (typeof item !== 'object' || item === null) {
          return [key, item];
        }
        const newItem = await contentTraverser({
          obj: item as Fragment | Fragment[],
          filter,
          callback
        });
        return [key, newItem];
      })
    );
    newObj = Object.fromEntries(entries);

    return newObj;
  }
  return obj;
};

export const shortHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = (hash << 5) - hash + str.charCodeAt(i);
  return ('0000' + (hash >>> 0).toString(36)).slice(-4);
};
