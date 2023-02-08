import { BinaryLike, createHash } from "crypto";

export function sha256(data: BinaryLike) {
  const hash = createHash("sha256").update(data).digest();
  return hash;
}

export function ripemd160(data: BinaryLike) {
  const hash = createHash("ripemd160").update(data).digest();
  return hash;
}
