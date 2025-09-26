import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const method = req.method;
      const route = req.route?.path || req.url;
      const status = res.statusCode.toString();

      // Record metrics
      this.metricsService.incrementRequestCounter(method, route, status);
      this.metricsService.observeRequestDuration(method, route, status, duration);
    });

    next();
  }
}
