import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SessionLedger } from "./session_ledger.js";
import {
  TenantAuthService,
  clientStatus,
  onboardingSchema,
  refreshSchema,
  revocationSchema
} from "./tenant_auth_service.js";

const service = new TenantAuthService(new SessionLedger());

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    const body = await jsonBody(request);
    if (request.method === "POST" && request.url === "/tenants/onboard") {
      send(response, 201, await service.onboard(onboardingSchema.parse(body)));
      return;
    }
    if (request.method === "POST" && request.url === "/sessions/refresh") {
      send(response, 200, service.refresh(refreshSchema.parse(body)));
      return;
    }
    if (request.method === "POST" && request.url === "/admin/sessions/revoke") {
      send(response, 200, service.revoke(revocationSchema.parse(body)));
      return;
    }
    send(response, 404, { error: "Route not found" });
  } catch (error) {
    send(response, clientStatus(error), {
      error: error instanceof Error ? error.message : "Request failed"
    });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Tenant auth service listening on http://localhost:${port}`));
