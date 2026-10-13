import {
  ForbiddenError,
  route,
  UnauthorizedError,
  type Middleware,
  type RouteContext,
} from "next-routed";
import type { NextRequest } from "next/server";
import type { NextRequestLike } from "next-routed";

export interface User {
  id: string;
  name: string;
  role: "user" | "admin";
}

export interface Session {
  id: string;
  userId: string;
}

export type PublicContext = RouteContext & {
  user?: User;
  session?: Session;
};

export type ProtectedContext = PublicContext & {
  user: User;
  session: Session;
};

export type AdminContext = ProtectedContext & {
  user: User & { role: "admin" };
};

export type AppRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

export function asAppRoute(
  handler: (
    request: NextRequestLike,
    context: {
      params: Promise<Record<string, string>> | Record<string, string>;
    }
  ) => Promise<Response>
): AppRouteHandler {
  return (request, context) => handler(request, context);
}

const demoUsers: Record<string, User> = {
  "user-1": { id: "user-1", name: "Demo User", role: "user" },
  "admin-1": { id: "admin-1", name: "Demo Admin", role: "admin" },
};

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  const value = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value?.slice(name.length + 1);
}

function getDemoUser(context: RouteContext): User | undefined {
  const userId =
    context.request.headers.get("x-demo-user") ??
    getCookie(context.request, "demo-user");
  return userId ? demoUsers[userId] : undefined;
}

const attachSession: Middleware<RouteContext, PublicContext> = (context) => {
  const user = getDemoUser(context);
  const sessionId =
    context.request.headers.get("x-demo-session") ??
    getCookie(context.request, "demo-session");

  return user && sessionId
    ? { ...context, user, session: { id: sessionId, userId: user.id } }
    : context;
};

const requireSession: Middleware<PublicContext, ProtectedContext> = (context) => {
  if (!context.user || !context.session || context.session.userId !== context.user.id) {
    throw new UnauthorizedError("A valid session is required");
  }
  return context as ProtectedContext;
};

const requireAdmin: Middleware<ProtectedContext, AdminContext> = (context) => {
  if (context.user.role !== "admin") {
    throw new ForbiddenError("Administrator access is required");
  }
  return context as AdminContext;
};

export const publicRoute = route.use(attachSession);
export const protectedRoute = publicRoute.use(requireSession);
export const adminRoute = protectedRoute.use(requireAdmin);
