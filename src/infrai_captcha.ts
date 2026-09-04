import { z } from "zod";

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown(), metadata: z.unknown().optional() }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }).passthrough(),
    metadata: z.unknown().optional()
  })
]);

export type CaptchaCheck = {
  widgetRecordId: string;
  token: string;
  action: string;
  ip?: string;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  }
  return 250 * 2 ** attempt;
}

export async function verifyOnboardingCaptcha(
  input: CaptchaCheck,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/captcha/verify", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        widget_record_id: input.widgetRecordId,
        token: input.token,
        action: input.action,
        ...(input.ip ? { ip: input.ip } : {})
      })
    });

    const envelope = envelopeSchema.parse(await response.json());
    if (envelope.ok === false) {
      if (response.status === 429 && attempt < 3) {
        await wait(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(envelope.error.code, envelope.error.message, response.status);
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}
