import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { ServiceConfig } from "./config";
import { proxyRequest } from "./proxy";

export function createBffServer(services: ServiceConfig): Server {
  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      writeOptionsResponse(response);
      return;
    }

    try {
      const body = await readRequestBody(request);
      const result = await proxyRequest(
        {
          method: request.method ?? "GET",
          url: request.url ?? "/",
          headers: request.headers,
          body,
        },
        services,
      );

      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(result.body);
    } catch (error: unknown) {
      response.writeHead(502, {
        "access-control-allow-origin": "*",
        "content-type": "text/plain",
      });
      response.end(
        error instanceof Error ? error.message : "Cannot process request",
      );
    }
  });
}

function writeOptionsResponse(response: ServerResponse): void {
  response.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "*",
  });
  response.end();
}

function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}
