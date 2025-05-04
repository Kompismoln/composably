import { expect, test, vi } from 'vitest';
import { __test__ } from '../lib/content.js';
import config from '../../composably.config.js';
import { contentTraverser } from '$lib/utils.js';
import path from 'node:path';
import type { Fragment } from '$lib/types.js';

config.root = process.cwd();

async function testFragment(
  obj: Fragment,
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
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-0.yaml');

  // Test case 2
  mockReportFn = vi.fn();
  obj = { _test: 'test/_test-0.yaml' }; // Assuming _test-0.yaml results in {}
  const result0Named = await testFragment(obj, mockReportFn); // Expect { test: {} }
  expect(result0Named).toEqual({ test: undefined }); // Check if 'test' property exists
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-0.yaml');

  // Test case 3
  mockReportFn = vi.fn();
  obj = { _: 'test/_test-1.yaml' }; // Assuming _test-1.yaml contains { foo: 'bar' }
  const result1 = await testFragment(obj, mockReportFn);
  expect(result1).toEqual({ foo: 'bar' });
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-1.yaml');

  // Test case 4
  mockReportFn = vi.fn();
  obj = { _test: 'test/_test-1.yaml' }; // Assuming _test-1.yaml contains { foo: 'bar' }
  // Expect { test: { foo: 'bar' } } which fits TestResult1's optional 'test' prop shape
  const result1Named = await testFragment(obj, mockReportFn);
  expect(result1Named).toEqual({ test: { foo: 'bar' } });
  expect(mockReportFn).toHaveBeenCalledTimes(1);
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-1.yaml');

  // Test case 5
  mockReportFn = vi.fn();
  obj = { _: 'test/_test-2.yaml' }; // Assuming _test-2.yaml contains { test2: { foo: 'bar' } }
  const result2Root = await testFragment(obj, mockReportFn);
  expect(result2Root).toEqual({ test2: { foo: 'bar' } });
  expect(mockReportFn).toHaveBeenCalledTimes(2);
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-1.yaml');
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-2.yaml');

  // Test case 6
  mockReportFn = vi.fn();
  obj = { _test: 'test/_test-2.yaml' }; // Assuming _test-2.yaml contains { test2: { foo: 'bar' } }
  // Expect { test: { test2: { foo: 'bar' } } } which matches TestResultDeep
  const result2Named = await testFragment(obj, mockReportFn);
  expect(result2Named).toEqual({ test: { test2: { foo: 'bar' } } });
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-1.yaml');
  expect(mockReportFn).toHaveBeenCalledWith('test/_test-2.yaml');
});
