import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { ConfigService } from './services/config.service';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';

function setEnv() {
  // Used by ConfigService. Do not access or change outside ConfigService.
  process.env._GEOSERVER_ROOT_PATH = path.resolve(__dirname).includes('dist')
    ? path.join(__dirname, '..')
    : path.join(__dirname);
}

async function bootstrap() {
  setEnv();
  const configService = new ConfigService();
  const app = await NestFactory.create(AppModule, {
    logger: configService.get('logLevels'),
  });
  await app.listen(process.env.PORT ?? 24035);
  Logger.log(`Listening on port ${process.env.PORT || 24035}`);
}

bootstrap().then(() => {});
