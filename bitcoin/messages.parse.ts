import { bitcoinMessageMagic, protocolVersion } from "./consts";
import { sha256 } from "./hashes";
import { BitcoinMessage, BlockHash, MessagePayload } from "./messages.types";

export function parseMessage(buf: Buffer) {
  if (buf.length < 4 + 12 + 4 + 4) {
    return null;
  }
  const magic = buf.subarray(0, 4);
  if (!magic.equals(bitcoinMessageMagic)) {
    console.warn(`Got some other magic`, magic);
  }
  const commandBuf = buf.subarray(4, 4 + 12);
  const nullIndexInCommand = commandBuf.indexOf(0);
  const command = commandBuf.toString(
    undefined,
    undefined,
    nullIndexInCommand != -1 ? nullIndexInCommand : undefined
  );
  const len = buf.readUInt32LE(4 + 12);
  if (buf.length < 4 + 12 + 4 + 4 + len) {
    return null;
  }

  const checksum = buf.subarray(4 + 12 + 4, 4 + 12 + 4 + 4);
  const payload = buf.subarray(
    4 + 12 + 4 + 4,
    4 + 12 + 4 + 4 + len
  ) as MessagePayload;

  const checksumCalculated = sha256(sha256(payload)).subarray(0, 4);
  if (checksumCalculated.compare(checksum) !== 0) {
    throw new Error("LOL checksum failed");
  }
  const rest = buf.subarray(4 + 12 + 4 + 4 + len);
  return [command, payload, rest] as const;
}

export function readVarInt(buf: Buffer) {
  let count = buf[0];
  let startAt = 1;

  if (count === 0xfd) {
    startAt = 3;
    count = buf.readUInt16LE(1);
  } else if (count === 0xfe) {
    startAt = 5;
    count = buf.readUInt32LE(1);
  } else if (count === 0xff) {
    startAt = 9;
    const countBig = buf.readBigInt64LE(1);
    if (countBig > Number.MAX_SAFE_INTEGER) {
      throw new Error("Too big");
    } else {
      count = parseInt(countBig.toString());
    }
  }

  return [count, buf.slice(startAt)] as const;
}

/** Accepts buf with 8 bytes of services */
function parseVersionServices(payload: Buffer) {
  const n = payload.readUInt32LE(0);
  const data = [
    [1, "NODE_NETWORK"],
    [2, "NODE_GETUTXO"],
    [4, "NODE_BLOOM"],
    [8, "NODE_WITNESS"],
    [16, "NODE_XTHIN"],
    [64, "NODE_COMPACT_FILTERS"],
    [1024, "NODE_NETWORK_LIMITED"],
  ] as const;
  return data.filter(([nn, s]) => nn & n).map(([n, s]) => s);
}

export function parseVersion(payload: MessagePayload) {
  const ver = payload.subarray(0, 4);
  const services = payload.subarray(4, 4 + 8);
  // Timestamp is 64bit but for now I do not care
  const timestamp = payload.readUInt32LE(4 + 8);
  // Skip addresses for now
  // Skip nonce for now too
  const [userAgentLen, fromUserAgent] = readVarInt(
    payload.subarray(4 + 8 + 8 + 26 + 26 + 8)
  );
  const userAgent = fromUserAgent.subarray(0, userAgentLen);
  const startHeight = fromUserAgent.readUInt32LE(userAgentLen);

  const rest = fromUserAgent.subarray(userAgentLen + 4);
  console.info(
    `Got hello ver=${ver.readUInt32LE(0)} time=${new Date(
      timestamp * 1000
    ).toISOString()} userAgent=${userAgent} services=${parseVersionServices(
      services
    ).join(",")} startHeight=${startHeight} rest=${rest.toString("hex")}`
  );
}

export function readBlockHeader(buf: Buffer) {
  const version = buf.subarray(0, 4);
  const prevBlock = buf.subarray(4, 4 + 32);
  const merkleRoot = buf.subarray(4 + 32, 4 + 32 + 32);
  const timestamp = new Date(
    buf.subarray(4 + 32 + 32, 4 + 32 + 32 + 4).readUInt32LE() * 1000
  );
  const bits = buf
    .subarray(4 + 32 + 32 + 4, 4 + 32 + 32 + 4 + 4)
    .readUInt32LE();
  const nonce = buf.subarray(4 + 32 + 32 + 4 + 4, 4 + 32 + 32 + 4 + 4 + 4);
  const [txCount, rest] = readVarInt(buf.subarray(4 + 32 + 32 + 4 + 4 + 4));
  const hashingData = buf.subarray(0, 4 + 32 + 32 + 4 + 4 + 4);
  return [
    {
      version,
      prevBlock,
      merkleRoot,
      timestamp,
      bits,
      nonce,
      txCount,
    },
    rest,
    hashingData,
  ] as const;
}
export type BlockHeader = ReturnType<typeof readBlockHeader>[0];
