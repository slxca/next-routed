import type {
  BaseContext,
  NextRequestLike,
  ValidationSchemas,
  Schema,
  Middleware,
  RouteOptions,
  RouterBuilder,
  ContextWith,
  StandardSchemaV1,
  StandardSchemaIssue,
} from "./types.js";
import { ResponseBuilder, extractResponseId, extractResponseData } from "./response.js";
import { UnauthorizedError, ValidationError, isApiError, formatError } from "./errors.js";

async function validateWithSchema<T>(
  schema: Schema<unknown, T>,
  input: unknown
): Promise<T> {
  if (
    typeof schema === "object" &&
    schema !== null &&
    "~standard" in schema &&
    typeof schema["~standard"] === "object" &&
    schema["~standard"] !== null &&
    typeof schema["~standard"].validate === "function"
  ) {
    const standardSchema = schema as StandardSchemaV1<any, T>;
    const result = await standardSchema["~standard"].validate(input);
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

  const zodLikeSchema = schema as {
    safeParse(input: unknown): {
      success: true;
      data: T;
    } | {
      success: false;
      error: { issues: readonly StandardSchemaIssue[] };
    };
  };
  const result = zodLikeSchema.safeParse(input);
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
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const obj: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (obj[key] !== undefined) {
        if (Array.isArray(obj[key])) {
          (obj[key] as unknown[]).push(value);
        } else {
          obj[key] = [obj[key], value];
        }
      } else {
        obj[key] = value;
      }
    }
    return obj;
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
  const obj: Record<string, string | string[]> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (obj[key] !== undefined) {
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

function parseHeaders(request: NextRequestLike): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    obj[key.toLowerCase()] = value;
  }
  return obj;
}

async function runValidation<Ctx extends BaseContext>(
  ctx: BaseContext,
  validation?: ValidationSchemas
): Promise<Ctx> {
  if (!validation) return ctx as Ctx;

  const { body, query, params, headers } = validation;

  if (body) {
    const parsedBody = await parseBody(ctx.request);
    const validatedBody = await validateWithSchema(body, parsedBody);
    (ctx as ContextWith<{ body: unknown }>).body = validatedBody;
  }

  if (query) {
    const parsedQuery = parseQuery(ctx.request);
    const validatedQuery = await validateWithSchema(query, parsedQuery);
    (ctx as ContextWith<{ query: unknown }>).query = validatedQuery;
  }

  if (params) {
    const validatedParams = await validateWithSchema(params, ctx.params);
    (ctx as ContextWith<{ params: unknown }>).params = validatedParams as Record<string, string>;
  }

  if (headers) {
    const parsedHeaders = parseHeaders(ctx.request);
    const validatedHeaders = await validateWithSchema(headers, parsedHeaders);
    (ctx as ContextWith<{ headers: unknown }>).headers = validatedHeaders;
  }

  return ctx as Ctx;
}

async function runMiddleware<Ctx extends BaseContext>(
  ctx: BaseContext,
  middleware: Middleware<BaseContext, Ctx>[] = []
): Promise<Ctx | Response> {
  let currentCtx: BaseContext = ctx;

  for (const mw of middleware) {
    const result = await mw(currentCtx);
    if (result instanceof Response) return result;
    if (result !== undefined && result !== void 0) {
      currentCtx = result as BaseContext;
    }
  }

  return currentCtx as Ctx;
}

function buildResponse(result: unknown): Response {
  if (result instanceof Response) {
    return result;
  }

  const id = extractResponseId(result) ?? "SUCCESS";
  const data = extractResponseData(result);

  return ResponseBuilder.json(data, { id });
}

async function executeRoute<Ctx extends BaseContext, TResponse>(
  request: NextRequestLike,
  rawParams: Promise<Record<string, string>> | Record<string, string>,
  options: RouteOptions<Ctx, TResponse>
): Promise<Response> {
  const params = await rawParams;

  const baseContext: BaseContext = { request, params };

  const errorFormatter = options.errorFormatter ?? ((err, _ctx) => {
    const isProduction =
      (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ===
      "production";
    const formatted = formatError(err, isProduction);
    const status = isApiError(err) ? err.status : 500;
    return ResponseBuilder.json(
      { message: formatted.message, details: formatted.details },
      { id: formatted.id, status }
    );
  });

  try {
    const validatedContext = await runValidation(baseContext, options.validation);
    const finalContext = await runMiddleware(validatedContext, options.middleware);
    if (finalContext instanceof Response) return finalContext;
    const result = await options.handler(finalContext as Ctx);
    return buildResponse(result);
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    return errorFormatter(err, baseContext);
  }
}

export function createRoute<Ctx extends BaseContext, TResponse>(
  options: RouteOptions<Ctx, TResponse>
): (
  request: NextRequestLike,
  context: { params: Promise<Record<string, string>> | Record<string, string> }
) => Promise<Response> {
  return (request, context) => executeRoute(request, context.params, options);
}

export function createRouter(): RouterBuilder<BaseContext> {
  const middleware: Middleware<any, any>[] = [];

  const builder = {
    use(mw: Middleware<any, any>) {
      middleware.push(mw);
      return builder as unknown as RouterBuilder<any>;
    },
    requireAuth<User>(getUser: (ctx: BaseContext) => Promise<User | null>) {
      const authMiddleware: Middleware<BaseContext, BaseContext & { user: User }> = async (ctx) => {
        const user = await getUser(ctx);
        if (!user) {
          throw new UnauthorizedError();
        }
        return { ...ctx, user };
      };
      middleware.push(authMiddleware);
      return builder as unknown as RouterBuilder<BaseContext & { user: User }>;
    },
    handler(handler: (ctx: any) => unknown) {
      return (request: NextRequestLike, context: {
        params: Promise<Record<string, string>> | Record<string, string>;
      }) =>
        executeRoute(request, context.params, {
          middleware: [...middleware],
          handler,
        });
    },
  };

  return builder as unknown as RouterBuilder<BaseContext>;
}