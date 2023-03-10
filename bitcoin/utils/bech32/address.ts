import { PkScript } from "../../protocol/messages.types";
import { checkPublicKey } from "../checkPublicKey";
import { ripemd160, sha256 } from "../hashes";
import { encode } from "./segwit_addr";

export function bitcoin_address_P2WPKH_from_public_key(pubKey: Buffer) {
  checkPublicKey(pubKey);
  const hash = ripemd160(sha256(pubKey));
  return encode("bc", 0, [...hash]);
}

export function bitcoin_address_P2WSH_from_pk_script(pkscript: PkScript) {
  const scriptHash = sha256(pkscript);
  return encode("bc", 0, [...scriptHash]);
}

/** This is what you should store in the outpoint  */
export function get_P2WSH_pk_script_from_real_pk_script(
  pkscript: PkScript
): PkScript {
  const scriptHash = sha256(pkscript);
  return Buffer.concat([Buffer.from("0020", "hex"), scriptHash]) as PkScript;
}

/**
 * This is what you should store in the outpoint/
 * If you want to use P2SH + P2WPKH then do not forget that script code
 *   must be in sigScript stack, not sigScript itself. Just prepend it with 0x16 (check BIP-0141)
 *
 */
export function get_P2WPKH_pk_script_from_public_key(
  publicKey: Buffer
): PkScript {
  const hash = ripemd160(sha256(publicKey));
  return Buffer.concat([Buffer.from("0014", "hex"), hash]) as PkScript;
}

/** Creates a script with this public key */
export function bitcoin_address_P2WSH_from_public_key(pubKey: Buffer) {
  checkPublicKey(pubKey);
  const script = Buffer.concat([
    Buffer.from([
      pubKey.length, // Push script to stack
    ]),
    pubKey,
    Buffer.from([
      0xac, // OP_CHECKSIG
    ]),
  ]) as PkScript;
  return bitcoin_address_P2WSH_from_pk_script(script);
}
