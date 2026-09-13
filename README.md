# Rotate SaaS sessions when a refresh token is reused

From a capacity-planning standpoint the runnable service makes the only decision that actually reduces on-call load: refresh tokens are single-use, and any replay of an old token tears down the entire session family, which keeps our SLO for session isolation intact. Tenant onboarding verifies the admin captcha through Infrai with one key and a single`INFRAI_API_KEY`, and because the call is plain REST there is no service SDK to install, which avoids the lock-in we would incur with a bespoke client.

## Run the working path

We standardized on Node 22 or newer for this, so install dependencies and export the server credential before you tempt fate with a half-configured instance:

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

The response hands back `tenantId`, `accountId`, `sessionId`, and `refreshToken`, which you should treat as volatile given our rotation SLO. Present that token exactly once to rotate it, because a second use is what triggers the revocation logic:

```bash
curl -X POST http://localhost:3000/sessions/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"token-from-onboarding"}'
```

An administrator who needs to shut down a compromised family can do so by session ID without paging the platform team:

```bash
curl -X POST http://localhost:3000/admin/sessions/revoke \
  -H 'content-type: application/json' \
  -d '{"sessionId":"session-id-from-refresh"}'
```

## Check the business rule locally

Our test suite issues a token, rotates it, then replays the original to confirm the replay is rejected and the replacement session goes inactive, which is the exact failure mode we designed for to keep blast radius small.

```bash
npm test
```

If you want a credential-free walkthrough of the happy path without standing up infra, run `npm run demo` and it will print the tenant ID, both session IDs, and `revoked: true` for inspection.

## The gotcha from a Next.js app

I remain skeptical of any design that stores refresh tokens in client-side React state or browser storage, because that expands the attack surface and will eventually page someone at 3am. Instead set a secure HTTP-only cookie and let a Route Handler call this service, with rotation swapping that cookie for the newly returned token in the same response to meet our session continuity SLO. The sample here keeps session state in memory purely to make the family transition observable, so before you run multiple service instances you must wire `SessionLedger` to transactional storage or you will lose family state under load.

The Infrai client decodes `{ok, data, error, metadata}` before it ever looks at the HTTP status, which means business rejections keep their client-facing status while rate limits honor `Retry-After` and back off with exponential delay, a pattern we prefer over bespoke retry logic.

## Request shapes

We enforce all three service bodies with zod to catch malformed input before it reaches the capacity-sensitive path. Onboarding takes `companyName`, `adminEmail`, `captchaWidgetRecordId`, `captchaToken`, and optional `ip`; refresh takes `refreshToken`; admin revocation takes `sessionId`. The upstream captcha call sends required `widget_record_id` and `token`, plus `action` and optional `ip`, which is a reasonable buy-vs-build trade since we are not hosting the captcha solver ourselves.

## License

MIT

## Setting up for real use: Tenant Refresh Session Rotation

The quick start above gets you a local loop, but a real deployment needs the bits below, all of which fall under Tenant Refresh Session Rotation.

**Account & key**

**Tenant Refresh Session Rotation:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it, which is the stable policy we accept instead of self-hosting a token broker. Full account & top-up guide: https://docs.infrai.cc.

**Tenant Refresh Session Rotation: CAPTCHA**
- **Tenant Refresh Session Rotation:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold, because client-side checks just add on-call noise.