import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from './config.service';

@Injectable()
export class RedisService {
  private readonly redis: Redis;

  constructor(private configService: ConfigService) {
    const redisConfig = configService.get('redis');
    this.redis = new Redis({
      username: redisConfig.username,
      password: redisConfig.password,
      db: redisConfig.db,
      port: redisConfig.port,
    });
  }

  getInstance() {
    return this.redis;
  }
}
