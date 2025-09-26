import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: client.Registry;
  private readonly httpRequestsTotal: client.Counter<string>;
  private readonly httpRequestDuration: client.Histogram<string>;

  constructor() {
    // Create a Registry to register metrics
    this.register = new client.Registry();

    // Add default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'tms_',
    });

    // Custom metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });
  }

  async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }

  // Method to increment request counter (call this from middleware)
  incrementRequestCounter(method: string, route: string, status: string) {
    this.httpRequestsTotal.inc({ method, route, status });
  }

  // Method to observe request duration (call this from middleware)
  observeRequestDuration(method: string, route: string, status: string, duration: number) {
    this.httpRequestDuration.observe({ method, route, status }, duration);
  }
}
