import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { GameSocketClientEvents } from '../../types/socket/clientEvents';
import { GameGateway, SocketWithUser } from '../../gateways/game.gateway';
import { RequestType } from '../../utils/gateway';
import { GeoError } from '../../errors';
import { JoinResponse, RoomService } from '../../services/room.service';
import { RoomPlayerRedisService } from '../../services/models/roomPlayer.redis.service';
import { GameSocketServerEvent } from '../../types/socket/serverEvents';
import { Room, RoomConfig, RoomState, Round } from '../../classes/rooms/Room';
import { RoomPlayerService } from '../../services/roomPlayer.service';

@Injectable()
export class RoomGatewayController {
  constructor(
    private readonly roomService: RoomService,
    // fix circular dependency
    @Inject(forwardRef(() => GameGateway))
    private readonly gateway: GameGateway,
    private readonly roomPlayerRedisService: RoomPlayerRedisService,
    private readonly roomPlayerService: RoomPlayerService,
  ) {}

  async createRoomRequest(
    _data: RequestType<GameSocketClientEvents['CREATE_ROOM']>,
    socket: SocketWithUser,
  ) {
    if (!socket.game || !socket.game.playerId || socket.game.currentRoom)
      throw new GeoError('MALFORMED_REQUEST');
    socket.game.currentRoom = 'PENDING';
    try {
      const data =
        this.gateway.parse<GameSocketClientEvents['CREATE_ROOM']>(_data);
      if (!data.data.name) throw new GeoError('MALFORMED_REQUEST');
      if (data.data.name.length > 64) throw new GeoError('ROOM_NAME_MAX_CHAR');
      if (data.data.name.length < 3) throw new GeoError('ROOM_NAME_MIN_CHAR');
      const room =
        (await this.roomService.lookup({ name: data.data.name })) ||
        (await this.roomService.create({
          name: data.data.name,
          ownerPlayerId: socket.game.playerId,
        }));

      if (!room) throw new GeoError('ROOM_NAME_UNAVAILABLE');

      const joined = await this.roomService.join({
        roomName: data.data.name,
        playerId: socket.game.playerId,
        socketId: socket.id,
      });
      if (!joined) throw new GeoError('ROOM_NAME_UNAVAILABLE');
      await socket.join(`room:${data.data.name}`);
      socket.game.currentRoom = data.data.name;

      room.players = await room.getPlayers();

      const roomPlayer = await this.roomPlayerRedisService.lookup({
        roomName: data.data.name,
        playerId: socket.game.playerId,
      });

      if (!roomPlayer) throw new GeoError('ROOM_NAME_UNAVAILABLE');

      roomPlayer.player = await roomPlayer.getPlayer();
      console.log(`joined`, joined);

      this.gateway.emitToPlayer({
        data: room,
        socket,
        event: GameSocketServerEvent.CREATE_ROOM_RESPONSE,
        id: data.id,
      });

      console.log(`joined`, joined);

      if (joined !== JoinResponse.REJOINED) {
        this.gateway.emitToRoom({
          data: roomPlayer,
          event: GameSocketServerEvent.ROOM_PLAYER_JOINED,
          excludeUser: true,
          id: data.id,
          socket,
        });
      } else {
        if (room.started) {
          this.gateway.emitToPlayer({
            data: {
              config: room.config,
              roomName: data.data.name,
            },
            socket,
            event: GameSocketServerEvent.GAME_STARTED,
          });
          socket.game.needsResumeData = true;
        }
      }
    } catch (e) {
      socket.game.currentRoom = null;
      throw e;
    }
  }

