import type { PaintMessage } from "../state/types";

/**
 * The seam that makes multiplayer cheap later.
 *
 * Golden rule: no gameplay code touches a panel canvas directly. Every paint
 * operation goes out through send() and comes back through onMessage(). In
 * local mode the echo is instant; when SocketTransport lands, the message goes
 * to the server and returns as a broadcast — and nothing in paint/, world/ or
 * state/ has to change.
 */
export interface Transport {
  send(message: PaintMessage): void;
  onMessage(handler: (message: PaintMessage) => void): void;
  connect(): Promise<void>;
  disconnect(): void;
}
