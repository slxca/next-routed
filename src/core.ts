import { formatError, isApiError } from "./errors.js";
import { RouteResponse } from "./response.js";
import { validateContext } from "./validation.js";
import type {
  AppRouteHandler,
  Middleware,
  NextRequestLike,
  RouteContext,
  RouteDefinition,
} from "./types.js";

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function defaultErrorResponse(error: unknown): Response {
  const production =
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ===
    "production";
  const formatted = formatError(error, production);
  return RouteResponse.status(isApiError(error) ? error.status : 500).json(
    { message: formatted.message, details: formatted.details },
    formatted.id
  );
}

async function runMiddleware(
  context: RouteContext,
  middleware: readonly Middleware<RouteContext>[]
): Promise<RouteContext | Response> {
  let current = context;
  for (const middlewareItem of middleware) {
    const result = await middlewareItem(current);
    if (isResponse(result)) return result;
    if (result !== undefined) current = result;
  }
  return current;
}

function normalizeResponse(result: unknown): Response {
  return isResponse(result) ? result : RouteResponse.json(result);
}

export async function executeRoute(
  request: NextRequestLike,
  rawParams: Promise<Record<string, string>> | Record<string, string>,
  definition: RouteDefinition
): Promise<Response> {
  const context: RouteContext = { request, params: await rawParams };
  try {
    const validated = await validateContext(context, definition.validation);
    const withMiddleware = await runMiddleware(validated, definition.middleware);
    if (isResponse(withMiddleware)) return withMiddleware;
    return normalizeResponse(await definition.handler(withMiddleware));
  } catch (error) {
    return isResponse(error) ? error : defaultErrorResponse(error);
  }
}

export function asRouteHandler(
  request: NextRequestLike,
  context: { params: Promise<Record<string, string>> | Record<string, string> },
  definition: RouteDefinition
): Promise<Response> {
  return executeRoute(request, context.params, definition);
}

export type { AppRouteHandler };
