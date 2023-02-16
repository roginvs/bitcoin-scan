import { base58encode } from "./base58";
import { checkPublicKey } from "./checkPublicKey";
import { ripemd160, sha256 } from "./hashes";
import { joinBuffers } from "./joinBuffer";

export function bitcoinAddressFromP2PKH(pubKeyHash: Buffer) {
  const withNetworkId = joinBuffers(Buffer.from("00", "hex"), pubKeyHash);
  const hash = sha256(sha256(withNetworkId));

  const base256 = joinBuffers(withNetworkId, hash.subarray(0, 4));
  return base58encode(base256);
}

export function bitcoinAddressP2PKHFromPublicKey(pubKey: Buffer) {
  checkPublicKey(pubKey);
  return bitcoinAddressFromP2PKH(ripemd160(sha256(pubKey)));
}
