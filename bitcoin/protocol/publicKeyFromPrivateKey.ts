import { createPrivateKey, createPublicKey } from "crypto";
import { compressPublicKey } from "./compressPublicKey";

export function getCompressedPublicKeyFromPrivateKey(privateKey: Buffer) {
  const privKeySec1 = Buffer.from(
    "300E0201010400" + privateKey.toString("hex") + "a00706052b8104000a",
    "hex"
  );

  const diff = privateKey.length;
  privKeySec1[1] += diff;
  privKeySec1[6] += diff;

  const myPrivKey = createPrivateKey({
    key: privKeySec1,
    format: "der",
    type: "sec1",
  });
  const myPublicKey = createPublicKey(myPrivKey);
  const myPublicKeySpki = myPublicKey.export({ format: "der", type: "spki" });
  const myPublicKeyUncompressed = myPublicKeySpki.subarray(
    20 + 2 + 1,
    20 + 2 + 1 + 66
  );
  const result = compressPublicKey(myPublicKeyUncompressed);
  if (!result) {
    console.error(`privateKey=${privateKey.toString("hex")}`);
    console.error(`myPublicKeySpki=${myPublicKeySpki.toString("base64")}`);
    console.error(
      `myPublicKeyUncompressed=${myPublicKeyUncompressed.toString("hex")}`
    );
    throw new Error(`Internal error`);
  }
  return result;
}
