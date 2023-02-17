import { compressPublicKey } from "../bitcoin/protocol/compressPublicKey";
import { sha256 } from "../bitcoin/utils/hashes";
import { joinBuffers } from "../bitcoin/utils/joinBuffer";
import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { signature } from "../my-elliptic-curves/ecdsa";
import { createSignaturesAnalyzer } from "./signaturesAnalyzer";
import { modulo_power_point } from "../my-elliptic-curves/curves";
import { bigintToBuf } from "./bigIntToBuf";

describe(`Signatures analyzer`, () => {
  const myPrivKeyBuf = Buffer.from("Aaabbbbccccddd332123", "hex");
  const myPrivKeyBigInt = BigInt("0x" + myPrivKeyBuf.toString("hex"));
  const publicKeyPoint = modulo_power_point(
    Secp256k1.G,
    myPrivKeyBigInt,
    Secp256k1.a,
    Secp256k1.p
  );
  const myPublicKeyCompressed = compressPublicKey(
    joinBuffers(
      Buffer.from([0x04]),
      bigintToBuf(publicKeyPoint![0]),
      bigintToBuf(publicKeyPoint![1])
    )
  );
  if (!myPublicKeyCompressed) {
    throw new Error(`Failed to compress public key`);
  }

  const k = BigInt("0x31231412412312333");

  const msg1 = Buffer.from("this is some message blablabla");
  const sig1 = signature({
    curve: Secp256k1,
    msgHash: BigInt("0x" + sha256(msg1).toString("hex")),
    k,
    privateKey: BigInt("0x" + myPrivKeyBuf.toString("hex")),
  });

  const msg2 = Buffer.from("this is some other message blablabla");
  const sig2 = signature({
    curve: Secp256k1,
    msgHash: BigInt("0x" + sha256(msg2).toString("hex")),
    k,
    privateKey: BigInt("0x" + myPrivKeyBuf.toString("hex")),
  });

  it(`Saves signatures and derives private key`, () => {
    const scanner = createSignaturesAnalyzer(true);

    expect(scanner.keysFound).toBe(0);
    expect(scanner.signaturesSaved).toBe(0);

    for (const iteration of [1, 2]) {
      scanner.ecdsaSignature({
        msg: msg1,
        pubKeyCompressed: myPublicKeyCompressed,
        r: bigintToBuf(sig1.r),
        s: bigintToBuf(sig1.s),
      });

      expect(scanner.keysFound).toBe(0);
      expect(scanner.signaturesSaved).toBe(1);
    }

    scanner.ecdsaSignature({
      msg: msg2,
      pubKeyCompressed: myPublicKeyCompressed,
      r: bigintToBuf(sig2.r),
      s: bigintToBuf(sig2.s),
    });

    expect(scanner.keysFound).toBe(1);
    expect(scanner.signaturesSaved).toBe(2);
  });
});
