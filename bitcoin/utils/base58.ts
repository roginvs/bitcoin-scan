import { sha256 } from "./hashes";
import { joinBuffers } from "./joinBuffer";
const codeString = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58encode(data: Buffer) {
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

export function base58decode(data: string) {
  let out = BigInt(0);
  for (const [pos, digit] of data.split("").reverse().entries()) {
    const digitNum = codeString.indexOf(digit);
    if (digitNum < 0) {
      throw new Error(`Wrong base58 char ${digit}`);
    }
    out = out + BigInt(digitNum) * BigInt(58) ** BigInt(pos);
  }
  let outStr = out.toString(16);
  if (outStr.length % 2 != 0) {
    outStr = "0" + outStr;
  }

  let i = 0;
  while (i < data.length && data.charAt(i) === "1") {
    outStr = "00" + outStr;
    i++;
  }
  return Buffer.from(outStr, "hex");
}
