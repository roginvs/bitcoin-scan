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

export type NominalBuffer<T extends string> = Nominal<T, Buffer>;
