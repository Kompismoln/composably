/* Take an anything and traverse all objects and arrays.
 * Call callback on non-empty objects when filter returns true.
 */
export const contentTraverser = async ({ obj, callback, filter }) => {
    if (Array.isArray(obj)) {
        const newArr = await Promise.all(obj.map((item) => contentTraverser({ obj: item, filter, callback })));
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
        newObj = await Promise.all(Object.entries(newObj).map(async ([key, item]) => {
            const newItem = await contentTraverser({
                obj: item,
                filter,
                callback
            });
            return [key, newItem];
        }));
        return Object.fromEntries(newObj);
    }
    return obj;
};
export const contentTraverserSync = ({ obj, callback, filter }) => {
    if (Array.isArray(obj)) {
        const newArr = obj.map((item) => contentTraverserSync({ obj: item, filter, callback }));
        return newArr;
    }
    if (typeof obj === 'object' && obj !== null) {
        if (obj instanceof Date) {
            return obj;
        }
        let newObj = obj;
        if (filter(obj)) {
            newObj = callback(obj);
        }
        newObj = Object.entries(newObj).map(async ([key, item]) => {
            const newItem = contentTraverserSync({
                obj: item,
                filter,
                callback
            });
            return [key, newItem];
        });
        return Object.fromEntries(newObj);
    }
    return obj;
};
export const shortHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++)
        hash = (hash << 5) - hash + str.charCodeAt(i);
    return ('0000' + (hash >>> 0).toString(36)).slice(-4);
};
