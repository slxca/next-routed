export type NextRequestLike = Request & {
  nextUrl: URL;
};

export interface StandardSchemaV1<Input, Output> {
  "~standard": {
    version: 1;
    vendor: string;
    validate: (input: Input) => Promise<
      | { value: Output }
      | { issues: readonly StandardSchemaIssue[] }
    >;
  };
}

export interface StandardSchemaIssue {
  message: string;
  path?: readonly PropertyKey[];
}

export type Schema<TInput, TOutput = TInput> =
  | {
      safeParse(input: unknown): {
        success: true;
        data: TOutput;
      } | {
        success: false;
        error: { issues: readonly StandardSchemaIssue[] };
      };
    }
  | StandardSchemaV1<TInput, TOutput>;

export interface ValidationSchemas<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  THeaders = unknown
> {
  body?: Schema<TBody>;
  query?: Schema<TQuery>;
  params?: Schema<TParams>;
  headers?: Schema<THeaders>;
}

export interface BaseContext {
  request: NextRequestLike;
  params: Record<string, string>;
}

export type ContextWith<T extends Record<string, unknown>> = BaseContext & T;

export type Middleware<
  Ctx extends BaseContext,
  NewCtx extends BaseContext = Ctx
> = (
  ctx: Ctx
) => Promise<NewCtx | Response | void> | NewCtx | Response | void;

export type RouteHandler<Ctx extends BaseContext, TResponse = unknown> = (
  ctx: Ctx
) => Promise<TResponse | Response> | TResponse | Response;

export type ErrorFormatter = (error: unknown, ctx: BaseContext) => Response;

export interface RouteOptions<Ctx extends BaseContext, TResponse = unknown> {
  validation?: ValidationSchemas;
  middleware?: Middleware<BaseContext, Ctx>[];
  handler: RouteHandler<Ctx, TResponse>;
  errorFormatter?: ErrorFormatter;
}

export interface RouterBuilder<Ctx extends BaseContext> {
  use<NewCtx extends BaseContext>(
    middleware: Middleware<Ctx, NewCtx>
  ): RouterBuilder<NewCtx>;
  requireAuth<User>(
    getUser: (ctx: Ctx) => Promise<User | null>
  ): RouterBuilder<Ctx & { user: User }>;
  handler<TResponse>(
    handler: RouteHandler<Ctx, TResponse>
  ): (
    request: NextRequestLike,
    context: {
      params: Promise<Record<string, string>> | Record<string, string>;
    }
  ) => Promise<Response>;
}