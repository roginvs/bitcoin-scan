export function bigintToBuf(n: BigInt, len: number = 32) {
  let s = n.toString(16);
  if (s.length % 2 != 0) {
    s = "0" + s;
  }
  if (s.length / 2 > len) {
    throw new Error(`Length is too small`);
  }
  const prefix = "0".repeat(len * 2 - s.length);
  s = prefix + s;
  if (s.length !== len * 2) {
    throw new Error(`Internal error`);
  }
  return Buffer.from(s, "hex");
}
