import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AuthService } from '../services/auth.service';
import { Socket } from 'socket.io';
import {
  GameSocketClientEvent,
  GameSocketClientEvents,
} from '../types/socket/clientEvents';
import { GameSocketEventsServer } from '../types/socket/serverEvents';
import { GeoError } from '../errors';
import { RoomService } from '../services/room.service';
import { PlayerRedisService } from '../services/models/player.redis.service';
import { RoomPlayerRedisService } from '../services/models/roomPlayer.redis.service';
import { RoomGatewayController } from '../controllers/gateway/room.controller';
import { PlayerGatewayController } from '../controllers/gateway/player.controller';
import { RequestType } from '../utils/gateway';

export interface SocketWithUser extends Socket {
  game: {
    playerId: string | null;
    currentRoom: string | null;
  };
}

@WebSocketGateway({
  path: '/api/v1/socket/game',
})
export class GameGateway {
  constructor(
    private readonly authService: AuthService,
    private readonly roomGw: RoomGatewayController,
    private readonly playerGw: PlayerGatewayController,
  ) {}

  @WebSocketServer() server;

  async handleConnection(socket: SocketWithUser) {
    const token = socket.handshake.auth.token as string | null;
    const session = await this.authService.getSessionInfo(token);
    console.log(session);
    if (session) {
      await socket.join(`player:${session.playerId}`);
      socket.game = {
        playerId: session.playerId,
        currentRoom: null,
      };
    } else {
      socket.disconnect();
    }
  }

  parse<T>(data: { data: T; id?: string }): { data: T; id?: string } {
    try {
      return data;
    } catch {
      throw new GeoError('MALFORMED_REQUEST');
    }
  }

  emitToPlayer<E extends keyof GameSocketEventsServer>({
    data,
    socket,
    event,
    id,
  }: {
    data: GameSocketEventsServer[E];
    socket: SocketWithUser;
    event: E;
    id?: string;
  }) {
    this.server?.to(`player:${socket.game.playerId}`)?.emit(event, {
      data,
      id,
    });
  }

  emitToRoom<E extends keyof GameSocketEventsServer>({
    data,
    socket,
    event,
    id,
    excludeUser = false,
  }: {
    data: GameSocketEventsServer[E];
    socket: SocketWithUser;
    event: E;
    id?: string;
    excludeUser?: boolean;
  }) {
    if (socket.game.currentRoom) {
      socket.to(`room:${socket.game.currentRoom}`).emit(event, {
        data,
        id,
      });
    }

    if (!excludeUser) {
      this.emitToPlayer({
        data,
        socket,
        event,
        id,
      });
    }
  }

  @SubscribeMessage(GameSocketClientEvent.CREATE_ROOM)
  async createRoomRequest(
    @MessageBody() _data: RequestType<GameSocketClientEvents['CREATE_ROOM']>,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    return this.roomGw.createRoomRequest(_data, socket);
  }

  @SubscribeMessage(GameSocketClientEvent.USER_UPDATE_NAME)
  async userUpdateName(
    @MessageBody()
    _data: RequestType<GameSocketClientEvents['USER_UPDATE_NAME']>,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    return this.playerGw.userUpdateName(_data, socket);
  }

  @SubscribeMessage(GameSocketClientEvent.GAME_START)
  async gameStart(
    @MessageBody()
    _data: RequestType<GameSocketClientEvents['GAME_START']>,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    return this.roomGw.gameStart(_data, socket);
  }

  @SubscribeMessage(GameSocketClientEvent.GAME_POPULATE_ROUND_INFO)
  gamePopulateRoundInfo(
    @MessageBody()
    _data: RequestType<GameSocketClientEvents['GAME_POPULATE_ROUND_INFO']>,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    return this.roomGw.gamePopulateRoundInfo(_data, socket);
  }

  @SubscribeMessage(GameSocketClientEvent.GAME_COMMIT_GUESS)
  gameCommitGuess(
    @MessageBody()
    _data: RequestType<GameSocketClientEvents['GAME_COMMIT_GUESS']>,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    return this.roomGw.gameCommitGuess(_data, socket);
  }

  @SubscribeMessage(GameSocketClientEvent.GAME_READY_TO_LEAVE)
  gameReadyToLeave(
    @MessageBody()
    _data: RequestType<GameSocketClientEvents['GAME_READY_TO_LEAVE']>,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    return this.roomGw.gameReadyToLeave(_data, socket);
  }
}
