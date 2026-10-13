import { NextResponse } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { formatError } from "./errors.js";

export enum HttpStatus {
  CONTINUE = 100,
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

export type RouteCookie = Partial<ResponseCookie> & {
  name: string;
  value: string;
};

export class RouteResponseBuilder {
  private readonly headers = new Headers();
  private readonly cookies: RouteCookie[] = [];

  constructor(private readonly statusCode: number) {}

  header(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  cookie(name: string, value: string, options?: Partial<ResponseCookie>): this;
  cookie(cookie: RouteCookie): this;
  cookie(
    nameOrCookie: string | RouteCookie,
    value?: string,
    options: Partial<ResponseCookie> = {}
  ): this {
    if (typeof nameOrCookie === "string") {
      this.cookies.push({ name: nameOrCookie, value: value ?? "", ...options });
    } else {
      this.cookies.push(nameOrCookie);
    }

    return this;
  }

  json<T>(data: T, id = "SUCCESS"): NextResponse {
    return this.finalize(
      NextResponse.json({ id, data }, { status: this.statusCode })
    );
  }

  text(body: string): NextResponse {
    return this.finalize(
      new NextResponse(body, {
        status: this.statusCode,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }

  empty(): NextResponse {
    return this.finalize(new NextResponse(null, { status: this.statusCode }));
  }

  private finalize(response: NextResponse): NextResponse {
    this.headers.forEach((value, name) => response.headers.set(name, value));

    for (const cookie of this.cookies) {
      response.cookies.set(cookie);
    }

    return response;
  }
}

export class RouteResponse {
  static status(code: number): RouteResponseBuilder {
    return new RouteResponseBuilder(code);
  }

  static json<T>(data: T, id = "SUCCESS"): NextResponse {
    return this.status(HttpStatus.OK).json(data, id);
  }

  static text(body: string): NextResponse {
    return this.status(HttpStatus.OK).text(body);
  }

  static empty(): NextResponse {
    return this.status(HttpStatus.NO_CONTENT).empty();
  }

  static error(error: unknown, status?: number): NextResponse {
    const isProduction =
      (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ===
      "production";
    const formatted = formatError(error, isProduction);
    const resolvedStatus =
      status ??
      (error instanceof Error &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : HttpStatus.INTERNAL_SERVER_ERROR);

    return RouteResponse.status(resolvedStatus).json(
      { message: formatted.message, details: formatted.details },
      formatted.id
    );
  }
}
