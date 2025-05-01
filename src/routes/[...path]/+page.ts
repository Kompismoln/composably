import type { PageLoad } from './$types';
import content from 'composably:content';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
  if (!(params.path in content)) {
    error(404, { message: `No content file found in: '${params.path}'` });
  }
  let { default: page } = await content[params.path]();
  return await page();
};
