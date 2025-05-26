import { expect, test, vi, describe, beforeEach } from 'vitest';
import path from 'node:path';

import composablyConfig from '../../composably.config.js';
import { resolveConfig } from '../lib/config.js';
import { contentTraverser } from '../lib/utils.js';
import {
  UnsupportedFileExtensionError,
  FileNotFoundError,
  PageNotFoundError
} from '../lib/errors.js';
import type { Fragment } from '../lib/types.js';

import { __test__ } from '../lib/content.js';
const { ContentLoader } = __test__;

const config = resolveConfig(composablyConfig);

function getExpectedReportedPath(fragmentPath: string): string {
  if (!config.root) {
    throw new Error('Test setup error: config.root is not set.');
  }
  if (!config.contentRoot) {
    throw new Error('Test setup error: config.contentRoot is not set.');
  }

  const resolvedFragmentPath = path.isAbsolute(fragmentPath)
    ? fragmentPath
    : path.join(config.contentRoot, fragmentPath);

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
  loaderInstance: InstanceType<typeof ContentLoader>
): Promise<Fragment> {
  return (await contentTraverser({
    obj,
    filter: (obj) =>
      typeof obj === 'object' &&
      obj !== null &&
      Object.keys(obj).some((key) => key.startsWith('_')),
    callback: (obj) => loaderInstance['loadAndAttachFragments'](obj)
  })) as Fragment;
}

const mockReportFn: ReturnType<typeof vi.fn> = vi.fn();
const mockReportVirtualComponentFn: ReturnType<typeof vi.fn> = vi.fn();
const loader: InstanceType<typeof ContentLoader> = new ContentLoader(
  config,
  mockReportVirtualComponentFn,
  mockReportFn
);

describe('Content resolution', () => {
  test("should have content for ''", async () => {
    const result = await loader['findAndParseContentFile']('');
    expect(result.body).toMatch(/\S/);
  });

  test("should raise PageNotFoundError content for 'no'", async () => {
    await expect(loader['findAndParseContentFile']('no')).rejects.toThrow(
      PageNotFoundError
    );
  });
});

describe('Fragment resolution', () => {
  beforeEach(async () => {
    mockReportFn.mockClear();
  });

  test('should resolve root fragment with empty content', async () => {
    const result = await testFragment({ _: 'test/_test-0.yaml' }, loader);

    expect(result).toEqual({});

    expect(mockReportFn).toHaveBeenCalledTimes(1);

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-0.yaml')
    );

    expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

    mockReportFn.mockClear();
  });

  test('should resolve named fragment with empty content', async () => {
    const result = await testFragment({ _test: 'test/_test-0.yaml' }, loader);

    expect(result).toEqual({ test: undefined });

    expect(mockReportFn).toHaveBeenCalledTimes(1);

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-0.yaml')
    );

    expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

    mockReportFn.mockClear();
  });

  test("should resolve root fragment with content { foo: 'bar' }", async () => {
    const result = await testFragment({ _: 'test/_test-1.yaml' }, loader);

    expect(result).toEqual({ foo: 'bar' });

    expect(mockReportFn).toHaveBeenCalledTimes(1);

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-1.yaml')
    );

    expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

    mockReportFn.mockClear();
  });

  test("should resolve named fragment with content { foo: 'bar' }", async () => {
    const result = await testFragment({ _test: 'test/_test-1.yaml' }, loader);

    expect(result).toEqual({ test: { foo: 'bar' } });

    expect(mockReportFn).toHaveBeenCalledTimes(1);

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-1.yaml')
    );

    expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

    mockReportFn.mockClear();
  });

  test('should resolve root fragment with nested content', async () => {
    const result = await testFragment({ _: 'test/_test-2.yaml' }, loader);

    expect(result).toEqual({ test2: { foo: 'bar' } });

    expect(mockReportFn).toHaveBeenCalledTimes(2);

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-2.yaml')
    );

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-1.yaml')
    );

    expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

    mockReportFn.mockClear();
  });

  test('should resolve named fragment with nested content', async () => {
    const result = await testFragment({ _test: 'test/_test-2.yaml' }, loader);

    expect(result).toEqual({ test: { test2: { foo: 'bar' } } });

    expect(mockReportFn).toHaveBeenCalledTimes(2);

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-2.yaml')
    );

    expect(mockReportFn).toHaveBeenCalledWith(
      getExpectedReportedPath('test/_test-1.yaml')
    );
    expect(mockReportVirtualComponentFn).not.toHaveBeenCalled();

    mockReportFn.mockClear();
  });

  test('should raise error for unsupported extension', async () => {
    await expect(testFragment({ _test: 'file.exe' }, loader)).rejects.toThrow(
      UnsupportedFileExtensionError
    );
  });

  test('should raise error for non-existent file', async () => {
    await expect(testFragment({ _test: 'no-file.md' }, loader)).rejects.toThrow(
      FileNotFoundError
    );
    await expect(testFragment({ _test: 'no-file.js' }, loader)).rejects.toThrow(
      FileNotFoundError
    );
  });
});
