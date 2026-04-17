import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ProvidersService } from './providers.service';

@Module({
  imports: [SettingsModule],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
