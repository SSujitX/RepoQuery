import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [IngestionModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
