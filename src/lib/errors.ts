import type { ZodError } from 'zod';

export class ComposablyError extends Error {
  public readonly cause?: Error;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options?.cause;
    this.context = options?.context;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}

// For errors when instanceof can't be used
export enum ErrorCode {
  CONTENT_ENTRY_NOT_FOUND = 'CMPLY_CONTENT_ENTRY_NOT_FOUND'
}

export class FileNotFoundError extends ComposablyError {
  constructor(filePath: string) {
    const message = `File not found: '${filePath}'`;
    super(message, { context: { filePath } });
  }
}

export class PageNotFoundError extends ComposablyError {
  constructor(requestPath: string) {
    const message = `Page not found: '${requestPath}'`;
    super(message, { context: { requestPath } });
  }
}

export class UnsupportedFileExtensionError extends ComposablyError {
  constructor(fileExtension: string) {
    const message = `Unsupported file extension: '${fileExtension}'`;
    super(message, { context: { fileExtension } });
  }
}

export class ValidationError extends ComposablyError {
  constructor(component: string, error: ZodError | null) {
    const message = `Component '${component}' failed validation: ${error?.message || 'Unknown validation error'}`;
    super(message, { context: { component, error } });
  }
}

export class ContentEntryNotFoundError extends ComposablyError {
  // This error is raised in virtual modules so instanceof will
  // always fail when caught in the main application (due to different realm).
  // Use this code instead.
  public readonly code = ErrorCode.CONTENT_ENTRY_NOT_FOUND;

  constructor(requestedPath: string, availableEntries?: string[]) {
    let message = `Content entry for path '${requestedPath}' not found.`;
    if (availableEntries && availableEntries.length > 0) {
      message += ` Available entries: ${availableEntries.join(', ')}.`;
    } else {
      message += ' No entries are currently available or configured.';
    }
    super(message, { context: { requestedPath, availableEntries } });
  }
}

export class UnlikelyCodePathError extends ComposablyError {
  constructor(environment: unknown) {
    let envString: string;

    if (typeof environment === 'string') {
      envString = environment;
    } else if (environment === null) {
      envString = 'null';
    } else if (typeof environment === 'symbol') {
      envString = environment.toString();
    } else if (typeof environment === 'function') {
      envString = `[function ${environment.name || '(anonymous)'}]`;
    } else if (typeof environment === 'object') {
      try {
        envString = JSON.stringify(environment);
      } catch (_e) {
        envString = '[unserializable object]';
      }
    } else {
      envString = 'truly unknown';
    }

    const message = `This shouldn't happen: ${envString}`;
    super(message, { context: { environment } });
  }
}
