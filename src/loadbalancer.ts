import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { Backend } from './backend';
import { LoadBalancerConfig, BackendConfig, Metrics } from './types';

export class LoadBalancer extends EventEmitter {
  private backends: Backend[] = [];
  private currentBackendIndex: number = 0;
  private totalWeight: number = 0;
  private consistentHashRing: { hash: number; backend: Backend }[] = [];

  constructor(private config: LoadBalancerConfig) {
    super();
    this.startHealthChecks();
  }

  addBackend(config: BackendConfig): void {
    const backend = new Backend(config);
    this.backends.push(backend);
    this.totalWeight += config.weight;
    this.updateConsistentHashRing();
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.backends.forEach(async (backend) => {
        try {
          const { responseHeaders } = await backend.handleRequest({ ':method': 'GET', ':path': '/health' }, Buffer.from(''));
          backend.setHealth(responseHeaders[':status'] === 200);
        } catch (err) {
          console.error('Health check failed:', err);
          backend.setHealth(false);
        }

        if (!backend.isHealthy()) {
          this.emit('backendUnhealthy', backend);
        }
      });
    }, this.config.healthCheckInterval);
  }

  private updateConsistentHashRing(): void {
    this.consistentHashRing = [];
    const virtualNodes = 100; // Number of virtual nodes per backend

    this.backends.forEach((backend) => {
      for (let i = 0; i < virtualNodes; i++) {
        const hash = this.hash(`${backend.getWeight()}-${i}`);
        this.consistentHashRing.push({ hash, backend });
      }
    });

    this.consistentHashRing.sort((a, b) => a.hash - b.hash);
  }

  private hash(key: string): number {
    return createHash('md5').update(key).digest().readUInt32BE(0);
  }

  getNextBackend(clientIp?: string, requestKey?: string): Backend | null {
    const healthyBackends = this.backends.filter((b) => b.isHealthy());
    if (healthyBackends.length === 0) return null;

    switch (this.config.algorithm) {
      case 'round-robin':
        this.currentBackendIndex = (this.currentBackendIndex + 1) % healthyBackends.length;
        return healthyBackends[this.currentBackendIndex];
      case 'least-connections':
        return healthyBackends.reduce((min, b) => 
          b.getConnections() < min.getConnections() ? b : min
        );
      case 'weighted-round-robin':
        let totalWeight = healthyBackends.reduce((sum, b) => sum + b.getWeight(), 0);
        let random = Math.random() * totalWeight;
        for (let backend of healthyBackends) {
          if (random < backend.getWeight()) {
            return backend;
          }
          random -= backend.getWeight();
        }
        return healthyBackends[0];
      case 'ip-hash':
        if (!clientIp) return healthyBackends[0];
        const hash = this.hash(clientIp);
        return healthyBackends[hash % healthyBackends.length];
      case 'least-response-time':
        return healthyBackends.reduce((min, b) => 
          b.getLastResponseTime() < min.getLastResponseTime() ? b : min
        );
      case 'consistent-hashing':
        if (!requestKey) return healthyBackends[0];
        const keyHash = this.hash(requestKey);
        const node = this.consistentHashRing.find(node => node.hash > keyHash) || this.consistentHashRing[0];
        return node.backend;
      default:
        return healthyBackends[0];
    }
  }

  getBackendMetrics(): { [url: string]: Metrics } {
    return this.backends.reduce((metrics, backend) => {
      metrics[backend.getWeight()] = backend.getMetrics();
      return metrics;
    }, {} as { [url: string]: Metrics });
  }
}
