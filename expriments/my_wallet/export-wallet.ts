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

console.info(`Wallet import: p2wpkh:${exportPrivateKey(privKey, true)}`);
