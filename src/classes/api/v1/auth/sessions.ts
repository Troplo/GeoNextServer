export interface AuthStartSessionV1Response {
  success: boolean;
  token: string;
  playerId: string;
}

export interface AuthRenewSessionV1Response {
  success: boolean;
  token?: string;
  playerId?: string;
}
