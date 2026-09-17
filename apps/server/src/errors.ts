import type { ErrorPayload } from '@esm-famil/shared';

/** A rule violation the client should hear about; the transport turns it into an ack error. */
export class RoomError extends Error {
  constructor(
    readonly code: ErrorPayload['code'],
    message: string,
  ) {
    super(message);
  }

  toPayload(): ErrorPayload {
    return { code: this.code, message: this.message };
  }
}
