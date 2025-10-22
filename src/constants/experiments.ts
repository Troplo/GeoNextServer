export enum Experiments {
  GAME_RECONNECT_FORCE_RERENDER = 'GAME_RECONNECT_FORCE_RERENDER',
  REROLL_EASTER_EGG_CHANCE = 'REROLL_EASTER_EGG_CHANCE',
  GAME_AUTO_RECONNECT = 'GAME_AUTO_RECONNECT',
  DEBUG_MENU = 'DEBUG_MENU',
  INTERACTIVE_BUTTONS = 'INTERACTIVE_BUTTONS',
  DISABLE_ANIMATIONS = 'DISABLE_ANIMATIONS',
}

export enum ExperimentsMeta {
  meta = 'meta',
}

export type ExperimentsLegacy = Experiments | ExperimentsMeta;

// Experiments with the same keys may sync from Flowinity account.
export function getExperiments() {
  return {
    GAME_RECONNECT_FORCE_RERENDER: false,
    REROLL_EASTER_EGG_CHANCE: 0.05,
    GAME_AUTO_RECONNECT: true,
    DEBUG_MENU: true,
    INTERACTIVE_BUTTONS: true,
    DISABLE_ANIMATIONS: false,
    meta: {
      GAME_RECONNECT_FORCE_RERENDER: {
        description: 'Force rerender the game on reconnection.',
        createdAt: '2025-10-22T00:00:00.000Z',
        versions: [2],
      },
      REROLL_EASTER_EGG_CHANCE: {
        description: 'Chance of Reroll easter egg audio playback. (FLOAT)',
        createdAt: '2025-10-22T00:00:00.000Z',
        versions: [2],
      },
      GAME_AUTO_RECONNECT: {
        description:
          "Automatically reconnect when there's a network issue while playing the game.",
        createdAt: '2025-10-21T00:00:00.000Z',
        versions: [2],
      },
      DEBUG_MENU: {
        description: 'Enable CTRL + ALT + M Development Menu',
        createdAt: '2025-10-20T00:00:00.000Z',
        versions: [2],
      },
      INTERACTIVE_BUTTONS: {
        description:
          'Enable interactive buttons. Responsible for: Shimmer, Button Press Effect',
        createdAt: '2025-10-03T00:00:00.000Z',
        versions: [2],
      },
      DISABLE_ANIMATIONS: {
        description: 'Disable Progressive UI animations.',
        createdAt: '2024-05-11T00:00:00.000Z',
        versions: [2],
      },
    } as {
      [key: string]: {
        description: string;
        createdAt: string;
        versions: number[];
        refresh?: boolean;
        force?: boolean;
        override?: boolean;
      };
    },
  };
}
