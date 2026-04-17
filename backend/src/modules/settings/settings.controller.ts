import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Get('status')
  async getSettingsStatus() {
    const result = await this.settingsService.validateAiConfiguration();
    return {
      aiConfigured: result.ok,
      reason: result.ok ? undefined : result.reason,
    };
  }

  @Put()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.upsertSettings(dto);
  }
}
