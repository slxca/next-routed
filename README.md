# next-route-kit

Type-safe, composable API route handlers for the Next.js App Router.

`next-route-kit` keeps route handlers focused on application logic. It provides request parsing, Standard Schema or Zod-style validation, middleware composition, authentication guards, consistent responses, and typed errors without adding runtime dependencies beyond your existing Next.js and validator peer dependencies.

## Features

- Next.js App Router route handlers for Next.js 14 and 15
- Standard Schema v1 validation with `.safeParse()` fallback
- Typed body, query, params, and headers validation
- Composable async middleware with context enrichment
- Authentication through `requireAuth()`
- Middleware and guards can return a `Response` to short-circuit
- Consistent `{ id, data }` responses for direct handler values
- `ResponseBuilder` for explicit IDs, statuses, headers, and formatters
- Typed API errors with production-safe formatting
- Zero runtime dependencies

## Installation

```bash
npm install next-route-kit next
pnpm add next-route-kit next
yarn add next-route-kit next
bun add next-route-kit next
```

For Zod validation, also install Zod:

```bash
pnpm add zod
```

`next` is a peer dependency. `zod` is optional because any Standard Schema-compatible validator can be used.

## Quick start

Create `app/api/hello/route.ts`:

```ts
import { createRoute } from "next-route-kit";

export const GET = createRoute({
  handler: () => ({ message: "Hello, World!" }),
});
```

The response is:

```json
{
  "id": "SUCCESS",
  "data": { "message": "Hello, World!" }
}
```

Handlers may also return a native `Response` or a `ResponseBuilder` response.

## Validation

Schemas can validate `body`, `query`, `params`, and `headers`. Parsed values are added to the route context.

### Query validation

```ts
import { z } from "zod";
import { createRoute, type BaseContext } from "next-route-kit";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().default(""),
});

type QueryContext = BaseContext & {
  query: z.infer<typeof querySchema>;
};

export const GET = createRoute<QueryContext>({
  validation: { query: querySchema },
  handler: ({ query }) => query,
});
```

### JSON body validation

```ts
import { z } from "zod";
import { createRoute, type BaseContext } from "next-route-kit";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1),
  tags: z.array(z.string()).default([]),
});

type BodyContext = BaseContext & {
  body: z.infer<typeof bodySchema>;
};

export const POST = createRoute<BodyContext>({
  validation: { body: bodySchema },
  handler: ({ body }) => ({ created: true, post: body }),
});
```

JSON, multipart form data, and URL-encoded form data are supported.

### Dynamic params validation

Next.js 15 supplies dynamic route params as a promise. `createRoute` unwraps them before validation:

```ts
import { z } from "zod";
import { createRoute, type BaseContext } from "next-route-kit";

const paramsSchema = z.object({ id: z.string().min(1) });

type ParamsContext = BaseContext & {
  params: z.infer<typeof paramsSchema>;
};

export const GET = createRoute<ParamsContext>({
  validation: { params: paramsSchema },
  handler: ({ params }) => ({ postId: params.id }),
});
```

This also works with the synchronous params shape used by Next.js 14.

## Middleware

Use `.use()` to attach reusable behavior or enrich context:

```ts
import { createRouter, type BaseContext, type Middleware } from "next-route-kit";

type RequestContext = BaseContext & { requestId: string };

const attachRequestId: Middleware<BaseContext, RequestContext> = (ctx) => ({
  ...ctx,
  requestId: crypto.randomUUID(),
});

export const GET = createRouter()
  .use(attachRequestId)
  .handler(({ requestId }) => ({ requestId }));
```

Middleware can return a `Response` to stop the chain and skip the handler:

```ts
import { ResponseBuilder, type BaseContext } from "next-route-kit";

const requireInternalHeader = (ctx: BaseContext) => {
  if (ctx.request.headers.get("x-internal-key") !== "demo") {
    return ResponseBuilder.json(
      { message: "Internal access required" },
      { id: "FORBIDDEN", status: 403 },
    );
  }

  return ctx;
};
```

## Authentication

`requireAuth()` calls your user lookup function and throws an `UnauthorizedError` when it returns `null`:

```ts
import { createRouter, type BaseContext } from "next-route-kit";

interface User {
  id: string;
  email: string;
}

const protectedRouter = createRouter().requireAuth<User>(async (ctx: BaseContext) => {
  const token = ctx.request.headers.get("authorization");
  return token ? { id: "user-1", email: "user@example.com" } : null;
});

export const GET = protectedRouter.handler(({ user }) => ({
  userId: user.id,
  email: user.email,
}));
```

Add role or session checks with `.use()` after authentication:

```ts
import { ForbiddenError, type BaseContext, type Middleware } from "next-route-kit";

type AuthContext = BaseContext & { user: User };

const requireAdmin: Middleware<AuthContext, AuthContext> = (ctx) => {
  if (ctx.user.id !== "admin-1") {
    throw new ForbiddenError("Administrator access is required");
  }
  return ctx;
};
```

## Responses and errors

Use `ResponseBuilder` for explicit response metadata:

```ts
import { ResponseBuilder, createRoute } from "next-route-kit";

export const POST = createRoute({
  handler: () => ResponseBuilder.json(
    { created: true },
    { id: "POST_CREATED", status: 201 },
  ),
});
```

Throw an `ApiError` when a route cannot complete:

```ts
import { NotFoundError, createRoute } from "next-route-kit";

export const GET = createRoute({
  handler: () => {
    const post = findPost();
    if (!post) throw new NotFoundError("Post not found", "POST_NOT_FOUND");
    return post;
  },
});
```

The default error response is shaped like:

```json
{
  "id": "POST_NOT_FOUND",
  "data": { "message": "Post not found" }
}
```

Route-specific formatting is available through `errorFormatter`:

```ts
import { ResponseBuilder, createRoute } from "next-route-kit";

export const GET = createRoute({
  errorFormatter: (error, context) => ResponseBuilder.json(
    {
      path: context.request.url,
      error: error instanceof Error ? error.message : "Unknown error",
    },
    { id: "ROUTE_FAILED", status: 500 },
  ),
  handler: () => {
    throw new Error("Example failure");
  },
});
```

Unexpected error messages and stack traces are hidden by the default formatter in production.

## TypeScript recipe

Define context extensions once and reuse them:

```ts
import { createRouter, type BaseContext, type Middleware } from "next-route-kit";

interface AuthenticatedContext extends BaseContext {
  user: { id: string; roles: string[] };
}

const authenticate: Middleware<BaseContext, AuthenticatedContext> = async (ctx) => ({
  ...ctx,
  user: { id: "user-1", roles: ["reader"] },
});

export const GET = createRouter()
  .use(authenticate)
  .handler(({ user }) => ({ userId: user.id }));
```

## Compatibility

| Next.js | App Router | Params |
| --- | --- | --- |
| 14.x | Supported | Plain object or compatible context |
| 15.x | Supported | Promise-based context supported |

The package requires Next.js `14.0.0` or newer.

## Example application

See [`examples/basic`](./examples/basic) for a runnable consumer application covering query, body, and params validation, session attachment, authenticated routes, and admin-only deletion.

## Releases

Release notes are managed locally with Changesets:

```bash
pnpm changeset
pnpm version-packages
```

This repository intentionally does not configure GitHub Actions. Publishing and release automation are run manually by maintainers.

## License

MIT © 2026 slxca
