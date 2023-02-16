import { base58encode } from "./base58";
import { ripemd160, sha256 } from "./hashes";
import { joinBuffers } from "./joinBuffer";

export function bitcoinAddressFromP2PKH(pubKeyHash: Buffer) {
  const withNetworkId = joinBuffers(Buffer.from("00", "hex"), pubKeyHash);
  const hash = sha256(sha256(withNetworkId));

  const base256 = joinBuffers(withNetworkId, hash.subarray(0, 4));
  return base58encode(base256);
}

function checkPublicKey(pubKey: Buffer) {
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

export function bitcoinAddressP2PKHFromPublicKey(pubKey: Buffer) {
  checkPublicKey(pubKey);
  return bitcoinAddressFromP2PKH(ripemd160(sha256(pubKey)));
}
