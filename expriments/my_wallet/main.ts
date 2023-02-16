/*

# First, generate private key
openssl ecparam -genkey -out wallet.pem -name secp256k1 -noout

# Encrypt and save somewhere
openssl aes-256-cbc -e -pbkdf2 -in wallet.pem -out wallet.enc.pem
# Decrypt
openssl aes-256-cbc -d -pbkdf2 -in wallet.enc.pem -out wallet.decccc.pem

*/

import { createPrivateKey, createPublicKey } from "crypto";
import * as fs from "fs";
import { compressPublicKey } from "../../bitcoin/protocol/compressPublicKey";
import { asn1parse } from "../../bitcoin/script/asn1";
import { bitcoinAddressP2WPKHromPublicKey } from "../../bitcoin/utils/bech32/address";
import { ripemd160, sha256 } from "../../bitcoin/utils/hashes";

const myPrivKeyObject = createPrivateKey({
  key: fs.readFileSync(__dirname + "/wallet.pem"),
  format: "pem",
  type: "sec1",
});
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
const p2wpkh = bitcoinAddressP2WPKHromPublicKey(myPublicKey);
console.info(`Address = ${p2wpkh}`);
