import { sha256 } from "./hashes";
import { Nominal } from "./nominaltypes";

export function joinBuffers(...buffers: Buffer[]) {
  const len = buffers.reduce((acc, cur) => (acc = acc + cur.length), 0);
  const out = Buffer.alloc(len);
  let i = 0;
  for (const b of buffers) {
    b.copy(out, i);
    i += b.length;
  }
  return out;
}

export type BitcoinMessage = Nominal<"bitcoin message", Buffer>;
export type MessagePayload = Nominal<"message payload", Buffer>;

const magicBuf = Buffer.from("F9BEB4D9", "hex");
export function buildMessage(command: string, payload: MessagePayload) {
  const commandBuf = Buffer.alloc(12).fill(0);
  commandBuf.write(command);

  const out = Buffer.alloc(
    magicBuf.length + commandBuf.length + 4 + 4 + payload.length
  );
  magicBuf.copy(out, 0);
  commandBuf.copy(out, magicBuf.length);
  out.writeInt32LE(payload.length, magicBuf.length + commandBuf.length);

  const checksum = sha256(sha256(payload)).subarray(0, 4);
  checksum.copy(out, magicBuf.length + commandBuf.length + 4);

  payload.copy(out, magicBuf.length + commandBuf.length + 4 + 4);

  return out as BitcoinMessage;
}

const protocolVersion = Buffer.from("62EA0000", "hex");

function packVarInt(value: number) {
  if (value < 0xfd) {
    const b = Buffer.alloc(1);
    b[0] = value;
    return b;
  } else if (value < 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(value, 1);
    return b;
  } else if (value < 0xffffffff) {
    const b = Buffer.alloc(5);
    b[0] = 0xfe;
    b.writeUInt32LE(value, 1);
    return b;
  } else {
    const b = Buffer.alloc(9);
    b[0] = 0xff;
    b.writeBigInt64LE(BigInt(value), 1);
    return b;
  }
}

export function packVarStr(str: string) {
  const strLen = packVarInt(str.length);
  const out = Buffer.alloc(strLen.length + str.length);
  strLen.copy(out, 0);
  out.write(str, strLen.length, "latin1");
  return out;
}

function packUint32(val: number) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(val);
  return buf;
}

export function createVersionMessage(lastKnownBlock: number) {
  const services = Buffer.from("0100000000000000", "hex");
  const date = Buffer.alloc(8).fill(0);
  date.writeInt32LE(new Date().getTime() / 1000);
  const addr = Buffer.from(
    "010000000000000000000000000000000000FFFF000000000000",
    "hex"
  );
  const nodeId = Buffer.from("3B2EB35D8CE61711", "hex");
  const subVersion = packVarStr("/Satoshi:0.7.2/"); // /Satoshi:0.16.2(bitcore)/
  const lastKnownBlockBuf = packUint32(lastKnownBlock);
  const payload = joinBuffers(
    protocolVersion,
    services,
    date,
    addr,
    addr,
    nodeId,
    subVersion,
    lastKnownBlockBuf
  ) as MessagePayload;
  return buildMessage("version", payload);
}
export function createVerackMessage() {
  return buildMessage("verack", Buffer.from("") as MessagePayload);
}
