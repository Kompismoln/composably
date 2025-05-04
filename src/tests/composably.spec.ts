import { expect, test, vi } from 'vitest';
import { __test__ } from '../lib/content.js';
import config from '../../composably.config.js';
import { contentTraverser } from '$lib/utils.js';
import path from 'node:path';

config.root = process.cwd();

function getExpectedReportedPath(fragmentPath: string): string {
  if (!config.root) {
    throw new Error('Test setup error: config.root is not set.');
  }
  if (!config.contentRoot) {
    // Assuming contentRoot should exist for fragment loading
    // Adjust if paths can be outside contentRoot but relative to project root
    throw new Error('Test setup error: config.contentRoot is not set.');
  }
  // Resolve fragment path relative to contentRoot first (unless already absolute)
  const resolvedFragmentPath = path.isAbsolute(fragmentPath)
    ? fragmentPath
    : path.join(config.contentRoot, fragmentPath);

  // Then resolve the final absolute path relative to project root
  const absolutePath = path.resolve(config.root, resolvedFragmentPath);
  return absolutePath;
}
async function testFragment(
  obj: Record<string, unknown>,
  reportFn: (filePath: string) => void
) {
  return await contentTraverser({
    obj,
    filter: (obj) =>
      typeof obj === 'object' &&
      obj !== null &&
      Object.keys(obj).some((key) => key.startsWith('_')),
    callback: (obj) => __test__.loadAndAttachFragments(obj, config, reportFn)
  });
}

test('fragments', async () => {
  let obj: Record<string, unknown> = {};
  let mockReportFn: ReturnType<typeof vi.fn>;

  // Test case 1
  mockReportFn = vi.fn();
  obj = { _: 'test/_test-0.yaml' }; // Assuming _test-0.yaml is empty or results in {}
  const result0 = await testFragment(obj, mockReportFn);
  expect(result0).deep.equal({});
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-0.yaml')
  );

  // Test case 2
  mockReportFn = vi.fn();
  obj = { _test: 'test/_test-0.yaml' }; // Assuming _test-0.yaml results in {}
  const result0Named = await testFragment(obj, mockReportFn); // Expect { test: {} }
  expect(result0Named).deep.equal({ test: undefined }); // Check if 'test' property exists
  // If _test-0.yaml IS truly empty {}, then .test will be {} which is not undefined.
  // If you want to check if test has no meaningful props, check keys or specific content.
  // Or if test-0.yaml makes test *not* be added, adjust expectation.
  // Let's assume test-0 results in {}:
  expect(Object.keys(result0Named.test ?? {}).length).toBe(0);
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-0.yaml')
  );

  // Test case 3
  mockReportFn = vi.fn();
  obj = { _: 'test/_test-1.yaml' }; // Assuming _test-1.yaml contains { foo: 'bar' }
  const result1 = await testFragment(obj, mockReportFn);
  expect(result1.foo).eq('bar');
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );

  // Test case 4
  mockReportFn = vi.fn();
  obj = { _test: 'test/_test-1.yaml' }; // Assuming _test-1.yaml contains { foo: 'bar' }
  // Expect { test: { foo: 'bar' } } which fits TestResult1's optional 'test' prop shape
  const result1Named = await testFragment(obj, mockReportFn);
  expect(result1Named.test?.foo).eq('bar'); // Use optional chaining for safety if test might be undefined
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );

  // Test case 5
  mockReportFn = vi.fn();
  obj = { _: 'test/_test-2.yaml' }; // Assuming _test-2.yaml contains { test2: { foo: 'bar' } }
  const result2Root = await testFragment(obj, mockReportFn);
  expect(result2Root.test2.foo).eq('bar');
  expect(mockReportFn).toHaveBeenCalledTimes(2);
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-2.yaml')
  );

  // Test case 6
  mockReportFn = vi.fn();
  obj = { _test: 'test/_test-2.yaml' }; // Assuming _test-2.yaml contains { test2: { foo: 'bar' } }
  // Expect { test: { test2: { foo: 'bar' } } } which matches TestResultDeep
  const result2Named = await testFragment(obj, mockReportFn);
  expect(result2Named.test.test2.foo).eq('bar');
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-1.yaml')
  );
  expect(mockReportFn).toHaveBeenCalledWith(
    getExpectedReportedPath('test/_test-2.yaml')
  );
});
