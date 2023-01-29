import { sha256 } from "./hashes";
import { Nominal } from "./nominaltypes";

export function joinBuffers(...buffers: Buffer[]) {
  const len = buffers.reduce((acc, cur) => (acc = acc + cur.length), 0);
  const out = Buffer.alloc(len);
  let i = 0;
  for (const b of buffers) {
    b.copy(out, i);
    i += b.length;
  }
  return out;
}

export type BitcoinMessage = Nominal<"bitcoin message", Buffer>;
export type MessagePayload = Nominal<"message payload", Buffer>;

const magicBuf = Buffer.from("F9BEB4D9", "hex");
export function buildMessage(command: string, payload: MessagePayload) {
  const commandBuf = Buffer.alloc(12).fill(0);
  commandBuf.write(command);

  const out = Buffer.alloc(
    magicBuf.length + commandBuf.length + 4 + 4 + payload.length
  );
  magicBuf.copy(out, 0);
  commandBuf.copy(out, magicBuf.length);
  out.writeInt32LE(payload.length, magicBuf.length + commandBuf.length);

  const checksum = sha256(sha256(payload)).subarray(0, 4);
  checksum.copy(out, magicBuf.length + commandBuf.length + 4);

  payload.copy(out, magicBuf.length + commandBuf.length + 4 + 4);

  return out as BitcoinMessage;
}
