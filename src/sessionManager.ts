import { IncomingHttpHeaders } from 'http2';
import { createHash } from 'crypto';

interface Session {
  id: string;
  data: { [key: string]: any };
  expiresAt: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  constructor(private config: { secret: string; maxAge: number }) {}

  getSessionId(headers: IncomingHttpHeaders): string {
    const cookies = headers.cookie?.split(';').map(c => c.trim());
    const sessionCookie = cookies?.find(c => c.startsWith('sessionId='));
    if (sessionCookie) {
      const [, sessionId] = sessionCookie.split('=');
      if (this.sessions.has(sessionId)) {
        return sessionId;
      }
    }
    return this.createSession();
  }

  private createSession(): string {
    const sessionId = createHash('sha256').update(`${Date.now()}${this.config.secret}`).digest('hex');
    this.sessions.set(sessionId, {
      id: sessionId,
      data: {},
      expiresAt: Date.now() + this.config.maxAge
    });
    return sessionId;
  }

  updateSession(sessionId: string, headers: IncomingHttpHeaders): { 'set-cookie': string } {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.expiresAt = Date.now() + this.config.maxAge;
      return { 'set-cookie': `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${this.config.maxAge / 1000}` };
    }
    return { 'set-cookie': '' };
  }

  cleanupSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
