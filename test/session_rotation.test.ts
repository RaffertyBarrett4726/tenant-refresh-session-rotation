import { describe, expect, it } from "vitest";
import { SessionLedger } from "../src/session_ledger.js";

describe("refresh-token rotation", () => {
  it("revokes the full family when an already rotated token is reused", () => {
    const ledger = new SessionLedger();
    const first = ledger.issue("tenant-1", "account-1");
    const second = ledger.rotate(first.refreshToken);

    expect(() => ledger.rotate(first.refreshToken)).toThrow(/reuse revoked/);
    expect(ledger.isActive(second.sessionId)).toBe(false);
  });
});
