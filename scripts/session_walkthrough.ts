import { SessionLedger } from "../src/session_ledger.js";
import { TenantAuthService } from "../src/tenant_auth_service.js";

const service = new TenantAuthService(
  new SessionLedger(),
  async () => ({ verified: true })
);

const opened = await service.onboard({
  companyName: "Northwind Parts",
  adminEmail: "admin@northwind.example",
  captchaWidgetRecordId: "local-demo-widget-record",
  captchaToken: "local-demo-captcha"
});
const rotated = service.refresh({ refreshToken: opened.refreshToken });
const closed = service.revoke({ sessionId: rotated.sessionId });

console.log({
  tenantId: opened.tenantId,
  initialSessionId: opened.sessionId,
  rotatedSessionId: rotated.sessionId,
  revoked: closed.revoked
});
