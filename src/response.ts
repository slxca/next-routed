import { formatError } from "./errors.js";

export interface ResponseFormatOptions {
  id?: string;
  status?: number;
  headers?: HeadersInit;
}

export type ResponseFormatter = (
  data: unknown,
  id: string,
  status: number
) => Response;

let defaultFormatter: ResponseFormatter = (data, id, status) =>
  Response.json({ id, data }, { status });

function getDefaultFormatter(): ResponseFormatter {
  return defaultFormatter;
}

function setDefaultFormatter(formatter: ResponseFormatter): void {
  defaultFormatter = formatter;
}

export class ResponseBuilder {
  static setDefaultFormatter(formatter: ResponseFormatter): void {
    setDefaultFormatter(formatter);
  }

  static getDefaultFormatter(): ResponseFormatter {
    return getDefaultFormatter();
  }

  static json<T>(data: T, options: ResponseFormatOptions = {}): Response {
    const id = options.id ?? "SUCCESS";
    const status = options.status ?? 200;
    const formatter = getDefaultFormatter();
    const response = formatter(data, id, status);
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    return response;
  }

  static success<T>(data: T, options: ResponseFormatOptions = {}): Response {
    return this.json(data, { ...options, id: options.id ?? "SUCCESS" });
  }

  static error(error: unknown, options: ResponseFormatOptions = {}): Response {
    const isProduction =
      (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ===
      "production";
    const formatted = formatError(error, isProduction);
    const status =
      options.status ??
      (error instanceof Error &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 500);
    const formatter = getDefaultFormatter();
    const response = formatter(
      { message: formatted.message, details: formatted.details },
      formatted.id,
      status
    );
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    return response;
  }

  static custom<T>(
    data: T,
    formatter: ResponseFormatter,
    options: ResponseFormatOptions = {}
  ): Response {
    const id = options.id ?? "SUCCESS";
    const status = options.status ?? 200;
    const response = formatter(data, id, status);
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    return response;
  }
}

export function extractResponseId(result: unknown): string | undefined {
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

export function extractResponseData(result: unknown): unknown {
  if (result && typeof result === "object" && "data" in result) {
    return (result as { data: unknown }).data;
  }
  return result;
}