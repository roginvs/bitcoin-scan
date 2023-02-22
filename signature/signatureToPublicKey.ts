import { Secp256k1 } from "../my-elliptic-curves/curves.named";
import { recover_public_key_recid } from "../my-elliptic-curves/ecdsa";
import { sha256 } from "../my-hashes/sha256";
import { parsePgpLike } from "./parse-pgp-like";
import { parseSignatureHeader } from "./parseSignatureHeader";
import { stringToUTF8Array } from "./stringToUTF8Array";

/** Same as in but using browser api */
export function packVarInt(value: number) {
  if (value < 0xfd) {
    return String.fromCharCode(value);
  } else if (value < 0xffff) {
    const b = new Uint8Array(3);
    b[0] = 0xfd;
    new DataView(b.buffer).setUint16(1, value, true);
    return String.fromCharCode(...b);
  } else if (value < 0xffffffff) {
    const b = new Uint8Array(5);
    b[0] = 0xfe;
    new DataView(b.buffer).setUint32(1, value, true);
    return String.fromCharCode(...b);
  } else {
    const b = new Uint8Array(9);
    b[0] = 0xff;
    new DataView(b.buffer).setBigUint64(1, BigInt(value), true);
    return String.fromCharCode(...b);
  }
}

export function getBitcoinMessageHash(msg: string) {
  const MESSAGE_MAGIC = "Bitcoin Signed Message:\n";
  const messageText =
    packVarInt(MESSAGE_MAGIC.length) +
    MESSAGE_MAGIC +
    packVarInt(msg.length) +
    msg;
  const dataBuf = Uint8Array.from(stringToUTF8Array(messageText)).buffer;

  const msgHashBuf = sha256(sha256(dataBuf));
  return msgHashBuf;
}

export function signatureToPublicKey(signatureText: string) {
  const data = parsePgpLike(signatureText);
  if (!data) {
    return null;
  }

  const msgHashBuf = getBitcoinMessageHash(data.message);

  const latinSignature = atob(data.signatureBase64);
  const headerAndSignature = Uint8Array.from(
    new Array(latinSignature.length)
      .fill(0)
      .map((_, i) => latinSignature.charCodeAt(i))
  );
  if (headerAndSignature.length !== 65) {
    return null;
  }
  const header = headerAndSignature[0];
  const signature = headerAndSignature.slice(1);

  const headerInfo = parseSignatureHeader(header);
  if (!headerInfo) {
    return null;
  }

  const rUint = signature.slice(0, 32);
  const sUint = signature.slice(32, 64);

  const rInt = BigInt(
    "0x" + [...rUint].map((i) => ("0" + i.toString(16)).slice(-2)).join("")
  );
  const sInt = BigInt(
    "0x" + [...sUint].map((i) => ("0" + i.toString(16)).slice(-2)).join("")
  );

  const msgHashInt = BigInt(
    "0x" +
      [...new Uint8Array(msgHashBuf)]
        .map((i) => ("0" + i.toString(16)).slice(-2))
        .join("")
  );

  const pubPoint = recover_public_key_recid(
    Secp256k1,
    rInt,
    sInt,
    msgHashInt,
    headerInfo.recId
  );

  if (!pubPoint) {
    return null;
  }
  const pubXHex = ("00".repeat(32) + pubPoint[0].toString(16)).slice(32 * 2);
  const pubYHex = ("00".repeat(32) + pubPoint[1].toString(16)).slice(32 * 2);

  return {
    pubXHex,
    pubYHex,
  };
}
