import { ValidationError } from "./errors.js";
import type {
  NextRequestLike,
  RouteContext,
  Schema,
  StandardSchemaIssue,
  ValidationConfig,
} from "./types.js";

async function validate<T>(schema: Schema<T>, input: unknown): Promise<T> {
  if (
    typeof schema === "object" &&
    schema !== null &&
    "~standard" in schema &&
    typeof schema["~standard"] === "object" &&
    schema["~standard"] !== null &&
    typeof schema["~standard"].validate === "function"
  ) {
    const result = await schema["~standard"].validate(input);
    if ("issues" in result) {
      throw new ValidationError(result.issues);
    }
    return result.value;
  }

  if (
    typeof schema !== "object" ||
    schema === null ||
    typeof (schema as { safeParse?: unknown }).safeParse !== "function"
  ) {
    throw new TypeError("Schema must implement Standard Schema v1 or safeParse()");
  }

  if (!("safeParse" in schema)) {
    throw new TypeError("Schema must implement Standard Schema v1 or safeParse()");
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }
  return result.data;
}

async function parseBody(request: NextRequestLike): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      const existing = body[key];
      body[key] =
        existing === undefined
          ? value
          : Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
    }
    return body;
  }
  if (!contentType) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  return {};
}

function parseQuery(request: NextRequestLike): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    const existing = query[key];
    query[key] =
      existing === undefined
        ? value
        : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
  }
  return query;
}

function parseHeaders(request: NextRequestLike): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}

export async function validateContext(
  context: RouteContext,
  config: ValidationConfig
): Promise<RouteContext> {
  const validated = { ...context } as RouteContext & Record<string, unknown>;
  if (config.body) validated.body = await validate(config.body, await parseBody(context.request));
  if (config.query) validated.query = await validate(config.query, parseQuery(context.request));
  if (config.params) {
    validated.params = (await validate(config.params, context.params)) as Record<string, string>;
  }
  if (config.headers) validated.headers = await validate(config.headers, parseHeaders(context.request));
  return validated;
}
