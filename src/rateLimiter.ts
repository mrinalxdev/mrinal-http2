interface RateLimitRule {
    windowMs: number;
    max: number;
  }
  
  interface ClientRecord {
    count: number;
    resetTime: number;
  }
  
  export class RateLimiter {
    private clients: Map<string, ClientRecord> = new Map();
  
    constructor(private config: RateLimitRule) {}
  
    isRateLimited(clientIp: string): boolean {
      const now = Date.now();
      let clientRecord = this.clients.get(clientIp);
  
      if (!clientRecord || now > clientRecord.resetTime) {
        clientRecord = { count: 0, resetTime: now + this.config.windowMs };
        this.clients.set(clientIp, clientRecord);
      }
  
      clientRecord.count++;
  
      return clientRecord.count > this.config.max;
    }
  
    cleanupClients(): void {
      const now = Date.now();
      for (const [clientIp, record] of this.clients.entries()) {
        if (now > record.resetTime) {
          this.clients.delete(clientIp);
        }
      }
    }
  }