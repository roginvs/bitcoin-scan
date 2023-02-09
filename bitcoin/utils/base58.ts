import { sha256 } from "./hashes";
import { joinBuffers } from "./joinBuffer";

export function base58encode(data: Buffer) {
  const codeString =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  let output = "";
  let x = BigInt(`0x` + data.toString("hex"));
  while (x > BigInt(0)) {
    const remainder = x % BigInt(58);
    x = x / BigInt(58);
    output += codeString.charAt(Number(remainder));
  }
  let i = 0;
  while (i < data.length && data[i] === 0x00) {
    output += "1";
    i++;
  }
  return output.split("").reverse().join("");
}

export function bitcoinAddressFromP2PKH(pubKeyHash: Buffer) {
  const withNetworkId = joinBuffers(Buffer.from("00", "hex"), pubKeyHash);
  const hash = sha256(sha256(withNetworkId));

  const base256 = joinBuffers(withNetworkId, hash.subarray(0, 4));
  return base58encode(base256);
}
