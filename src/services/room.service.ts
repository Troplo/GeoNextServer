import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RoomRedisService } from './models/room.redis.service';
import { Room, RoomState } from '../classes/rooms/Room';
import { RoomPlayerRedisService } from './models/roomPlayer.redis.service';
import { GameGateway, SocketWithUser } from '../gateways/game.gateway';
import { GameSocketServerEvent } from '../types/socket/serverEvents';
import { PlayerRedisService } from './models/player.redis.service';

@Injectable()
export class RoomService {
  constructor(
    private readonly roomRedisService: RoomRedisService,
    private readonly roomPlayerRedisService: RoomPlayerRedisService,
    // fix circular dependency
    @Inject(forwardRef(() => GameGateway))
    private readonly gateway: GameGateway,
    private readonly playerService: PlayerRedisService,
  ) {}

  async lookup({ name }: { name: string | null }): Promise<Room | null> {
    return this.roomRedisService.lookup({ name });
  }

  async create({
    name,
    ownerPlayerId,
  }: {
    name: string;
    ownerPlayerId: string;
  }): Promise<Room | false> {
    const room = await this.roomRedisService.create({ name, ownerPlayerId });

    if (room)
      await this.playerService.update({
        update: {
          lastRoom: room.name,
        },
        where: {
          playerId: ownerPlayerId,
        },
      });

    return room;
  }

  async join({
    roomName,
    playerId,
    socketId,
  }: {
    roomName: string;
    playerId: string;
    socketId: string;
  }): Promise<boolean> {
    const room = await this.lookup({ name: roomName });
    if (!room) return false;
    const joined = await this.roomPlayerRedisService.lookup({
      roomName,
      playerId,
    });

    console.log(room, joined, playerId);

    if (joined && joined.connected && joined.socketId) {
      return false;
    } else if (joined) {
      // If the user disconnected from the socket due to a network issue or refresh
      const success = await this.roomPlayerRedisService.update({
        update: {
          connected: true,
          socketId,
        },
        where: {
          roomName,
          playerId,
        },
      });

      await this.playerService.update({
        update: {
          lastRoom: roomName,
        },
        where: {
          playerId,
        },
      });

      return !!success;
    } else if (!room.started) {
      const success = await this.roomPlayerRedisService.create({
        roomName,
        playerId,
      });

      await this.playerService.update({
        update: {
          lastRoom: roomName,
        },
        where: {
          playerId,
        },
      });

      return !!success;
    }

    return false;
  }

  async reconnect({
    roomName,
    playerId,
    socketId,
  }: {
    roomName: string;
    playerId: string;
    socketId: string;
  }): Promise<boolean> {
    const success = await this.roomPlayerRedisService.update({
      update: {
        connected: true,
        socketId,
      },
      where: {
        roomName,
        playerId,
      },
    });
    return !!success;
  }

  async disconnect({
    roomName,
    playerId,
  }: {
    roomName: string;
    playerId: string;
  }): Promise<boolean> {
    const success = await this.roomPlayerRedisService.update({
      update: {
        connected: false,
        socketId: null,
      },
      where: {
        roomName,
        playerId,
      },
    });
    return !!success;
  }

  async checkIfOwned({
    roomName,
    playerId,
  }: {
    roomName?: string | null;
    playerId?: string | null;
  }): Promise<boolean> {
    if (!roomName || !playerId) return false;

    const room = await this.lookup({ name: roomName });

    if (!room) return false;

    return room.ownerPlayerId === playerId;
  }

  async update({
    update,
    where,
  }: {
    update: Partial<Room>;
    where: {
      roomName: string;
    };
  }): Promise<false | Room> {
    return this.roomRedisService.update({ update, where });
  }

  async checkIfPlaying({
    roomName,
    playerId,
  }: {
    roomName?: string | null;
    playerId?: string | null;
  }): Promise<boolean> {
    if (!roomName || !playerId) return false;

    const room = await this.lookup({ name: roomName });

    if (!room) return false;

    const players = await room.getPlayers();

    return !!players.find((plyr) => plyr.playerId === playerId);
  }

  async setState(room: Room, state: RoomState) {
    if (room.state !== state) {
      room._setState(state);
      await room.update();
      this.gateway.emitToRoomName({
        roomName: room.name,
        event: GameSocketServerEvent.GAME_STATE_UPDATED,
        data: {
          round: room.currentRound,
          state: state,
        },
      });
    }
  }

  async quitRoom(roomName: string, playerId?: string) {
    const name = `room:${roomName}`;
    const room = this.gateway.server.sockets.adapter.rooms.get(name);

    if (!room) return;

    for (const socketId of room) {
      const socket = this.gateway.server.sockets.sockets.get(
        socketId,
      ) as SocketWithUser;
      if (socket && (socket.game?.playerId === playerId || !playerId)) {
        if (socket.game?.currentRoom === roomName)
          socket.game.currentRoom = null;
        await socket.leave(roomName);

        if (playerId) {
          // Notify other players that the user has left
          const roomPlayer = await this.roomPlayerRedisService.lookup({
            playerId,
            roomName,
          });
          if (roomPlayer) {
            await roomPlayer.dispose();
            this.gateway.emitToRoomName({
              event: GameSocketServerEvent.ROOM_PLAYER_LEFT,
              data: roomPlayer,
              roomName,
            });
          }
        }
      }
    }
  }

  async getDisconnectedRoom(playerId: string): Promise<Room | null> {
    const player = await this.playerService.lookup({ playerId });
    if (!player) return null;
    if (player.lastRoom) {
      const room = await this.lookup({ name: player.lastRoom });
      if (!room) return null;
      const players = await room.getPlayers();
      if (players.find((plyr) => plyr.playerId === playerId)) {
        return room;
      }
    }

    return null;
  }
}
