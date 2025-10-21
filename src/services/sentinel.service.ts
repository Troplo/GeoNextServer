import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { RedisService } from './redis.service';
import Redis from 'ioredis';
import { Room } from '../classes/rooms/Room';
import { ROOM_MAX_LIFE, SENTINEL_SCAN_TIMEFRAME } from '../constants/server';
import { RoomPlayer } from '../classes/rooms/RoomPlayer';

@Injectable()
export class SentinelService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly roomService: RoomService,
    private readonly redisService: RedisService,
  ) {}

  private intervalId: NodeJS.Timeout | null = null;
  private redis: Redis;
  private processing = false;

  onModuleInit() {
    this.startLoop();
  }

  onModuleDestroy() {
    this.stopLoop();
  }

  private startLoop() {
    this.intervalId = setInterval(() => {
      this.loop();
    }, SENTINEL_SCAN_TIMEFRAME);
  }

  private stopLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async loop() {
    try {
      if (!this.redis) {
        this.redis = this.redisService.getInstance();
      }

      if (this.processing) return;
      const NOW = new Date().getTime();
      this.processing = true;

      const keys = await this.redis.keys('room:*');

      const rooms: Room[] = [];

      const filteredKeys = keys.filter((key) => key.match(/^room:[^:]+$/));

      for (const key of filteredKeys) {
        const value = await this.redis.get(key);

        if (!value) continue;

        try {
          rooms.push(new Room(JSON.parse(value)));
        } catch {
          //
        }
      }

      enum RoomPurgeReason {
        ROOM_MAX_LIFE,
        NO_PLAYERS_INTERVAL,
        NO_ACTIVE_PLAYERS,
        NO_PLAYERS_2,
      }

      enum PlayerPurgeReason {
        IDLE_KICK,
      }

      const roomsToPurge: {
        room: Room;
        reason: RoomPurgeReason;
      }[] = [];
      const playersToPurge: {
        player: RoomPlayer;
        reason: PlayerPurgeReason;
      }[] = [];

      for (const room of rooms) {
        // RULE 1: Rooms cannot live longer than ROOM_MAX_LIFE
        if (!room.createdAt || room.createdAt + ROOM_MAX_LIFE <= NOW) {
          roomsToPurge.push({ room, reason: RoomPurgeReason.ROOM_MAX_LIFE });
          continue;
        }

        // RULE 2: Players cannot be disconnected for longer than KICK_IN_MS
        let disconnectedPlayers: RoomPlayer[] = [];
        let players: RoomPlayer[] = [];
        try {
          players = await room.getPlayers(true);
          console.log(players);
          disconnectedPlayers = players.filter(
            (plyr) => !plyr.connected && plyr.kickAt && plyr.kickAt <= NOW,
          );
        } catch {
          // If no players in 5 minutes, assume it's corrupt
          if (room.createdAt >= NOW + 5 * 60 * 1000) {
            Logger.warn("Room is old and doesn't have any players.");
            roomsToPurge.push({
              room,
              reason: RoomPurgeReason.NO_PLAYERS_INTERVAL,
            });
            continue;
          }
        }

        // RULE 3: If the room has no active players, it will also get deleted
        if (room.createdAt <= NOW + 5 * 60 * 1000) {
          if (players.length) {
            const activePlayers = players.filter(function (plyr) {
              return plyr.connected;
            });

            const hasPendingKickPlayers = players.some(function (plyr) {
              return !plyr.connected && plyr.kickAt && plyr.kickAt > NOW;
            });

            if (activePlayers.length === 0 && !hasPendingKickPlayers) {
              roomsToPurge.push({
                room,
                reason: RoomPurgeReason.NO_ACTIVE_PLAYERS,
              });
              continue;
            }
          } else {
            roomsToPurge.push({ room, reason: RoomPurgeReason.NO_PLAYERS_2 });
            continue;
          }
        }

        playersToPurge.push(
          ...disconnectedPlayers.map((plyr) => {
            return {
              player: plyr,
              reason: PlayerPurgeReason.IDLE_KICK,
            };
          }),
        );
      }

      const calledForRoom = new Set<string>();

      for (const { player, reason } of playersToPurge) {
        try {
          Logger.log(
            `Purging playing ${player.playerId} for reason ${reason}!`,
          );
          await this.roomService.quitRoom(player.roomName, player.playerId);
          calledForRoom.add(player.roomName);
        } catch (e) {
          Logger.error(e);
        }
      }

      // If stuck on a waiting screen, we need to refresh the state
      for (const roomName of [...calledForRoom]) {
        const room = await this.roomService.lookup({
          name: roomName,
        });
        if (room) {
          console.log(`calling for ${room.name}`);
          await this.roomService.checkGameProgressState(room);
        }
      }

      if (playersToPurge.length)
        Logger.log(`Successfully purged ${playersToPurge.length} players`);

      console.log(playersToPurge);
      for (const { room, reason } of roomsToPurge) {
        try {
          Logger.log(`Purging room ${room.name} for reason ${reason}!`);
          const players = await room.getPlayers();
          for (const player of players) {
            await this.roomService.quitRoom(room.name, player.playerId);
          }
          await room.dispose();
        } catch (e) {
          Logger.error(e);
        }
      }

      if (roomsToPurge.length)
        Logger.log(`Successfully purged ${roomsToPurge.length} rooms`);

      this.processing = false;
    } catch (e) {
      Logger.fatal(e);
      this.processing = false;
    }
  }
}
