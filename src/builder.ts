import type {
  Middleware,
  RouteBuilder,
  RouteContext,
  RouteDefinition,
  RouteHandler,
  Schema,
  InferSchema,
  ValidationConfig,
} from "./types.js";
import { executeRoute } from "./core.js";

function createBuilder<TContext extends RouteContext>(
  middleware: readonly Middleware<RouteContext>[],
  validation: ValidationConfig
): RouteBuilder<TContext> {
  const builder: RouteBuilder<TContext> = {
    use<TNextContext extends RouteContext>(
      middlewareItem: Middleware<TContext, TNextContext>
    ) {
      return createBuilder<TNextContext>(
        [...middleware, middlewareItem as Middleware<RouteContext>],
        validation
      );
    },
    body<TSchema extends Schema<unknown>>(schema: TSchema) {
      return createBuilder<TContext & { body: InferSchema<TSchema> }>(
        middleware,
        { ...validation, body: schema }
      );
    },
    query<TSchema extends Schema<unknown>>(schema: TSchema) {
      return createBuilder<TContext & { query: InferSchema<TSchema> }>(
        middleware,
        { ...validation, query: schema }
      );
    },
    params<TSchema extends Schema<unknown>>(schema: TSchema) {
      return createBuilder<TContext & { params: InferSchema<TSchema> }>(
        middleware,
        { ...validation, params: schema }
      );
    },
    headers<TSchema extends Schema<unknown>>(schema: TSchema) {
      return createBuilder<TContext & { headers: InferSchema<TSchema> }>(
        middleware,
        { ...validation, headers: schema }
      );
    },
    handle<TResponse>(handler: RouteHandler<TContext, TResponse>) {
      const definition: RouteDefinition = {
        middleware,
        validation,
        handler: handler as RouteHandler<RouteContext>,
      };
      return (request, context) => executeRoute(request, context.params, definition);
    },
  };
  return builder;
}

export const route = createBuilder<RouteContext>([], {});
