import { is_on_curve, modulo_power_point } from "./curves";

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

console.info(`

// Do this in browser to generate keypair:

const k = await crypto.subtle.generateKey(
    {name: "ECDH", namedCurve:"P-256"}, true, ["deriveKey", "deriveBits"]);

const publicExported = await crypto.subtle.exportKey("jwk", k.publicKey);

console.info(JSON.stringify(publicExported, null, 4))

// And then replace it in the code below (this is only one user input)
`);

const otherPublicKey = {
  crv: "P-256",
  ext: true,
  key_ops: [],
  kty: "EC",
  x: "WSI3kTcwlgSrJ0zRT5Rc9tWz_4p_KciqW0FDwJI2suc",
  y: "AvF_vM5qyFRU8Zs4NNvLxOU5SeapxwOT5p2HWbgZHzE",
};

const px = BigInt("0x" + Buffer.from(otherPublicKey.x, "base64").toString("hex"));
const py = BigInt("0x" + Buffer.from(otherPublicKey.y, "base64").toString("hex"));

const otherPublicPoint = [px, py] as const;
console.info("Got public key, checking it");
console.info(`is_on_curve = `, is_on_curve(otherPublicPoint, curve.a, curve.b, curve.p));

/*

Generated my d using this (in node, to do in browser remove "webcrypto" part):

const array = new Uint8Array(32); // 256 bits = 32 bytes
crypto.webcrypto.getRandomValues(array);
console.info();

*/

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
  key_ops: ["deriveKey", "deriveBits"],
  kty: "EC",
  x: bigintToBase64(myPublicKeyPoint[0]),
  y: bigintToBase64(myPublicKeyPoint[1]),
};

console.info("// Here is my public key, import it in the browser:");
console.info(`

const otherPub = await crypto.subtle.importKey(
    "jwk",
    ${JSON.stringify(myPublicKey)},
    {name: "ECDH", namedCurve: "P-256"},
    true,
    []
  );
  
  `);

console.info("// And derive key in browser:");
console.info(`

const sharedBuf = await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        namedCurve: "P-256",
        public: otherPub
      },
      k.privateKey,
      256
    );

console.info("Here is shared secret: ");
console.info([...new Uint8Array(sharedBuf)].map(x => x.toString(16).padStart(2, '0')).join(''));

`);

const sharedPoint = modulo_power_point(otherPublicPoint, myPrivateKey, curve.a, curve.p);
if (!sharedPoint) {
  throw new Error("LOL shared secret is Inf");
}
console.info("// Our shared secret is, check that browser have the same:");
console.info("// ", sharedPoint[0].toString(16));