  async gameStart(
    _data: RequestType<GameSocketClientEvents['GAME_START']>,
    socket: SocketWithUser,
  ) {
    const { data } =
      this.gateway.parse<GameSocketClientEvents['GAME_START']>(_data);

    if (data.roomName !== socket.game.currentRoom) return;

    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });

    if (!room || room.started) return;

    if (
      !(await this.roomService.checkIfOwned({
        roomName: room.name,
        playerId: socket.game.playerId,
      }))
    )
      return;

    const newRoom = await this.roomService.update({
      where: {
        roomName: room.name,
      },
      update: {
        started: true,
        config: new RoomConfig({
          ...room.config,
          ...data.config,
        }),
      },
    });

    if (newRoom)
      this.gateway.emitToRoom({
        event: GameSocketServerEvent.GAME_STARTED,
        data: {
          config: newRoom.config,
          roomName: newRoom.name,
        },
        socket,
        excludeUser: false,
      });

    // we can't emit the streetview population event here, we need to wait for READY first.
  }

  async gamePopulateRoundInfo(
    _data: RequestType<GameSocketClientEvents['GAME_POPULATE_ROUND_INFO']>,
    socket: SocketWithUser,
  ) {
    const data =
      this.gateway.parse<GameSocketClientEvents['GAME_POPULATE_ROUND_INFO']>(
        _data,
      );

    console.log(_data, 'gamePopulateRoundInfo');
    if (
      !(await this.roomService.checkIfOwned({
        roomName: socket.game.currentRoom,
        playerId: socket.game.playerId,
      }))
    )
      return;

    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });

    if (!room) return;

    const existingRoundIndex = room.rounds.findIndex(
      (rnd) => rnd.round === data.data.round,
    );

    let round: Round;

    if (existingRoundIndex !== -1) {
      room.rounds[existingRoundIndex].latitude = data.data.latitude;
      room.rounds[existingRoundIndex].longitude = data.data.longitude;
      room.rounds[existingRoundIndex].warning = data.data.warning;
      room.rounds[existingRoundIndex].timerStart = new Date().getTime();
      round = room.rounds[existingRoundIndex];
    } else {
      round = new Round({
        latitude: data.data.latitude,
        longitude: data.data.longitude,
        warning: data.data.warning,
        round: data.data.round,
      });

      room.rounds.push(round);
      room.currentRound = round.round;
    }

    this.gateway.emitToRoom({
      event: GameSocketServerEvent.GAME_NEW_ROUND,
      data: round,
      socket,
    });
    await this.roomService.setState(room, RoomState.IN_GAME);

    const newRoom = await this.roomService.update({
      update: {
        rounds: room.rounds,
        currentRound: room.currentRound,
      },
      where: {
        roomName: room.name,
      },
    });

    if (newRoom) await this.roomService.setState(newRoom, RoomState.IN_GAME);
  }

  async gameCommitGuess(
    _data: RequestType<GameSocketClientEvents['GAME_COMMIT_GUESS']>,
    socket: SocketWithUser,
  ) {
    const { data } =
      this.gateway.parse<GameSocketClientEvents['GAME_COMMIT_GUESS']>(_data);

    if (!socket.game || !socket.game.currentRoom || !socket.game.playerId)
      return;

    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });

    if (!room || !room.started || !room.getRoundIsValid(data.round)) return;

    const round = await this.roomPlayerService.setRoundScoreDetails({
      round: data.round,
      roomName: room.name,
      scoreDetails: {
        guessed: true,
        points: data.points,
        distance: data.distance,
        latitude: data.latitude,
        longitude: data.longitude,
        timePassed: data.timePassed,
      },
      playerId: socket.game.playerId,
    });

    if (!round) return;

    await this.roomService.checkGameProgressState(room);
  }

  async gameReadyToLeave(
    _data: RequestType<GameSocketClientEvents['GAME_READY_TO_LEAVE']>,
    socket: SocketWithUser,
  ) {
    if (!socket.game.currentRoom || !socket.game.playerId) return;

    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });

    if (!room) return;

    const roomPlayer = await this.roomPlayerRedisService.lookup({
      roomName: socket.game.currentRoom,
      playerId: socket.game.playerId,
    });

    if (!roomPlayer?.canLeave(room.config.nbRoundSelected)) return;

    await this.roomPlayerRedisService.update({
      update: {
        readyToLeave: true,
      },
      where: {
        roomName: socket.game.currentRoom,
        playerId: socket.game.playerId,
      },
    });

    await this.roomService.checkGameProgressState(room);
  }

  async gameRoomLeave(
    _data: RequestType<GameSocketClientEvents['ROOM_LEAVE']>,
    socket: SocketWithUser,
  ) {
    const { data } =
      this.gateway.parse<GameSocketClientEvents['ROOM_LEAVE']>(_data);

    const room = await this.roomService.lookup({ name: data.roomName });

    if (!room || !socket.game?.playerId) return;

    await this.roomService.quitRoom(room.name, socket.game.playerId);
  }

  async gameReady(
    _data: RequestType<GameSocketClientEvents['GAME_READY']>,
    socket: SocketWithUser,
  ) {
    // This is called to ensure the client is listening to all game StreetView events.
    if (!socket.game?.currentRoom) return;
    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });
    if (!room?.started) return;
    if (
      !room.getRoundIsValid(room.currentRound) &&
      socket.game.playerId === room.ownerPlayerId
    ) {
      // Owner needs to populate StreetView data
      this.roomService.emitStreetViewPopulateRequestOwner(room);
    }

    // REJOIN
    // if (socket.game.needsResumeData) {
    if (room.getRoundIsValid(room.currentRound)) {
      this.gateway.emitToPlayer({
        event: GameSocketServerEvent.GAME_NEW_ROUND,
        data: room.getRound(room.currentRound)!,
        socket,
      });
      // socket.game.needsResumeData = false;
      // }
    }
  }

  async gameReadyToContinue(
    _data: RequestType<GameSocketClientEvents['GAME_READY_TO_CONTINUE']>,
    socket: SocketWithUser,
  ) {
    console.log(_data);
    const { data } =
      this.gateway.parse<GameSocketClientEvents['GAME_READY_TO_CONTINUE']>(
        _data,
      );

    if (!socket.game?.currentRoom) return;
    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });
    if (!room?.started) return;
    if (room.currentRound + 1 !== data.nextRound) return;

    await this.roomPlayerService.setRoundCompleted({
      roomName: room.name,
      round: room.currentRound,
      playerId: socket.game.playerId!,
    });

    await this.roomService.checkGameProgressState(room);
  }

  async roomUpdateConfig(
    _data: RequestType<GameSocketClientEvents['ROOM_UPDATE_CONFIG']>,
    socket: SocketWithUser,
  ) {
    const { data } =
      this.gateway.parse<GameSocketClientEvents['ROOM_UPDATE_CONFIG']>(_data);
    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });

    if (!room) return;

    const allowed = await this.roomService.checkIfOwned({
      playerId: socket.game.playerId!,
      roomName: room.name,
    });

    if (!allowed) return;

    room.config = new RoomConfig({
      ...room.config,
      ...data.config,
    });

    await room.update();
  }

  async gameVoteToReRoll(
    _data: RequestType<GameSocketClientEvents['GAME_VOTE_TO_REROLL']>,
    socket: SocketWithUser,
  ) {
    const { data } =
      this.gateway.parse<GameSocketClientEvents['GAME_VOTE_TO_REROLL']>(_data);

    const room = await this.roomService.lookup({
      name: socket.game.currentRoom,
    });

    if (!room || !room.config.allowReRoll) return;

    await this.roomPlayerService.setRoundScoreDetails({
      round: data.round,
      playerId: socket.game.playerId!,
      scoreDetails: {
        votedReRoll: true,
      },
      roomName: room.name,
    });

    await this.roomService.checkGameProgressState(room);
  }
}
