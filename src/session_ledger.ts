import { createHash, randomBytes, randomUUID } from "node:crypto";

type SessionRecord = {
  id: string;
  tenantId: string;
  accountId: string;
  familyId: string;
  tokenHash: string;
  replaced: boolean;
  revoked: boolean;
};

export type SessionGrant = {
  sessionId: string;
  refreshToken: string;
};

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export class SessionLedger {
  private readonly sessions = new Map<string, SessionRecord>();

  issue(tenantId: string, accountId: string): SessionGrant {
    return this.add(tenantId, accountId, randomUUID());
  }

  rotate(refreshToken: string): SessionGrant {
    const current = [...this.sessions.values()].find(
      (session) => session.tokenHash === digest(refreshToken)
    );
    if (!current) throw new Error("Refresh token is invalid");
    if (current.replaced || current.revoked) {
      this.revokeFamily(current.familyId);
      throw new Error("Refresh token reuse revoked the session family");
    }

    current.replaced = true;
    return this.add(current.tenantId, current.accountId, current.familyId);
  }

  revoke(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.revokeFamily(session.familyId);
    return true;
  }

  isActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return Boolean(session && !session.replaced && !session.revoked);
  }

  private add(tenantId: string, accountId: string, familyId: string): SessionGrant {
    const refreshToken = randomBytes(32).toString("base64url");
    const session: SessionRecord = {
      id: randomUUID(),
      tenantId,
      accountId,
      familyId,
      tokenHash: digest(refreshToken),
      replaced: false,
      revoked: false
    };
    this.sessions.set(session.id, session);
    return { sessionId: session.id, refreshToken };
  }

  private revokeFamily(familyId: string): void {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId) session.revoked = true;
    }
  }
}
