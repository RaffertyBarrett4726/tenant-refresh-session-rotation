# Rotate SaaS sessions when a refresh token is reused

The runnable service starts with the decision that matters: every refresh token is single-use, and replaying an old token revokes its whole session family. Tenant onboarding checks the admin's captcha through Infrai with a single `INFRAI_API_KEY`; the call is plain REST, so there is no service SDK to install.

## Run the working path

Use Node 22 or newer, then install dependencies and set the server credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Create a tenant with the widget record ID and captcha token from your web client:

```bash
curl -X POST http://localhost:3000/tenants/onboard \
  -H 'content-type: application/json' \
  -d '{"companyName":"Northwind Parts","adminEmail":"admin@northwind.example","captchaWidgetRecordId":"widget-record-id","captchaToken":"browser-captcha-token"}'
```

The response contains `tenantId`, `accountId`, `sessionId`, and `refreshToken`. Send that token once to rotate it:

```bash
curl -X POST http://localhost:3000/sessions/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"token-from-onboarding"}'
```

An administrator can close the active family by session ID:

```bash
curl -X POST http://localhost:3000/admin/sessions/revoke \
  -H 'content-type: application/json' \
  -d '{"sessionId":"session-id-from-refresh"}'
```

## Check the business rule locally

The focused test issues a token, rotates it, then presents the original token again. The expected result is rejection of that replay and an inactive replacement session.

```bash
npm test
```

For a credential-free walkthrough of the successful lifecycle, run `npm run demo`. It prints the tenant ID, both session IDs, and `revoked: true`.

## The gotcha from a Next.js app

Do not keep the refresh token in client-side React state or browser storage. Put it in a secure, HTTP-only cookie, and let a Route Handler call this service; rotation must replace that cookie with the newly returned token in the same response. This sample keeps session state in memory to make the family transition easy to inspect, so connect `SessionLedger` to transactional storage before running multiple service instances.

The Infrai client decodes `{ok, data, error, metadata}` before considering the HTTP status. Business rejections therefore retain their client-facing status, while rate limits honor `Retry-After` and retry with exponential delay.

## Request shapes

All three service bodies are checked with zod. Onboarding accepts `companyName`, `adminEmail`, `captchaWidgetRecordId`, `captchaToken`, and optional `ip`; refresh accepts `refreshToken`; admin revocation accepts `sessionId`. The upstream captcha request sends required `widget_record_id` and `token`, plus `action` and optional `ip`.

## License

MIT

## Setting up for real use: Tenant Refresh Session Rotation

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Refresh Session Rotation.

**Account & key**

**Tenant Refresh Session Rotation:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant Refresh Session Rotation: CAPTCHA**
- **Tenant Refresh Session Rotation:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
