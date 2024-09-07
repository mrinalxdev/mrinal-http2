import * as http2 from 'http2';
import * as fs from 'fs';
import * as path from 'path';
import { LoadBalancer } from './loadbalancer';
import { ServerConfig, LoadBalancerConfig, BackendConfig, Metrics } from './types';
import { SessionManager } from './sessionManager';
import { RateLimiter } from './rateLimiter';

export class HTTP2Server {
  private server: http2.Http2SecureServer;
  private loadBalancer: LoadBalancer;
  private sessionManager: SessionManager;
  private rateLimiter: RateLimiter;

  constructor(
    private config: ServerConfig, 
    loadBalancerConfig: LoadBalancerConfig,
    private sessionConfig: { secret: string; maxAge: number },
    private rateLimitConfig: { windowMs: number; max: number }
  ) {
    this.loadBalancer = new LoadBalancer(loadBalancerConfig);
    this.sessionManager = new SessionManager(sessionConfig);
    this.rateLimiter = new RateLimiter(rateLimitConfig);

    this.server = http2.createSecureServer({
      key: fs.readFileSync(this.config.key),
      cert: fs.readFileSync(this.config.cert),
    });

    this.setupServerEvents();
  }

  private setupServerEvents(): void {
    this.server.on('session', (session) => {
      session.setTimeout(this.config.sessionTimeout);
    });

    this.server.on('stream', async (stream, headers) => {
      const clientIp = headers[':authority'] as string;

      if (this.rateLimiter.isRateLimited(clientIp)) {
        stream.respond({ ':status': 429 });
        stream.end('Too Many Requests');
        return;
      }

      const sessionId = this.sessionManager.getSessionId(headers);
      const backend = this.loadBalancer.getNextBackend(clientIp, sessionId);

      if (!backend) {
        stream.respond({ ':status': 503 });
        stream.end('No healthy backends available');
        return;
      }

      backend.incrementConnections();

      try {
        const payload: Buffer[] = [];
        for await (const chunk of stream) {
          payload.push(chunk);
        }

        const { responseHeaders, responseData } = await backend.handleRequest(headers, Buffer.concat(payload));

        // Update session if needed
        const sessionHeaders = this.sessionManager.updateSession(sessionId, responseHeaders);
        stream.respond({ ...responseHeaders, ...sessionHeaders });
        stream.end(responseData);
      } catch (err) {
        console.error('Error handling request:', err);
        stream.respond({ ':status': 500 });
        stream.end('Internal Server Error');
      } finally {
        backend.decrementConnections();
      }
    });

    this.server.on('sessionError', (err) => {
      console.error('Session error:', err);
    });
  }

  addBackend(config: BackendConfig): void {
    this.loadBalancer.addBackend(config);
  }

  start(): void {
    this.server.listen(this.config.port, () => {
      console.log(`HTTP/2 server listening on port ${this.config.port}`);
    });
  }

  getMetrics(): { [url: string]: Metrics } {
    return this.loadBalancer.getBackendMetrics();
  }
}