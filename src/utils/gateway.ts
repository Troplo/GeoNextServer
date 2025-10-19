// import {
//   EventResponse,
//   Request,
//   Response,
//   GameSocketEventsServer,
// } from '../types/socket/serverEvents';
//
// type HandlerResult<K extends keyof GameSocketEventsServer> =
//   GameSocketEventsServer[K] extends { errors: infer E }
//     ? GameSocketEventsServer[K]['payload'] | E
//     : GameSocketEventsServer[K]['payload'];

// /**
//  * Handles a request and ensures the response includes the same ID
//  * @param request - Request object from client (with id)
//  * @param handler - Function that returns either payload or AppErrorObject
//  * @returns EventResponse with proper typing
//  */
// export function handleRequest<
//   K extends keyof GameSocketEventsServer,
//   ReqPayload extends GameSocketEventsServer[K]['payload'],
// >(
//   request: Request<ReqPayload>,
//   handler: (payload: ReqPayload) => HandlerResult<K>,
// ): EventResponse<K> {
//   const result = handler(request);
//
//   if (result && typeof result === 'object' && 'errors' in result) {
//     return {
//       id: request.id,
//       errors: (result as any).errors,
//     } as EventResponse<K>;
//   }
//
//   return {
//     id: request.id,
//     data: result as GameSocketEventsServer[K]['payload'],
//   } as EventResponse<K>;
// }

export type RequestType<T> = {
  data: T;
  id?: string;
};
