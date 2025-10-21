import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RoomRedisService } from './models/room.redis.service';
import { Room, RoomState } from '../classes/rooms/Room';
import { RoomPlayerRedisService } from './models/roomPlayer.redis.service';
import { GameGateway, SocketWithUser } from '../gateways/game.gateway';
import { GameSocketServerEvent } from '../types/socket/serverEvents';
import { PlayerRedisService } from './models/player.redis.service';
import { KICK_IN_MS } from '../constants/server';
import { RoomPlayer } from '../classes/rooms/RoomPlayer';

export enum JoinResponse {
  FAILED,
  JOINED,
  REJOINED,
}

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
  }): Promise<JoinResponse> {
    const room = await this.lookup({ name: roomName });
    if (!room) return JoinResponse.FAILED;
    const joined = await this.roomPlayerRedisService.lookup({
      roomName,
      playerId,
    });

    console.log(room, joined, playerId);

    if (joined && joined.connected && joined.socketId) {
      return JoinResponse.FAILED;
    } else if (!room.started) {
      let success: boolean = false;
      if (joined) {
        const plyr = await this.roomPlayerRedisService.update({
          where: {
            playerId,
            roomName,
          },
          update: {
            connected: true,
            socketId: socketId,
            kickAt: null,
          },
        });
        if (plyr) success = true;
      } else {
        const plyr = await this.roomPlayerRedisService.create({
          roomName,
          playerId,
        });
        if (plyr) success = true;
      }

      await this.playerService.update({
        update: {
          lastRoom: roomName,
        },
        where: {
          playerId,
        },
      });

      return success ? JoinResponse.JOINED : JoinResponse.FAILED;
    } else if (!joined?.connected) {
      const existingPlayer = await this.roomPlayerRedisService.lookup({
        playerId,
        roomName,
      });

      if (!existingPlayer?.connected) {
        const reconnect = await this.reconnect({
          roomName,
          playerId,
          socketId,
        });
        await this.playerService.update({
          update: {
            lastRoom: roomName,
          },
          where: {
            playerId,
          },
        });
        if (reconnect) return JoinResponse.REJOINED;
        return JoinResponse.FAILED;
      }
    }

    return JoinResponse.FAILED;
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
    const roomPlayer = await this.roomPlayerRedisService.update({
      update: {
        connected: true,
        socketId,
        kickAt: null,
      },
      where: {
        roomName,
        playerId,
      },
    });
    if (roomPlayer)
      this.gateway.emitToRoomName({
        roomName,
        event: GameSocketServerEvent.ROOM_PLAYER_RECONNECTED,
        data: (await this.roomPlayerRedisService.lookup({
          playerId,
          roomName,
        }))!,
      });
    return !!roomPlayer;
  }

  async disconnect({
    roomName,
    playerId,
  }: {
    roomName: string;
    playerId: string;
  }): Promise<boolean> {
    const roomPlayer = await this.roomPlayerRedisService.update({
      update: {
        connected: false,
        socketId: null,
        kickAt: new Date().getTime() + KICK_IN_MS,
      },
      where: {
        roomName,
        playerId,
      },
    });
    if (roomPlayer)
      this.gateway.emitToRoomName({
        roomName,
        event: GameSocketServerEvent.ROOM_PLAYER_DISCONNECTED,
        data: (await this.roomPlayerRedisService.lookup({
          playerId,
          roomName,
        }))!,
      });
    return !!roomPlayer;
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

  // TODO: This function could be better.
  async quitRoom(roomName: string, playerId: string) {
    const name = `room:${roomName}`;
    const room = this.gateway.server.sockets.adapter.rooms.get(name);

    console.log(`${roomName} ${playerId} left`);
    try {
      await this.playerService.update({
        update: { lastRoom: null },
        where: { playerId },
      });
    } catch {
      // ignore errors
    }

    // Lookup the roomPlayer regardless of socket room presence
    const roomPlayer = await this.roomPlayerRedisService.lookup({
      playerId,
      roomName,
    });

    if (roomPlayer) {
      const currentRoom = await this.lookup({ name: roomName });

      if (currentRoom && currentRoom.ownerPlayerId === playerId) {
        const players = await currentRoom.getPlayers();
        let newOwner = players.find((p) => p.connected);

        if (!newOwner) {
          newOwner = [...players].sort(
            (a, b) => (b.kickAt || 0) - (a.kickAt || 0),
          )[0];
        }

        if (newOwner) {
          await this.update({
            update: { ownerPlayerId: newOwner.playerId },
            where: { roomName },
          });
        }
      }

      this.gateway.emitToRoomName({
        event: GameSocketServerEvent.ROOM_PLAYER_LEFT,
        data: roomPlayer,
        roomName,
      });

      await roomPlayer.dispose();
    }

    // If the socket room exists, remove the player from it
    if (room) {
      for (const socketId of room) {
        const socket = this.gateway.server.sockets.sockets.get(
          socketId,
        ) as SocketWithUser;

        if (socket && (socket.game?.playerId === playerId || !playerId)) {
          if (socket.game?.currentRoom === roomName)
            socket.game.currentRoom = null;
          await socket.leave(roomName);
        }
      }
    }

    for (const socketId of room || []) {
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

  checkIfAnySocketsAreConnected(roomName: string, playerId?: string): boolean {
    const name = `room:${roomName}`;
    const room = this.gateway.server.sockets.adapter.rooms.get(name);

    if (!room) return false;

    for (const socketId of room) {
      const socket = this.gateway.server.sockets.sockets.get(
        socketId,
      ) as SocketWithUser;
      if (socket && (socket.game?.playerId === playerId || !playerId)) {
        return true;
      }
    }

    return false;
  }

  async getDisconnectedRoom(playerId: string): Promise<Room | null> {
    const player = await this.playerService.lookup({ playerId });
    if (!player) return null;
    if (player.lastRoom) {
      const room = await this.lookup({ name: player.lastRoom });
      if (!room) return null;
      const players = await room.getPlayers();
      const roomPlayer = players.find((plyr) => plyr.playerId === playerId);

      if (roomPlayer?.connected) {
        // if the backend restarts, it will break it, but also we need to consider if the user
        // opened a new tab
        if (this.checkIfAnySocketsAreConnected(room.name, playerId)) {
          // temporarily return nothing if user opened a new tab
          return null;
        } else {
          await this.roomPlayerRedisService.update({
            where: {
              playerId,
              roomName: room.name,
            },
            update: {
              connected: false,
              socketId: null,
              kickAt: new Date().getTime() + KICK_IN_MS,
            },
          });
        }
      }

      if (roomPlayer) {
        return room;
      }
    }

    return null;
  }

  emitStreetViewPopulateRequestOwner(room: Room, increment: boolean = true) {
    const owner = room.ownerPlayerId;

    const newRound = increment ? room.currentRound + 1 : room.currentRound;

    this.gateway.emitToPlayerId({
      playerId: owner,
      event: GameSocketServerEvent.GAME_REQUEST_STREET_VIEW_POPULATE,
      data: {
        round: newRound,
      },
    });
  }

  async checkGameProgressState(room: Room) {
    const players = await room.getPlayers();

    // STATE: RE-ROLL GAME
    const shouldReRoll = players.every((plyr) =>
      plyr.rounds.some(
        (rnd) => rnd.round === room.currentRound && rnd.votedReRoll,
      ),
    );

    if (shouldReRoll && room.state === RoomState.IN_GAME) {
      for (const player of players) {
        const round = player.rounds.find(
          (rnd) => rnd.round === room.currentRound,
        );
        if (round) {
          round.votedReRoll = false;
          await this.roomPlayerRedisService.update({
            update: {
              rounds: player.rounds,
            },
            where: {
              playerId: player.playerId,
              roomName: room.name,
            },
          });
        }
      }
      this.emitStreetViewPopulateRequestOwner(room, false);
    }

    // STATE: FINISH ROUND

    const shouldProgressRound = players.every((plyr) =>
      plyr.rounds.some((rnd) => rnd.round === room.currentRound && rnd.guessed),
    );

    if (shouldProgressRound && room.state === RoomState.IN_GAME) {
      await this.setState(room, RoomState.ROUND_FINISHED);
    }

    // STATE: FINISH ROUND AND CONTINUE
    const shouldProgressRoundContinue = players.every((plyr) =>
      plyr.rounds.some(
        (rnd) =>
          rnd.round === room.currentRound && rnd.guessed && rnd.readyToContinue,
      ),
    );

    if (
      shouldProgressRoundContinue &&
      room.state === RoomState.ROUND_FINISHED
    ) {
      this.emitStreetViewPopulateRequestOwner(room);
    }

    // STATE: EXIT GAME

    if (players.filter((plyr) => plyr.readyToLeave).length === players.length) {
      this.gateway.emitToRoomName({
        event: GameSocketServerEvent.GAME_FINISHED,
        data: {},
        roomName: room.name,
      });
      for (const player of players) {
        await this.quitRoom(room.name, player.playerId);
      }
      await room.dispose();
    }
  }
}
