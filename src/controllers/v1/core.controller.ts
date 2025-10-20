import { Controller, Get } from '@nestjs/common';
import { AppService } from '../../services/app.service';
import { CoreStateV1Response } from '../../classes/api/v1/core/state';
import { getExperiments } from '../../constants/experiments';

@Controller('/api/v1/core')
export class CoreControllerV1 {
  constructor(private readonly appService: AppService) {}

  @Get('')
  coreState(): CoreStateV1Response {
    return this.appService.getState();
  }

  @Get('/experiments')
  experiments() {
    return getExperiments();
  }
}
