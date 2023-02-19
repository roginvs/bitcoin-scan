import { PkScript } from "../protocol/messages.types";
import { base58encode } from "./base58";
import { checkPublicKey } from "./checkPublicKey";
import { ripemd160, sha256 } from "./hashes";
import { joinBuffers } from "./joinBuffer";

function bitcoinAddressFromData(data: Buffer, networkType: 0 | 5) {
  const withNetworkId = joinBuffers(Buffer.from([networkType]), data);
  const hash = sha256(sha256(withNetworkId));

  const base256 = joinBuffers(withNetworkId, hash.subarray(0, 4));
  return base58encode(base256);
}

export function bitcoin_address_P2PKH_from_pubkey_hash(pubKeyHash: Buffer) {
  return bitcoinAddressFromData(pubKeyHash, 0);
}
export function bitcoin_address_P2PKH_from_public_key(pubKey: Buffer) {
  checkPublicKey(pubKey);
  return bitcoin_address_P2PKH_from_pubkey_hash(ripemd160(sha256(pubKey)));
}

export function bitcoin_address_P2SH_from_script_hash(scriptHash: Buffer) {
  return bitcoinAddressFromData(scriptHash, 5);
}
export function bitcoin_address_P2SH_from_pk_script(pkScript: PkScript) {
  return bitcoin_address_P2SH_from_script_hash(ripemd160(sha256(pkScript)));
}
