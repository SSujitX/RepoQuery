import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GithubService } from './github.service';

@Module({
  imports: [SettingsModule],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
