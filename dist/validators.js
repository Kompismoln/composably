import fs from 'node:fs/promises';
import { c } from 'composably/schemas';
export const colocate = async (content, reportFileDependency, config) => {
    const componentFilePath = `${config.componentRoot}/${content.component}.svelte`;
    const schema = await getSchema(componentFilePath);
    if (!schema?.spa) {
        return content;
    }
    const result = await schema.spa(content);
    if (!result.success) {
        throw new Error(`Component '${content.component}' failed validation: ${result.error?.message || 'Unknown validation error'}`);
    }
    reportFileDependency(componentFilePath);
    return result.data;
};
const getSchema = async (path) => {
    const code = await fs.readFile(path, 'utf8');
    const match = code.match(/export\s+const\s+schema\s*=\s*(c\.content\(([\s\S]*?)\));/);
    if (!match)
        return;
    const schemaDefinition = match[1];
    return new Function('c', `return ${schemaDefinition}`)(c);
};
