import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  Verify,
  verify,
} from "crypto";
import * as fs from "fs";
import { exportPrivateKey } from "../../bitcoin/utils/wif";
import { asn1parse } from "../../bitcoin/script/asn1";
import { compressPublicKey } from "../../bitcoin/protocol/compressPublicKey";
import { ripemd160, sha256 } from "../../bitcoin/utils/hashes";
import { bitcoin_address_P2WPKH_from_public_key } from "../../bitcoin/utils/bech32/address";

const myPrivKeyObject = createPrivateKey({
  key: fs.readFileSync(__dirname + "/wallet.pem"),
  format: "pem",
  type: "sec1",
});

const privKey = myPrivKeyObject
  .export({
    format: "der",
    type: "sec1",
  })
  .subarray(7, 7 + 32);

console.info(`Private key = ${privKey.toString("hex")}`);
console.info(`Wallet import: p2wpkh:${exportPrivateKey(privKey, true)}`);

const myPublicKeyObject = createPublicKey(myPrivKeyObject);

const myPublicKey = (() => {
  const myPublicKeySpki = myPublicKeyObject.export({
    format: "der",
    type: "spki",
  });
  const asnParsed = asn1parse(myPublicKeySpki);
  // .subarray(20 + 2 + 1, 20 + 2 + 1 + 66);
  const myPublicKeyUncompressed = asnParsed[0][1].value;
  if (
    myPublicKeyUncompressed[0] !== 0x04 ||
    myPublicKeyUncompressed.length !== 65
  ) {
    throw new Error(
      `Something wrong or crypto module decided to compress public key`
    );
  }
  return compressPublicKey(myPublicKeyUncompressed)!;
})();

console.info("Public key = ", myPublicKey.toString("hex"));
console.info(
  `Public key hash = ${ripemd160(sha256(myPublicKey)).toString("hex")}`
);
const p2wpkh = bitcoin_address_P2WPKH_from_public_key(myPublicKey);
console.info(`Address = ${p2wpkh}`);
