import type { Transport } from "./Transport";
import type { PaintMessage } from "../state/types";

/** Single player transport: echoes every message back with no round trip. */
export class LocalTransport implements Transport {
  private handlers: ((message: PaintMessage) => void)[] = [];

  async connect() {}

  disconnect() {
    this.handlers.length = 0;
  }

  send(message: PaintMessage) {
    for (const handler of this.handlers) handler(message);
  }

  onMessage(handler: (message: PaintMessage) => void) {
    this.handlers.push(handler);
  }
}
