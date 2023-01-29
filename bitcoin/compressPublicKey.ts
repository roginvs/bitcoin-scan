export function compressPublicKey(publicKey: Buffer) {
  if (publicKey.length === 32 + 1) {
    if (publicKey[0] === 0x02 || publicKey[0] === 0x03) {
      return publicKey;
    } else {
      // Wrong format
      return null;
    }
  } else if (publicKey.length === 1 + 32 + 32) {
    const isEven = publicKey[publicKey.length - 1] % 2 === 0;
    if (publicKey[0] !== 0x04) {
      return null;
    }
    const out = Buffer.alloc(32 + 1);
    publicKey.copy(out, 0);
    out[0] = isEven ? 0x02 : 0x03;
    return out;
  }
  return null;
}
