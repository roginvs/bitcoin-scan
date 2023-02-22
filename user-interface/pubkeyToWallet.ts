import { SignatureWalletType } from "../signature/parseSignatureHeader";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "../my-hashes/sha256";

function hexStrToBuf(str: string) {
  if (str.length % 2 !== 0) {
    throw new Error(`Not even bytes`);
  }
  const out = new Uint8Array(str.length / 2);
  for (let i = 0; i < str.length / 2; i++) {
    const digit = parseInt(str.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(digit)) {
      throw new Error(`Unable to parse ''at pos ${i * 2}`);
    }
    out[i] = digit;
  }
  return out.buffer;
}

const codeString = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58encode(data: ArrayBuffer) {
  let output = "";
  let x = BigInt(
    "0x" +
      [...new Uint8Array(data)]
        .map((i) => ("0" + i.toString(16)).slice(-2))
        .join("")
  );
  while (x > BigInt(0)) {
    const remainder = x % BigInt(58);
    x = x / BigInt(58);
    output += codeString.charAt(Number(remainder));
  }
  let i = 0;

  const byteView = new Uint8Array(data);
  while (i < byteView.length && byteView[i] === 0x00) {
    output += "1";
    i++;
  }
  return output.split("").reverse().join("");
}

export function pubkeyToWallet(
  pubkeyHex: {
    x: string;
    y: string;
  },
  walletType: SignatureWalletType
) {
  const compressedPubKeyHex =
    (parseInt(pubkeyHex.y.slice(-1), 16) % 2 === 0 ? "02" : "03") + pubkeyHex.x;

  if (
    walletType === "P2PKH compressed" ||
    walletType === "P2PKH uncompressed"
  ) {
    const pubkey =
      walletType === "P2PKH compressed"
        ? compressedPubKeyHex
        : "04" + pubkeyHex.x + pubkeyHex.y;
    const pubkeyBuf = hexStrToBuf(pubkey);
    const pubkeyHash = ripemd160(new Uint8Array(sha256(pubkeyBuf)));

    const withNetworkId = new Uint8Array(pubkeyHash.length + 1);
    withNetworkId[0] = 0;
    withNetworkId.set(pubkeyHash, 1);

    const addressHash = sha256(sha256(withNetworkId));
    const base256 = new Uint8Array(withNetworkId.length + 4);
    base256.set(withNetworkId, 0);
    base256.set(new Uint8Array(addressHash.slice(0, 4)), withNetworkId.length);

    return base58encode(base256);
  }
}
