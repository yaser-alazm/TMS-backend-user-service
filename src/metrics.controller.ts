import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('/metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', 'text/plain');
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
