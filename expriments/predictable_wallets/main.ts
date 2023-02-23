import { PkScript } from "../../bitcoin/protocol/messages.types";
import {
  getCompressedPublicKeyFromPrivateKey,
  getUnCompressedPublicKeyFromPrivateKey,
} from "../../bitcoin/protocol/publicKeyFromPrivateKey";
import {
  bitcoin_address_P2PKH_from_pubkey_hash,
  bitcoin_address_P2PKH_from_public_key,
  bitcoin_address_P2SH_from_pk_script,
  bitcoin_address_P2SH_from_script_hash,
} from "../../bitcoin/utils/adresses";
import {
  bitcoin_address_P2WPKH_from_public_key,
  bitcoin_address_P2WSH_from_pk_script,
  get_P2WPKH_pk_script_from_public_key,
  get_P2WSH_pk_script_from_real_pk_script,
} from "../../bitcoin/utils/bech32/address";
import { ripemd160, sha256 } from "../../bitcoin/utils/hashes";

function getSimplePkScripts() {
  const pkScripts = [
    // OP_CHECKSIG
    "AC",
    // OP_number
    ...new Array(16)
      .fill(0)
      .map((_, i) => i + 0x51)
      .map((x) => x.toString(16)),
  ];
  pkScripts.push(
    ...pkScripts.map(
      (s) =>
        //  OP_NOP
        "61" + s
    ),
    ...pkScripts.map(
      (s) =>
        // OP_FALSE OP_DROP
        "0075" + s
    )
  );
  return pkScripts;
}

function getSimplePrivateKeys() {
  const privKeys = [
    ...new Array(254)
      .fill(0)
      .map((_, v) =>
        Buffer.from(new Array(32).fill(0).map((_, i) => (i === 31 ? v + 1 : 0)))
      ),

    ...new Array(254).fill(0).map((_, v) => Buffer.alloc(32, v + 1)),
  ];
  return privKeys;
}

type WalletInfo = [
  pkScript: PkScript,
  address: string,
  info: string,
  secret: string
];

function getScriptWallets(
  pkScript: PkScript,
  comment: string = "",
  secret = `${pkScript.toString("hex")}`
) {
  const walletsInfo: WalletInfo[] = [];

  {
    const scriptHash = ripemd160(sha256(pkScript));
    const p2shAddress = bitcoin_address_P2SH_from_script_hash(scriptHash);
    const expectingPkScript = Buffer.concat([
      Buffer.from("a914", "hex"),
      scriptHash,
      Buffer.from("87", "hex"),
    ]) as PkScript;
    walletsInfo.push([
      expectingPkScript,
      p2shAddress,
      `P2SH${comment}`,
      secret,
    ]);
  }
  {
    const p2wshAddress = bitcoin_address_P2WSH_from_pk_script(pkScript)!;

    const expectingPkScript = get_P2WSH_pk_script_from_real_pk_script(pkScript);
    walletsInfo.push([
      expectingPkScript,
      p2wshAddress,
      `P2WSH${comment}`,
      secret,
    ]);
  }
  {
    const p2wsh_script = get_P2WSH_pk_script_from_real_pk_script(pkScript);
    const p2wsh_script_hash = ripemd160(sha256(p2wsh_script));
    const address = bitcoin_address_P2SH_from_script_hash(p2wsh_script_hash);
    const expectingPkScript = Buffer.concat([
      Buffer.from("a914", "hex"),
      p2wsh_script_hash,
      Buffer.from("87", "hex"),
    ]) as PkScript;
    walletsInfo.push([
      expectingPkScript,
      address,
      `P2SH+P2WSH${comment}`,
      secret,
    ]);
  }

  return walletsInfo;
}

function getPublickeyWallets(privKey: Buffer) {
  const walletsInfo: WalletInfo[] = [];

  const publicKey = getCompressedPublicKeyFromPrivateKey(privKey);
  const secret = privKey.toString("hex");

  if (publicKey.length !== 33) {
    throw new Error(`Wrong len for pubkey comp`);
  }
  {
    // Pubkey (P2PK) compressed
    const script = Buffer.concat([
      Buffer.from([33]),
      publicKey,
      Buffer.from("ac", "hex"),
    ]) as PkScript;

    walletsInfo.push([script, "", `P2PK compressed`, secret]);
  }

  {
    // Pubkey (P2PK) uncompressed
    const pubKeyUncom = getUnCompressedPublicKeyFromPrivateKey(privKey);
    if (pubKeyUncom.length !== 65) {
      throw new Error(`Wrong len for pubkey uncomp`);
    }
    const script = Buffer.concat([
      Buffer.from([65]),
      publicKey,
      Buffer.from("ac", "hex"),
    ]) as PkScript;

    walletsInfo.push([script, "", `P2PK compressed`, secret]);
  }
  {
    const keyHash = ripemd160(sha256(publicKey));
    walletsInfo.push([
      Buffer.concat([
        Buffer.from([0x76, 0xa9]),
        keyHash,
        Buffer.from([0x88, 0xac]),
      ]) as PkScript,
      bitcoin_address_P2PKH_from_pubkey_hash(publicKey),
      `P2PKH`,
      secret,
    ]);
  }
  {
    const keyHash = ripemd160(sha256(publicKey));
    walletsInfo.push([
      Buffer.concat([Buffer.from([0x00, keyHash.length]), keyHash]) as PkScript,
      bitcoin_address_P2WPKH_from_public_key(publicKey)!,
      `P2WPKH`,
      secret,
    ]);
  }
  {
    const witnessScript =
      // No need to prefix with 0x16 because hash is
      // from the last stack item in scriptSig, not scriptSig itself
      get_P2WPKH_pk_script_from_public_key(publicKey);
    const p2sh = bitcoin_address_P2SH_from_pk_script(witnessScript);
    walletsInfo.push([p2sh, `P2WPKH+P2SH`, secret]);
  }
  {
    const keyHash = ripemd160(sha256(publicKey));
    const script = Buffer.concat([
      Buffer.from("76a914", "hex"),
      keyHash,
      Buffer.from("88ac", "hex"),
    ]) as PkScript;
    walletsInfo.push(...getScriptWallets(script, " PKH", secret));
  }
  {
    // <public key> (OP_CHECKSIG | OP_CHECKSIGVERIFY | OP_CHECKSIG OP_VERIFY)
    for (const ending of ["ac", "ad", "ac69"]) {
      if (publicKey.length !== 33) {
        throw new Error(`Internal error`);
      }
      const script = Buffer.concat([
        Buffer.from("21", "hex"),
        publicKey,
        Buffer.from(ending, "hex"),
      ]) as PkScript;
      walletsInfo.push(...getScriptWallets(script, ` PK ${ending}`, secret));
    }
  }

  return walletsInfo;
}

async function getWalletBalance(wallet: string) {
  // TODO
}

/*
pkScripts.slice(0, 1).forEach((pkScript) => {
  addScriptWallets(Buffer.from(pkScript, "hex") as PkScript);
});

privKeys.slice(0, 1).forEach((privKey) => addPublickeyWallets(privKey));

console.info(walletsInfo);
*/
