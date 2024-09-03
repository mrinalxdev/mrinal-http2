export interface ServerConfig {
  port : number;
  cert : string;
  key : string;
}

export interface LoadBalancerCondfig {
  algorithm : 'round-robin' | 'leaset-connection' | 'weighted-round-robin' | 'ip-hash' | 'least-response-time' | 'consistent-hashing';
  healthCheckInterval : number;
  sessionTimeout : number;
}

export interface BackendConfig {
  url : string;
  weight : number;
  maxConnections : number;
}

export interface Metrices {
  requestCount : number;
  errorCount : number;
  averageResponseTime : number;
}
