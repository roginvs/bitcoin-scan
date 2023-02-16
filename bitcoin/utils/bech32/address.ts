import { checkPublicKey } from "../checkPublicKey";
import { ripemd160, sha256 } from "../hashes";
import { encode } from "./segwit_addr";

export function bitcoinAddressP2WPKHromPublicKey(pubKey: Buffer) {
  checkPublicKey(pubKey);
  const hash = ripemd160(sha256(pubKey));
  return encode("bc", 0, [...hash]);
}

export function bitcoinAddressP2WSHromPublicKey(pubKey: Buffer) {
  checkPublicKey(pubKey);
  const script = Buffer.concat([
    Buffer.from([
      pubKey.length, // Push script to stack
    ]),
    pubKey,
    Buffer.from([
      0xac, // OP_CHECKSIG
    ]),
  ]);
  const scriptHash = sha256(script);
  return encode("bc", 0, [...scriptHash]);
}
