export function checkPublicKey(pubKey: Buffer) {
  if (pubKey[0] === 0x04) {
    if (pubKey.length !== 65) {
      throw new Error(`Wrong length for uncompresesed public key`);
    }
  } else if (pubKey[0] === 0x02 || pubKey[0] === 0x03) {
    if (pubKey.length !== 33) {
      throw new Error(`Wrong length for compressed public key`);
    }
  } else {
    throw new Error(`Wrong first byte for public key`);
  }
}
