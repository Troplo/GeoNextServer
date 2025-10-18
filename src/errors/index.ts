export type AppErrorPayload = {
  code: string;
  message: string;
};

export type AppErrorObject = {
  errors: AppErrorPayload[];
};

export const ErrorDefinitions = {
  ROOM_NAME_UNAVAILABLE: 'The room name is unavailable.',
  INVALID_USER: 'User is invalid.',
  MALFORMED_REQUEST: 'Invalid request.',
  ROOM_NAME_MIN_CHAR: 'The room name must be at least 3 characters.',
  ROOM_NAME_MAX_CHAR: 'The room name must be at most 64 characters.',
  UNAUTHORIZED: 'Unauthorized.',
} as const;

type ErrorKey = keyof typeof ErrorDefinitions;

export type ErrorOf<K extends ErrorKey> = {
  errors: [{ code: K; message: typeof ErrorDefinitions[K] }];
};

export class GeoError extends Error {
  public errors: AppErrorPayload[];

  constructor(code: keyof typeof ErrorDefinitions) {
    const message = ErrorDefinitions[code];
    super(message);

    this.name = 'GeoError';
    this.errors = [{ code, message }];
  }
}
