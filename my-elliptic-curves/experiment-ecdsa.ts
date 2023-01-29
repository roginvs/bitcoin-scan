import { modulo_power_point } from "./curves";
import { signature } from "./ecdsa";

const curve = {
  // P-256
  p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
  a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
  b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
  G: [
    BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
    BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
  ],
  n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
} as const;

const myPrivateKeyArray = new Uint8Array(32); // 256 bits = 32 bytes
require("node:crypto").webcrypto.getRandomValues(myPrivateKeyArray);
const myPrivateKeyHex = Buffer.from(myPrivateKeyArray).toString("hex");

const myPrivateKey = BigInt("0x" + myPrivateKeyHex);
if (myPrivateKey >= curve.p) {
  throw new Error("LOL my private key is too big");
}
console.info("// Generated my private key");

const myPublicKeyPoint = modulo_power_point(curve.G, myPrivateKey, curve.a, curve.p);
if (!myPublicKeyPoint) {
  throw new Error("LOL my public key is Infinity");
}

function bigintToBase64(n: bigint) {
  let str = n.toString(16);
  if (str.length % 2 === 1) {
    console.info("// Note: adding leading zero");
    str = "0" + str;
  }
  const buf = Buffer.from(str, "hex");
  return buf.toString("base64url");
}

const myPublicKey = {
  crv: "P-256",
  ext: true,
  key_ops: ["verify"],
  kty: "EC",
  x: bigintToBase64(myPublicKeyPoint[0]),
  y: bigintToBase64(myPublicKeyPoint[1]),
};

console.info("// Here is my public key, import it in the browser:");
console.info(`
  
const pubkey = await crypto.subtle.importKey(
      "jwk",
      ${JSON.stringify(myPublicKey)},
      {name: "ECDSA", namedCurve: "P-256"},
      true,
      ["verify"]
    );
    
    `);

const msg = Buffer.from("sample");
console.info(`// Message is '${msg}'`);

/*
const msgHash = BigInt(
  "0x" +
    Buffer.from(await require("crypto").webcrypto.subtle.digest("SHA-256", msg)).toString("hex"),
);
*/
const msgHash = BigInt("0x" + require("crypto").createHash("sha256").update(msg).digest("hex"));

console.info(`// Hash is ${msgHash.toString(16)}`);

const k = BigInt("0x" + Buffer.from(require("node:crypto").randomBytes(32)).toString("hex"));
console.info(`// k generated randomly`);

const { r, s } = signature({
  curve,
  privateKey: myPrivateKey,
  msgHash,
  k,
});

console.info(`// Signature generated, it is "r" and "s" values`);
console.info(`// TODO: We might need padding because in theory result can have leading bits`);
console.info(`
// Try to verify message:

await crypto.subtle.verify(
  {name: "ECDSA", hash: "SHA-256"},
  pubkey,
  new Uint8Array([${[...Buffer.from(bigintToBase64(r), "base64")].join(", ")},${[
  ...Buffer.from(bigintToBase64(s), "base64"),
].join(", ")}]),
   new Uint8Array([${[...msg].join(", ")}])
);

`);
