import type { NextResponse } from "next/server";

export type NextRequestLike = Request & {
  nextUrl: URL;
};

export interface StandardSchemaIssue {
  message: string;
  path?: readonly PropertyKey[];
}

export interface StandardSchemaV1<Input, Output> {
  "~standard": {
    version: 1;
    vendor: string;
    validate: (
      input: Input
    ) =>
      | Promise<{ value: Output } | { issues: readonly StandardSchemaIssue[] }>
      | { value: Output }
      | { issues: readonly StandardSchemaIssue[] };
  };
}

export type Schema<TOutput> =
  | StandardSchemaV1<unknown, TOutput>
  | {
      safeParse(input: unknown):
        | { success: true; data: TOutput }
        | {
            success: false;
            error: { issues: readonly StandardSchemaIssue[] };
          };
    };

export type InferSchema<TSchema> = TSchema extends Schema<infer TOutput>
  ? TOutput
  : never;

export interface RouteContext {
  request: NextRequestLike;
  params: Record<string, string>;
}

export type Middleware<
  TContext extends RouteContext,
  TNextContext extends RouteContext = TContext
> = (
  context: TContext
) =>
  | TNextContext
  | NextResponse
  | void
  | Promise<TNextContext | NextResponse | void>;

export type RouteHandler<TContext extends RouteContext, TResponse = unknown> = (
  context: TContext
) => TResponse | NextResponse | Promise<TResponse | NextResponse>;

export interface ValidationConfig {
  body?: Schema<unknown>;
  query?: Schema<unknown>;
  params?: Schema<unknown>;
  headers?: Schema<unknown>;
}

export interface RouteDefinition {
  readonly middleware: readonly Middleware<RouteContext>[];
  readonly validation: ValidationConfig;
  readonly handler: RouteHandler<RouteContext>;
}

export type AppRouteHandler = (
  request: NextRequestLike,
  context: {
    params: Promise<Record<string, string>> | Record<string, string>;
  }
) => Promise<Response>;

export interface RouteBuilder<TContext extends RouteContext> {
  use<TNextContext extends RouteContext>(
    middleware: Middleware<TContext, TNextContext>
  ): RouteBuilder<TNextContext>;
  body<TSchema extends Schema<unknown>>(
    schema: TSchema
  ): RouteBuilder<TContext & { body: InferSchema<TSchema> }>;
  query<TSchema extends Schema<unknown>>(
    schema: TSchema
  ): RouteBuilder<TContext & { query: InferSchema<TSchema> }>;
  params<TSchema extends Schema<unknown>>(
    schema: TSchema
  ): RouteBuilder<TContext & { params: InferSchema<TSchema> }>;
  headers<TSchema extends Schema<unknown>>(
    schema: TSchema
  ): RouteBuilder<TContext & { headers: InferSchema<TSchema> }>;
  handle<TResponse>(
    handler: RouteHandler<TContext, TResponse>
  ): AppRouteHandler;
}
