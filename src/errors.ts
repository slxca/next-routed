export interface ValidationIssue {
  path?: readonly PropertyKey[];
  message: string;
}

export abstract class ApiError extends Error {
  abstract readonly status: number;
  readonly id: string;
  readonly details?: unknown;

  constructor(message: string, id: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.id = id;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApiError {
  readonly status = 400;
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[], message = "Validation failed") {
    super(message, "VALIDATION_ERROR", issues);
    this.issues = issues;
  }
}

export class BadRequestError extends ApiError {
  readonly status = 400;
  constructor(message = "Bad request", id = "BAD_REQUEST", details?: unknown) {
    super(message, id, details);
  }
}

export class UnauthorizedError extends ApiError {
  readonly status = 401;
  constructor(message = "Unauthorized", id = "UNAUTHORIZED", details?: unknown) {
    super(message, id, details);
  }
}

export class ForbiddenError extends ApiError {
  readonly status = 403;
  constructor(message = "Forbidden", id = "FORBIDDEN", details?: unknown) {
    super(message, id, details);
  }
}

export class NotFoundError extends ApiError {
  readonly status = 404;
  constructor(message = "Not found", id = "NOT_FOUND", details?: unknown) {
    super(message, id, details);
  }
}

export class InternalServerError extends ApiError {
  readonly status = 500;
  constructor(message = "Internal server error", id = "INTERNAL_SERVER_ERROR", details?: unknown) {
    super(message, id, details);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export interface FormattedError {
  id: string;
  message: string;
  details?: unknown;
}

export function formatError(err: unknown, isProduction = true): FormattedError {
  if (isApiError(err)) {
    return {
      id: err.id,
      message: err.message,
      details: isProduction && err.status >= 500 ? undefined : err.details,
    };
  }

  if (err instanceof Error) {
    return {
      id: "INTERNAL_SERVER_ERROR",
      message: isProduction ? "Internal server error" : err.message,
      details: isProduction ? undefined : { stack: err.stack, name: err.name },
    };
  }

  return {
    id: "UNKNOWN_ERROR",
    message: "An unknown error occurred",
    details: isProduction ? undefined : err,
  };
}