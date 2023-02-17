import { createPrivateKey, createPublicKey } from "crypto";
import { compressPublicKey } from "../protocol/compressPublicKey";
import { readTx } from "../protocol/messages.parse";
import { PkScript, TransactionPayload } from "../protocol/messages.types";
import {
  getOpChecksigSignatureValueWitness,
  p2wpkhProgramForOpChecksig,
} from "./op_checksig_sigvalue_witness";

function getCompressedPublicKeyFromPrivateKey(privateKey: Buffer) {
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
  return compressPublicKey(myPublicKeyUncompressed);
}

describe("getOpChecksigSignatureValueWitness", () => {
  const txRaw = Buffer.from(
    "0100000002fff7f7881a8099afa6940d42d1e7f6362bec38171ea3edf433541db4e4ad969f0000000000eeffffffef51e1b804cc89d182d279655c3aa89e815b1b309fe287d9b2b55d57b90ec68a0100000000ffffffff02202cb206000000001976a9148280b37df378db99f66f85c95a783a76ac7a6d5988ac9093510d000000001976a9143bde42dbee7e4dbe6a21b2d50ce2f0167faa815988ac11000000",
    "hex"
  ) as TransactionPayload;
  const [tx, rest1] = readTx(txRaw);
  expect(rest1.length).toBe(0);

  const input0 = {
    // P2PK
    script: Buffer.from(
      // 03c9f4836b9a4f77fc0d81f7bcb01b7f1b35916864b9476c241ce9fc198bd25432 OP_CHECKSIG
      "2103c9f4836b9a4f77fc0d81f7bcb01b7f1b35916864b9476c241ce9fc198bd25432ac",
      "hex"
    ) as PkScript,
    // This private key is for public key above
    privateKey: Buffer.from(
      "bbc27228ddcb9209d7fd6f36b02f7dfa6252af40bb2f1cbc7a557da8027ff866",
      "hex"
    ),
  };

  const input1 = {
    // P2WPKH
    script: Buffer.from(
      "00141d0f172a0ecb48aee1be1f2687d2963ae33f71a1",
      "hex"
    ) as PkScript,
    privateKey: Buffer.from(
      "619c335025c7f4012e556c2a58b2506e30b8511b53ade95ea316fd8c3286feb9",
      "hex"
    ),
    // This is public key for the private key above
    // Hash of this key (1d0f172a0ecb48aee1be1f2687d2963ae33f71a1) is in pkScript above
    publicKey: Buffer.from(
      "025476c2e83188368da1ff3e292e7acafcdb3566bb0ad253f62fc70f07aeee6357",
      "hex"
    ),
  };

  it("getOpChecksigSignatureValueWitness", () => {
    expect(
      getOpChecksigSignatureValueWitness(
        tx,
        // Input 1 is witness
        1,
        p2wpkhProgramForOpChecksig(
          Buffer.from("1d0f172a0ecb48aee1be1f2687d2963ae33f71a1", "hex")
        ),
        // Amount
        BigInt(6 * 100000000),
        // SIGHASH_ALL
        0x01
      ).toString("hex")
    ).toBe("c37af31116d1b27caf68aae9e3ac82f1477929014d5b917657d0eb49478cb670");
  });
  /*

  }
  */
  // bbc27228ddcb9209d7fd6f36b02f7dfa6252af40bb2f1cbc7a557da8027ff866
  //console.info(tx);
});
