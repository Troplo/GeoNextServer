import { Module } from '@nestjs/common';
import { AppController } from '../controllers/v1/app.controller';
import { AppService } from '../services/app.service';
import { ConfigService } from '../services/config.service';
import { RedisService } from '../services/redis.service';
import { CoreControllerV1 } from '../controllers/v1/core.controller';
import { AuthControllerV1 } from '../controllers/v1/auth.controller';
import { SessionRedisService } from '../services/models/session.redis.service';
import { AuthService } from '../services/auth.service';
import { GameGateway } from '../gateways/game.gateway';
import { RoomRedisService } from '../services/models/room.redis.service';
import { RoomService } from '../services/room.service';
import { RoomControllerV1 } from '../controllers/v1/room.controller';

@Module({
  imports: [],
  controllers: [
    AppController,
    CoreControllerV1,
    AuthControllerV1,
    RoomControllerV1,
  ],
  providers: [
    ConfigService,
    RedisService,
    AuthService,
    SessionRedisService,
    RoomRedisService,
    RoomService,
    AppService,
    GameGateway,
  ],
})
export class AppModule {}
