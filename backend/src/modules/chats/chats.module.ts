import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { SettingsModule } from '../settings/settings.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [AgentsModule, SettingsModule],
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule {}
