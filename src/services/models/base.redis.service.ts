import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class BaseRedisService {
  constructor(private readonly redisService: RedisService) {}

  getRedis() {
    return this.redisService.getInstance();
  }
}
