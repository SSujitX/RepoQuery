import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProjectStatus } from '@repo-intel/shared';
import { PrismaService } from '../../db/prisma.service';
import { IngestionService } from '../ingestion/ingestion.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyRefreshCheck() {
    const projects = await this.prisma.project.findMany({
      where: { status: { in: [ProjectStatus.READY, ProjectStatus.ERROR] } },
    });

    for (const project of projects) {
      try {
        await this.ingestionService.runProjectSync(project.id, 'scheduled');
      } catch (error) {
        this.logger.warn(
          `Scheduled refresh failed for project ${project.id}: ${String(error)}`,
        );
      }
    }
  }
}
