# next-routed

Type-safe, composable API route handlers for the Next.js App Router.

`next-routed` eliminates API route boilerplate. It provides automatic TypeScript schema inference, composable middleware pipelines, authentication guards, unified error handling, and fluent responses — with zero runtime dependencies beyond Next.js.

## Features

- **Next.js 14 & 15 Ready:** Transparent async `params` unwrapping.
- **Zero-Boilerplate Validation:** Fully inferred types for `body`, `query`, `params`, and `headers` using Zod or any Standard Schema v1 validator.
- **Fluent Pipeline:** Single chain API for middleware, validation, guards, and handlers.
- **Context Composition:** Type-safe context expansion via `.use()`.
- **Flexible Responses:** Automatic `{ id, data }` envelopes or explicit status/headers/cookies via `RouteResponse`.
- **Production-Safe Errors:** Built-in `ApiError` hierarchy with automatic exception masking in production.

## Installation

```bash
npm install next-routed next
pnpm add next-routed next
yarn add next-routed next
bun add next-routed next
```

For schema validation, install Zod (or any Standard Schema compatible library):

```bash
pnpm add zod
```

## Quick Start

Create `app/api/hello/route.ts`:

```ts
import { route } from "next-routed";

export const GET = route.handle(() => {
  return { message: "Hello, World!" };
});
```

Returns `200 OK`:

```json
{
  "id": "SUCCESS",
  "data": {
    "message": "Hello, World!"
  }
}
```

---

## Validation with Auto-Inference

Inputs are automatically validated and strictly typed in your handler. No manual `z.infer` or generic type arguments needed.

### Query & Body Validation

```ts
import { route, RouteResponse, HttpStatus } from "next-routed";
import { z } from "zod";

export const POST = route
  .query(
    z.object({
      teamId: z.string(),
    })
  )
  .body(
    z.object({
      title: z.string().min(3),
      content: z.string(),
    })
  )
  .handle(async ({ query, body }) => {
    // query.teamId is strictly `string`
    // body.title is strictly `string`
    return RouteResponse.status(HttpStatus.CREATED).json({
      teamId: query.teamId,
      title: body.title,
    }, "POST_CREATED");
  });

```

### Dynamic Route Params (Next.js 14 & 15+)

`next-routed` automatically resolves async route parameters:

```ts
// app/api/users/[id]/route.ts
import { route } from "next-routed";
import { z } from "zod";

export const GET = route
  .params(z.object({ id: z.string() }))
  .handle(({ params }) => {
    // params.id is strictly typed
    return { userId: params.id };
  });

```

---

## Responses & Cookies

Use `RouteResponse` whenever you need control over HTTP status codes, headers, cookies, or text formats.

```ts
import { route, RouteResponse, HttpStatus } from "next-routed";

// Explicit status & envelope
export const POST = route.handle(() => {
  return RouteResponse.status(HttpStatus.CREATED).json({ created: true });
});

// Plain text / Tokens
export const GET = route.handle(() => {
  return RouteResponse.status(200).text("plain_jwt_string");
});

// Headers, Cookies & 204 No Content
export const DELETE = route.handle(() => {
  return RouteResponse.status(HttpStatus.NO_CONTENT)
    .header("X-Custom-Header", "processed")
    .cookie("session", "", { maxAge: 0, path: "/" })
    .empty();
});

```

---

## Middleware & Authentication

Build reusable, shared route pipelines across your application using `.use()`.

### Creating a Shared Pipeline

```ts
// lib/api.ts
import { route, UnauthorizedError } from "next-routed";

// 1. Base pipeline with context enrichment
export const publicRoute = route.use(({ request, params }) => {
  return {
    request,
    params,
    requestId: crypto.randomUUID(),
  };
});

export const protectedRoute = publicRoute.use(async ({ request, requestId, params }) => {
  const token = request.headers.get("authorization");
  if (!token) throw new UnauthorizedError();

  return {
    request,
    params,
    requestId,
    user: { id: "user_123", role: "ADMIN" as const },
  };
});

```

### Consuming Shared Pipelines

```ts
// app/api/profile/route.ts
import { protectedRoute } from "@/lib/api";

export const GET = protectedRoute.handle(({ user, requestId }) => {
  // `user` and `requestId` are typed and guaranteed non-null
  return {
    userId: user.id,
    requestId,
  };
});

```

Middleware can short-circuit the entire request early by returning a `Response` or throwing an `ApiError`. Add request input validation to any chain with `.body()`, `.query()`, `.params()`, or `.headers()` before `.handle()`.

---

## Error Handling

Throw typed API errors inside any middleware or handler:

```ts
import { route, NotFoundError } from "next-routed";

export const GET = route.handle(() => {
  const item = findItem();

  if (!item) {
    throw new NotFoundError("Resource not found", "ITEM_NOT_FOUND");
  }

  return item;
});

```

Response payload on error (`404 Not Found`):

```json
{
  "id": "ITEM_NOT_FOUND",
  "data": {
    "message": "Resource not found"
  }
}

```

*Note: In production (`NODE_ENV === "production"`), unhandled errors are masked as `INTERNAL_SERVER_ERROR` with status `500` to prevent leaking stack traces.*

---

## Compatibility

| Next.js | App Router | Dynamic Params |
| --- | --- | --- |
| **14.x** | Supported | Plain synchronous objects |
| **15.x+** | Supported | Asynchronous `Promise` params |

Requires Next.js `>= 14.0.0`.

## Example Project

See [`examples/basic`](https://www.google.com/search?q=./examples/basic) for a full runnable Next.js 15 application covering validation, protected routes, role guards, and error responses.

## License

MIT © 2026 slxca
