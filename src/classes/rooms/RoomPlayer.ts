import { Player } from '../players/Player';

export class RoomPlayer {
  constructor(options?: Partial<RoomPlayer>) {
    if (options) {
      Object.assign(this, options);
    }
  }

  player: Player;
  connected: boolean = false;
  /**
   * If the player has been disconnected for a long time, they will be kicked by server.
   * @type {number | null}
   */
  kickAt: number | null = null;
  version: number = 1;
}
