export interface ServerConfig {
  port : number;
  cert : string;
  key : string;
  sessionTimeout : number;
}

export interface LoadBalancerConfig {
  algorithm : 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'ip-hash' | 'least-response-time' | 'consistent-hashing';
  healthCheckInterval : number;
  sessionTimeout : number;
}

export interface BackendConfig {
  url : string;
  weight : number;
  maxConnections : number;
}

export interface Metrics {
  requestCount : number;
  errorCount : number;
  averageResponseTime : number;
}
