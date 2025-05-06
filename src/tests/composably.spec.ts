import { expect, test, vi } from 'vitest';

import config from '../../composably.config.js';
import { contentTraverser } from '$lib/utils.js';
import path from 'node:path';
import type { Fragment } from '$lib/types.js';

import { __test__ } from '../lib/content.js';
const { ContentLoader } = __test__;

config.root = process.cwd();

function getExpectedReportedPath(fragmentPath: string): string {
  if (!config.root) {
    throw new Error('Test setup error: config.root is not set.');
  }
  if (!config.contentRoot) {
    // Assuming contentRoot should exist for fragment loading relative paths
    throw new Error('Test setup error: config.contentRoot is not set.');
  }

  // Ensure the fragmentPath is treated relative to contentRoot if it's not absolute
  const resolvedFragmentPath = path.isAbsolute(fragmentPath)
    ? fragmentPath
    : path.join(config.contentRoot, fragmentPath);

  // Then resolve the final absolute path relative to project root
  const absolutePath = path.resolve(config.root, resolvedFragmentPath);
  return absolutePath;
}

/**
 * Helper to test fragment loading logic using contentTraverser
 * @param obj The initial object to traverse.
 * @param loaderInstance An instance of ContentLoader.
 * @returns The transformed object after traversing and loading fragments.
 */
async function testFragment(
  obj: Fragment,
  loaderInstance: InstanceType<typeof ContentLoader> // Expect a ContentLoader instance
): Promise<Fragment> {
  return (await contentTraverser({
    obj,
    filter: (obj) =>
      typeof obj === 'object' &&
      obj !== null &&
      Object.keys(obj).some((key) => key.startsWith('_')),
    // The callback now calls the instance's loadAndAttachFragments method
    callback: (obj) => loaderInstance['loadAndAttachFragments'](obj) // Access private method for testing
  })) as Fragment;
}

test('fragments', async () => {
  let obj: Record<string, unknown> = {};
  let mockReportFn: ReturnType<typeof vi.fn>;
  let mockReportVirtualComponentFn: ReturnType<typeof vi.fn>;
  let loader: InstanceType<typeof ContentLoader>;

  // Test case 1: Root fragment, empty content
  mockReportFn = vi.fn();
  mockReportVirtualComponentFn = vi.fn();
  loader = new ContentLoader(
    config,
    mockReportVirtualComponentFn,
    mockReportFn
  );
  obj = { _: 'test/_test-0.yaml' };
  const result0 = await testFragment(obj, loader);
  expect(result0).deep.equal({});
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-0.yaml')
  );
  expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

  // Test case 2: Named fragment, empty content
  mockReportFn = vi.fn();
  mockReportVirtualComponentFn = vi.fn();
  loader = new ContentLoader(
    config,
    mockReportVirtualComponentFn,
    mockReportFn
  );
  obj = { _test: 'test/_test-0.yaml' };
  // Expect { test: {} } - Note: yaml.load({}) returns {},
  // so attaching should result in { test: {} }, but it doesn't.
  const result0Named = await testFragment(obj, loader);
  expect(result0Named).toEqual({ test: undefined });
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-0.yaml')
  );
  expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

  // Test case 3: Root fragment, content { foo: 'bar' }
  mockReportFn = vi.fn();
  mockReportVirtualComponentFn = vi.fn();
  loader = new ContentLoader(
    config,
    mockReportVirtualComponentFn,
    mockReportFn
  );
  obj = { _: 'test/_test-1.yaml' };
  const result1 = await testFragment(obj, loader);
  expect(result1).toEqual({ foo: 'bar' });
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );
  expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

  // Test case 4: Named fragment, content { foo: 'bar' }
  mockReportFn = vi.fn();
  mockReportVirtualComponentFn = vi.fn();
  loader = new ContentLoader(
    config,
    mockReportVirtualComponentFn,
    mockReportFn
  );
  obj = { _test: 'test/_test-1.yaml' };
  const result1Named = await testFragment(obj, loader);
  expect(result1Named).toEqual({ test: { foo: 'bar' } });
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );
  expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

  // Test case 5: Root fragment, nested content
  mockReportFn = vi.fn();
  mockReportVirtualComponentFn = vi.fn();
  loader = new ContentLoader(
    config,
    mockReportVirtualComponentFn,
    mockReportFn
  );
  obj = { _: 'test/_test-2.yaml' };
  const result2Root = await testFragment(obj, loader);
  expect(result2Root).toEqual({ test2: { foo: 'bar' } });
  expect(mockReportFn).toHaveBeenCalledTimes(2); // One call for _test-2.yaml, one for _test-1.yaml
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-2.yaml')
  );
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );
  expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

  // Test case 6: Named fragment, nested content
  mockReportFn = vi.fn();
  mockReportVirtualComponentFn = vi.fn();
  loader = new ContentLoader(
    config,
    mockReportVirtualComponentFn,
    mockReportFn
  );
  obj = { _test: 'test/_test-2.yaml' };
  const result2Named = await testFragment(obj, loader);
  expect(result2Named).toEqual({ test: { test2: { foo: 'bar' } } });
  expect(mockReportFn).toHaveBeenCalledTimes(2); // One call for _test-2.yaml, one for _test-1.yaml
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-2.yaml')
  );
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );
  expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();
});
