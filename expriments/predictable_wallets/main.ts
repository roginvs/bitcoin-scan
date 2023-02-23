import { PkScript } from "../../bitcoin/protocol/messages.types";
import Database from "better-sqlite3";

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
  // OP_CHECKSIG
  const pkScripts = [Buffer.from([0xac]) as PkScript];

  pkScripts.push(
    ...new Array(16)
      .fill(0)
      .map((_, i) => i + 0x51)
      .map(
        (i) =>
          Buffer.from([
            // OP_CHECKSIG
            0xac,
            // OP_number
            i,
          ]) as PkScript
      )
  );

  pkScripts.push(
    ...pkScripts.map(
      (s) =>
        Buffer.concat([
          Buffer.from(
            // OP_NOP
            [61]
          ),
          s,
        ]) as PkScript
    ),
    ...pkScripts.map(
      (s) =>
        Buffer.concat([
          Buffer.from(
            // OP_FALSE OP_DROP
            [0, 75]
          ),
          s,
        ]) as PkScript
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
    const scriptHash = ripemd160(sha256(witnessScript));
    const p2sh_address = bitcoin_address_P2SH_from_script_hash(scriptHash);
    const expectingPkScript = Buffer.concat([
      Buffer.from("a914", "hex"),
      scriptHash,
      Buffer.from("87", "hex"),
    ]) as PkScript;
    walletsInfo.push([expectingPkScript, p2sh_address, `P2WPKH+P2SH`, secret]);
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

function checkUnspendTxouts() {
  const sql = new Database("/disk/bitcoin/newfinancial.db");
  const selectSql = sql.prepare(
    "select * from unspent_transaction_outputs where pub_script = ?"
  );
  async function checkPkScript(info: WalletInfo) {
    const unspent = selectSql.get(info[0]);
    if (!unspent) {
      return;
    }
    console.info(`WOW!`);
    console.info(unspent);
    console.info(info);
  }

  console.info(`Checking simple pk scripts`);
  getSimplePkScripts().forEach((pkScript) => {
    getScriptWallets(pkScript).forEach((info) => checkPkScript(info));
  });

  console.info(`Checking simple private keys`);
  getSimplePrivateKeys().forEach((priv) => {
    getPublickeyWallets(priv).forEach((info) => checkPkScript(info));
  });
}

checkUnspendTxouts();
