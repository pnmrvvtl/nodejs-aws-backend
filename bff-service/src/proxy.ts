import { IncomingHttpHeaders } from "node:http";
import { ServiceConfig, ServiceName } from "./config";
import { getCachedResponse, setCachedResponse } from "./cache";

export type ProxyResult = {
  status: number;
  headers: Array<[string, string]>;
  body: Buffer;
};

export type ProxyRequest = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

const allowedServices: readonly ServiceName[] = ["product", "cart"];

export async function proxyRequest(
  request: ProxyRequest,
  services: ServiceConfig,
): Promise<ProxyResult> {
  const parsed = parseRecipientUrl(request.url);

  if (!parsed) {
    return textResponse(502, "Cannot process request");
  }

  const recipientUrl = services[parsed.service];

  if (!recipientUrl) {
    return textResponse(502, "Cannot process request");
  }

  const targetUrl = `${recipientUrl}${parsed.path}${parsed.search}`;
  const cacheKey = createCacheKey(request.method, parsed.service, parsed.path);
  const cached = cacheKey ? getCachedResponse(cacheKey) : null;

  if (cached) {
    return {
      status: cached.status,
      headers: cached.headers,
      body: cached.body,
    };
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: createForwardHeaders(request.headers),
    body: hasBody(request.method) ? new Uint8Array(request.body) : undefined,
  });
  const body = Buffer.from(await response.arrayBuffer());
  const result = {
    status: response.status,
    headers: createResponseHeaders(response.headers),
    body,
  };

  if (cacheKey && response.ok) {
    setCachedResponse(cacheKey, result);
  }

  return result;
}

function parseRecipientUrl(
  url: string,
): { service: ServiceName; path: string; search: string } | null {
  const parsed = new URL(url, "http://localhost");
  const [rawService, ...pathParts] = parsed.pathname
    .split("/")
    .filter(Boolean);

  if (!isServiceName(rawService)) {
    return null;
  }

  return {
    service: rawService,
    path: `/${pathParts.join("/")}`,
    search: parsed.search,
  };
}

function isServiceName(value: string | undefined): value is ServiceName {
  return allowedServices.some((service) => service === value);
}

function createForwardHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (!value || shouldSkipRequestHeader(name)) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(name, item);
      }
    } else {
      result.set(name, value);
    }
  }

  return result;
}

function createResponseHeaders(headers: Headers): Array<[string, string]> {
  const result: Array<[string, string]> = [
    ["access-control-allow-origin", "*"],
    ["access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS"],
    ["access-control-allow-headers", "*"],
  ];

  headers.forEach((value, name) => {
    if (!shouldSkipResponseHeader(name)) {
      result.push([name, value]);
    }
  });

  return result;
}

function shouldSkipRequestHeader(name: string): boolean {
  return ["host", "connection", "content-length"].includes(
    name.toLowerCase(),
  );
}

function shouldSkipResponseHeader(name: string): boolean {
  return ["transfer-encoding", "content-encoding", "content-length"].includes(
    name.toLowerCase(),
  );
}

function hasBody(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function createCacheKey(
  method: string,
  service: ServiceName,
  path: string,
): string | null {
  return method.toUpperCase() === "GET" &&
    service === "product" &&
    path === "/products"
    ? "GET:product:/products"
    : null;
}

function textResponse(status: number, message: string): ProxyResult {
  return {
    status,
    headers: [
      ["access-control-allow-origin", "*"],
      ["content-type", "text/plain"],
    ],
    body: Buffer.from(message),
  };
}
