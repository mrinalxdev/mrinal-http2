import * as http2 from 'http2';
import { BackendConfig, Metrics } from './types';

export class Backend {
  private connections: number = 0;
  private health: boolean = true;
  private lastResponseTime: number = 0;
  private session: http2.ClientHttp2Session | null = null;
  private metrics: Metrics = { requestCount: 0, errorCount: 0, averageResponseTime: 0 };

  constructor(private config: BackendConfig) {
    this.initSession();
  }

  private initSession(): void {
    this.session = http2.connect(this.config.url);
    this.session.on('error', (err) => {
      console.error(`Backend ${this.config.url} session error:`, err);
      this.health = false;
      this.session = null;
      setTimeout(() => this.initSession(), 5000);
    });
  }

  async handleRequest(headers: http2.IncomingHttpHeaders, payload: Buffer): Promise<{ responseHeaders: http2.IncomingHttpHeaders, responseData: Buffer }> {
    if (!this.session) {
      throw new Error('Backend session not available');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const stream = this.session!.request(headers);

      let responseData: Buffer[] = [];
      let responseHeaders: http2.IncomingHttpHeaders;

      stream.on('response', (headers) => {
        responseHeaders = headers;
      });

      stream.on('data', (chunk) => {
        responseData.push(chunk);
      });

      stream.on('end', () => {
        this.lastResponseTime = Date.now() - startTime;
        this.updateMetrics(this.lastResponseTime);
        resolve({
          responseHeaders: responseHeaders!,
          responseData: Buffer.concat(responseData)
        });
      });

      stream.on('error', (err) => {
        this.metrics.errorCount++;
        reject(err);
      });

      stream.end(payload);
    });
  }

  private updateMetrics(responseTime: number): void {
    this.metrics.requestCount++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / this.metrics.requestCount;
  }

  incrementConnections(): void {
    this.connections++;
  }

  decrementConnections(): void {
    this.connections--;
  }

  getConnections(): number {
    return this.connections;
  }

  setHealth(status: boolean): void {
    this.health = status;
  }

  isHealthy(): boolean {
    return this.health && this.connections < this.config.maxConnections;
  }

  getLastResponseTime(): number {
    return this.lastResponseTime;
  }

  getWeight(): number {
    return this.config.weight;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }
}
