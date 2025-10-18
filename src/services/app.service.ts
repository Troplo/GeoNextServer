import { Injectable } from '@nestjs/common';
import { ConfigService } from './config.service';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getState() {
    return {
      requireAuth: this.configService.get('requireAuth'),
      environment: this.configService.get('environment'),
      googleApiKey: this.configService.get('googleApiKey'),
      tpuAppId: this.configService.get('tpuAppId'),
    };
  }
}
