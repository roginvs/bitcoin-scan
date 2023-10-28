import { generateKeyPairSync, sign } from "crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "secp256k1",
});

// Works for bitcoin as it is
const signature = sign(undefined, Buffer.from("hello"), privateKey);

// Contains ASN1 structure
const publicKeyExported = publicKey.export({
  format: "pem",
  type: "spki",
});
