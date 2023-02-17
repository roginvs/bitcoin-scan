/*

# First, generate private key
openssl ecparam -genkey -out wallet.pem -name secp256k1 -noout

# Encrypt and save somewhere
openssl aes-256-cbc -e -pbkdf2 -in wallet.pem -out wallet.enc.pem
# Decrypt
openssl aes-256-cbc -d -pbkdf2 -in wallet.enc.pem -out wallet.decccc.pem

*/

import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  Verify,
  verify,
} from "crypto";
import * as fs from "fs";
import { compressPublicKey } from "../../bitcoin/protocol/compressPublicKey";
import { packTx } from "../../bitcoin/protocol/messages.create";
import {
  BitcoinTransaction,
  readTx,
} from "../../bitcoin/protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionHash,
  TransactionPayload,
  WitnessStackItem,
} from "../../bitcoin/protocol/messages.types";
import { asn1parse, packAsn1PairOfIntegers } from "../../bitcoin/script/asn1";
import { extract_sig_r_and_s_from_der } from "../../bitcoin/script/extract_sig_r_and_s_from_der";
import { getOpChecksigSignatureValue } from "../../bitcoin/script/op_checksig_sigvalue";
import {
  getOpChecksigSignatureValueWitness,
  p2wpkhProgramForOpChecksig,
} from "../../bitcoin/script/op_checksig_sigvalue_witness";
import {
  bitcoinAddressP2WPKHromPublicKey,
  getP2WSHpkscriptFromRealPkScript,
} from "../../bitcoin/utils/bech32/address";
import { ripemd160, sha256 } from "../../bitcoin/utils/hashes";
import { Secp256k1 } from "../../my-elliptic-curves/curves.named";
import { signature } from "../../my-elliptic-curves/ecdsa";
import { bigintToBuf } from "../../scanner/bigIntToBuf";

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

// console.info(
//     readTx(
//       Buffer.from(
//         "0200000000010150a75d1afee925231f3935b18771e6881fda318ae600aa3fcc198f9a50758f7e0000000000f0ffffff08a546800b00000000160014015f524f21a6d8e0c8cdf9338467814294dd9fbbb3a50000000000001600149cfad00d405130ea4e8a4d5d381a5c8a4642fa2efc190000000000001600147746ba2bf1b68f20b4e8570a5b8290cfbab8f5170cfc0000000000001600145bb3acb75c375f2e84b4f3f43aac2dc888694003ab1a0600000000001600146baaf89139f2698ca57286d53045fc0952ea95569d131e000000000017a91479f3633e04838a5770277951ee15208d01063dd287b8860000000000001600140e257d3f18e6f5df6339206cd03ef1d64b4d76195ea9000000000000160014ed360bf8eb3f229db2e371a9324f6ba47daf660b02483045022100d11536ef97aeb160db58210804d18045e687ff38d44733ba035a057b68f6745902201fb9630c5a1e9a6dd65578517c71f8e4e7254b17434639e65c56f6203db89cbd012103e0ebb9dd2a9314f16c76a0c68ea4dd2355033f95a3294b01eaf1f6aa1aaaa3fd00000000",
//         "hex"
//       ) as TransactionPayload
//     )[0]
//   );
const spending = {
  txid: Buffer.from(
    "1d563a7d966435beb6af3b1fd9b3c69d9d1011ed6ed7be48bb722d6d2bf01f9b",
    "hex"
  ).reverse() as TransactionHash,
  outIndex: 1,
  value: BigInt(42419),

  /** For signing and for charge */
  pkscript: Buffer.from(
    "00149cfad00d405130ea4e8a4d5d381a5c8a4642fa2e",
    "hex"
  ) as PkScript,
};

const lolOutpoint = getP2WSHpkscriptFromRealPkScript(
  Buffer.from("AC", "hex") as PkScript
);

const fee = BigInt(2000);

const spendingTx: BitcoinTransaction = {
  version: 2,
  lockTime: 0,
  isWitness: true,
  txIn: [
    {
      outpointHash: spending.txid,
      outpointIndex: spending.outIndex,
      sequence: 0xfffffffe,
      script: Buffer.alloc(0) as SignatureScript,
      witness: [
        // This is signature+hashCodeType. Adding here to estimate size, we will replace it later
        Buffer.alloc(73, 0xff) as WitnessStackItem,
        myPublicKey as WitnessStackItem,
      ],
    },
  ],

  txOut: [
    {
      script: lolOutpoint,
      value: BigInt(4000),
    },
    {
      script: spending.pkscript,
      value: spending.value - BigInt(4000) - fee,
    },
  ],

  txid: Buffer.alloc(0) as TransactionHash,
  wtxid: Buffer.alloc(0) as TransactionHash,
  payload: Buffer.alloc(0) as TransactionPayload,
};

const dataToSig = getOpChecksigSignatureValueWitness(
  spendingTx,
  0,
  p2wpkhProgramForOpChecksig(
    Buffer.from("9cfad00d405130ea4e8a4d5d381a5c8a4642fa2e", "hex")
  ),
  spending.value,
  0x01
);

const signatureDerMyImplementation = (() => {
  let k = BigInt("0x" + randomBytes(32).toString("hex"));
  if (k >= Secp256k1.n || k <= BigInt(1)) {
    throw new Error(`Not this time LOL`);
  }

  const privateKey = BigInt(
    "0x" +
      myPrivKeyObject
        .export({
          format: "der",
          type: "sec1",
        })
        .subarray(7, 7 + 32)
        .toString("hex")
  );

  const sig = signature({
    curve: Secp256k1,
    k,
    msgHash: BigInt("0x" + sha256(dataToSig).toString("hex")),
    privateKey,
  });

  const s = sig.s > Secp256k1.n / BigInt(2) ? Secp256k1.n - sig.s : sig.s;

  const sigDer = packAsn1PairOfIntegers(bigintToBuf(sig.r), bigintToBuf(s));
  if (!verify(undefined, dataToSig, myPublicKeyObject, sigDer)) {
    throw new Error("Something wrong with signatures");
  }
  return sigDer;
})();

const signatureDer = (() => {
  const sigDer = sign(undefined, dataToSig, myPrivKeyObject);
  const [r, s] = extract_sig_r_and_s_from_der(sigDer);
  const sInt = BigInt("0x" + s.toString("hex"));
  if (sInt < Secp256k1.n / BigInt(2)) {
    return sigDer;
  }

  const sNew = Secp256k1.n - sInt;

  const sigDerNew = packAsn1PairOfIntegers(r, bigintToBuf(sNew));
  if (!verify(undefined, dataToSig, myPublicKeyObject, sigDerNew)) {
    throw new Error("Something wrong with signatures");
  }
  return sigDerNew;
})();

const signatureWithHashType = Buffer.concat([
  signatureDer,
  Buffer.from([0x01]),
]);

spendingTx.txIn[0].witness![0] = signatureWithHashType as WitnessStackItem;

// console.info(`Spending tx`, spendingTx);
console.info("Spending tx raw:");
const spendingTxRaw = packTx(spendingTx);
console.info(spendingTxRaw.toString("hex"));
console.info(
  `Spending tx hash = ${Buffer.from(readTx(spendingTxRaw)[0].txid)
    .reverse()
    .toString("hex")}`
);
