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
import { GameSocketServerEvent } from '../types/socket/serverEvents';
import { GeoError } from '../errors';
import { RoomService } from '../services/room.service';

export interface SocketWithUser extends Socket {
  playerId: string | null;
}

@WebSocketGateway({
  path: '/api/v1/socket/game',
})
export class GameGateway {
  constructor(
    private readonly authService: AuthService,
    private readonly roomService: RoomService,
  ) {}

  @WebSocketServer() server;

  async handleConnection(socket: SocketWithUser) {
    const token = socket.handshake.auth.token as string | null;

    const session = await this.authService.getSessionInfo(token);
    if (session) {
      await socket.join(`player:${session.playerId}`);
      socket.playerId = session.playerId;
    } else {
      socket.disconnect();
    }
  }

  parse<T>(data: string): { data: T; id: string } {
    try {
      const parsed: any = JSON.parse(data.toString());
      return parsed;
    } catch {
      throw new GeoError('MALFORMED_REQUEST');
    }
  }

  emitToPlayer({
    data,
    socket,
    event,
    id,
  }: {
    data: object;
    socket: SocketWithUser;
    event: GameSocketServerEvent;
    id: string;
  }) {
    socket.to(`player:${socket.playerId}`).emit(event, {
      id,
      data: {
        payload: data,
      },
    });
  }

  @SubscribeMessage(GameSocketClientEvent.CREATE_ROOM)
  async createRoomRequest(
    @MessageBody() _data: string,
    @ConnectedSocket() socket: SocketWithUser,
  ) {
    const data = this.parse<GameSocketClientEvents['CREATE_ROOM']>(_data);
    if (!data.data.name) throw new GeoError('MALFORMED_REQUEST');
    if (data.data.name.length > 64) throw new GeoError('ROOM_NAME_MAX_CHAR');
    if (data.data.name.length < 3) throw new GeoError('ROOM_NAME_MIN_CHAR');
    const room =
      (await this.roomService.lookup({ name: data.data.name })) ||
      (await this.roomService.create({
        name: data.data.name,
        ownerPlayerId: socket.playerId!,
      }));

    if (!room || room.started) throw new GeoError('ROOM_NAME_UNAVAILABLE');

    this.emitToPlayer({
      data: room,
      socket,
      event: GameSocketServerEvent.CREATE_ROOM_RESPONSE,
      id: data.id,
    });
  }
}
