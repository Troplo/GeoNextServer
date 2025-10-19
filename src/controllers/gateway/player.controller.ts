import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
} from '@nestjs/websockets';
import {
  GameSocketClientEvent,
  GameSocketClientEvents,
} from '../../types/socket/clientEvents';
import { GameGateway, SocketWithUser } from '../../gateways/game.gateway';
import { RequestType } from '../../utils/gateway';
import { GeoError } from '../../errors';
import { RoomPlayerRedisService } from '../../services/models/roomPlayer.redis.service';
import {
  GameSocketEventsServer,
  GameSocketServerEvent,
} from '../../types/socket/serverEvents';
import { PlayerRedisService } from '../../services/models/player.redis.service';

@Injectable()
export class PlayerGatewayController {
  constructor(
    private readonly playerService: PlayerRedisService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gateway: GameGateway,
    private readonly roomPlayerRedisService: RoomPlayerRedisService,
  ) {}

  async userUpdateName(
    _data: RequestType<GameSocketClientEvents['USER_UPDATE_NAME']>,
    socket: SocketWithUser,
  ) {
    if (!socket.game || !socket.game.playerId || !socket.game.currentRoom)
      throw new GeoError('MALFORMED_REQUEST');
    const data =
      this.gateway.parse<GameSocketClientEvents['USER_UPDATE_NAME']>(_data);

    await this.playerService.update({
      update: {
        name: data.data.name,
      },
      where: {
        playerId: socket.game.playerId,
      },
    });

    const roomPlayer = await this.roomPlayerRedisService.lookup({
      roomName: socket.game.currentRoom,
      playerId: socket.game.playerId,
    });

    if (!roomPlayer) return;
    roomPlayer.player = await roomPlayer.getPlayer();

    this.gateway.emitToRoom({
      data: roomPlayer,
      socket,
      event: GameSocketServerEvent.PLAYER_UPDATED,
    });
  }
}
