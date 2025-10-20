export enum Experiments {
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
    DEBUG_MENU: true,
    INTERACTIVE_BUTTONS: true,
    DISABLE_ANIMATIONS: false,
    meta: {
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
