import * as fs from "fs";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { check_signature } from "../my-elliptic-curves/ecdsa";
import { uncompressPublicKey } from "../my-elliptic-curves/uncompressPublicKey";

const stream = fs.createReadStream(process.env.SIGPATH!, {
  highWaterMark: 128 * 10 * 1000,
});
let sigNum = 0;
stream.on("data", (chunk) => {
  if (typeof chunk === "string") {
    throw new Error(`Expecting buffer`);
  }
  if (chunk.length % 128 !== 0) {
    throw new Error(`I would like to receive 128 bytes in chunk`);
  }
  for (let i = 0; i < chunk.length; i += 128) {
    const pubkeyX = chunk.subarray(i, i + 32);
    const msgHash = chunk.subarray(i + 32, i + 64);
    const sigR = chunk.subarray(i + 64, i + 64 + 32);
    const sigS = chunk.subarray(i + 64 + 32, i + 64 + 32 + 32);

    const pubKeys = [
      Buffer.concat([Buffer.from([0x02]), pubkeyX]),
      Buffer.concat([Buffer.from([0x03]), pubkeyX]),
    ];

    let signatureValid = false;
    for (const pubKey of pubKeys) {
      const publicKeyPoint = uncompressPublicKey(Secp256k1, pubKey);
      if (
        check_signature({
          curve: Secp256k1,
          publicKey: publicKeyPoint,
          msgHash: BigInt("0x" + msgHash.toString("hex")),
          r: BigInt("0x" + sigR.toString("hex")),
          s: BigInt("0x" + sigS.toString("hex")),
        })
      ) {
        signatureValid = true;
        break;
      }
    }
    if (!signatureValid) {
      throw new Error(`Signature is not valid`);
      // console.info(`${sigNum} is NOT ok`);
    } else {
      console.info(`${sigNum} is ok`);
    }
    sigNum++;
  }
});
