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
import { PlayerRedisService } from '../services/models/player.redis.service';
import { RoomPlayerRedisService } from '../services/models/roomPlayer.redis.service';
import { PlayerGatewayController } from '../controllers/gateway/player.controller';
import { RoomGatewayController } from '../controllers/gateway/room.controller';
import { RoomPlayerService } from '../services/roomPlayer.service';

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
    PlayerRedisService,
    RoomPlayerRedisService,
    SessionRedisService,
    RoomRedisService,
    RoomService,
    AppService,
    GameGateway,
    RoomPlayerService,
    PlayerGatewayController,
    RoomGatewayController,
  ],
})
export class AppModule {}
