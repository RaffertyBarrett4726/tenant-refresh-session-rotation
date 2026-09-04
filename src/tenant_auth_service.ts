import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiError, verifyOnboardingCaptcha } from "./infrai_captcha.js";
import { SessionLedger } from "./session_ledger.js";

export const onboardingSchema = z.object({
  companyName: z.string().min(2),
  adminEmail: z.string().email(),
  captchaWidgetRecordId: z.string().min(1),
  captchaToken: z.string().min(1),
  ip: z.string().ip().optional()
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export const revocationSchema = z.object({ sessionId: z.string().uuid() });

type CaptchaVerifier = typeof verifyOnboardingCaptcha;

export class TenantAuthService {
  private readonly ledger: SessionLedger;
  private readonly verifyCaptcha: CaptchaVerifier;

  constructor(ledger: SessionLedger, verifyCaptcha: CaptchaVerifier = verifyOnboardingCaptcha) {
    this.ledger = ledger;
    this.verifyCaptcha = verifyCaptcha;
  }

  async onboard(input: z.infer<typeof onboardingSchema>) {
    await this.verifyCaptcha({
      widgetRecordId: input.captchaWidgetRecordId,
      token: input.captchaToken,
      action: "tenant_onboarding",
      ip: input.ip
    });
    const tenantId = randomUUID();
    const accountId = randomUUID();
    return { tenantId, accountId, ...this.ledger.issue(tenantId, accountId) };
  }

  refresh(input: z.infer<typeof refreshSchema>) {
    return this.ledger.rotate(input.refreshToken);
  }

  revoke(input: z.infer<typeof revocationSchema>) {
    return { revoked: this.ledger.revoke(input.sessionId) };
  }
}

export function clientStatus(error: unknown): number {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof InfraiError) return error.status >= 400 && error.status < 500 ? error.status : 502;
  if (error instanceof Error && error.message.includes("token")) return 401;
  return 500;
}
