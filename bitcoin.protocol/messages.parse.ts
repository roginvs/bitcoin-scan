import { bitcoinMessageMagic, protocolVersion } from "./consts";
import { sha256 } from "./hashes";
import {
  BitcoinMessage,
  BlockHash,
  BlockPayload,
  MerkleRootHash,
  MessagePayload,
  PkScript,
  SignatureScript,
  TransactionPayload,
  TransactionHash,
} from "./messages.types";
import { joinBuffers } from "./utils";

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

export function readBlock(buf: BlockPayload) {
  const version = buf.subarray(0, 4);
  const prevBlock = buf.subarray(4, 4 + 32);
  const merkleRoot = buf.subarray(4 + 32, 4 + 32 + 32) as MerkleRootHash;
  const timestamp = new Date(
    buf.subarray(4 + 32 + 32, 4 + 32 + 32 + 4).readUInt32LE() * 1000
  );
  const bits = buf
    .subarray(4 + 32 + 32 + 4, 4 + 32 + 32 + 4 + 4)
    .readUInt32LE();
  const nonce = buf.subarray(4 + 32 + 32 + 4 + 4, 4 + 32 + 32 + 4 + 4 + 4);
  const [txCount, transactionsBuf] = readVarInt(
    buf.subarray(4 + 32 + 32 + 4 + 4 + 4)
  );
  const hashingData = buf.subarray(0, 4 + 32 + 32 + 4 + 4 + 4);
  const hash = sha256(sha256(hashingData)) as BlockHash;

  // If data is block header then txCount is zero so it is fine
  const transactions: BitcoinTransaction[] = [];
  let txBuf = transactionsBuf;
  for (let i = 0; i < txCount; i++) {
    let tx: BitcoinTransaction;
    [tx, txBuf] = readTx(txBuf as TransactionPayload);
    transactions.push(tx);
  }
  const rest = txBuf;

  if (txCount > 0) {
    const merkleRootCalculated = calculateMerkleRoot(
      transactions.map((tx) => tx.hash)
    );
    if (!merkleRoot.equals(merkleRootCalculated)) {
      throw new Error(`Wrong Merkle root hash`);
    }
  }

  return [
    {
      version,
      prevBlock,
      merkleRoot,
      timestamp,
      bits,
      nonce,
      txCount,
      hash,
      transactions,
    },
    rest,
  ] as const;
}
export type BitcoinBlock = ReturnType<typeof readBlock>[0];

function calculateMerkleRoot(transactionHashes: TransactionHash[]) {
  let arr = transactionHashes.slice() as Buffer[];
  while (arr.length > 1) {
    const newArr: Buffer[] = [];
    for (let i = 0; i < arr.length; i += 2) {
      const A = arr[i];
      const B = i + 1 < arr.length ? arr[i + 1] : A;
      const join = joinBuffers(A, B);
      const hash = sha256(sha256(join));
      newArr.push(hash);
    }
    arr = newArr;
  }
  return arr[0] as MerkleRootHash;
}

export function readTxIn(buf: Buffer) {
  const outpointHash = buf.subarray(0, 32) as TransactionHash;
  const outpointIndex = buf.readUInt32LE(32);
  let scriptLen;
  [scriptLen, buf] = readVarInt(buf.subarray(36));
  const script = buf.subarray(0, scriptLen) as SignatureScript;
  buf = buf.subarray(scriptLen);
  const sequence = buf.readUInt32LE(0);
  buf = buf.subarray(4);
  return [
    {
      outpointHash,
      outpointIndex,
      script,
      sequence,
    },
    buf,
  ] as const;
}
export type BitcoinTransactionIn = ReturnType<typeof readTxIn>[0];

export function readTxOut(buf: Buffer) {
  const value = buf.subarray(0, 8).readBigInt64LE(0);
  buf = buf.subarray(8);
  let scriptLen;
  [scriptLen, buf] = readVarInt(buf);
  const script = buf.subarray(0, scriptLen) as PkScript;
  buf = buf.subarray(scriptLen);
  return [
    {
      value,
      script,
    },
    buf,
  ] as const;
}
export type BitcoinTransactionOut = ReturnType<typeof readTxOut>[0];

export function readTx(payload: TransactionPayload) {
  let buf: Buffer = payload;

  const version = buf.readUInt32LE(0);
  const isFlag = buf[4] === 0;
  if (isFlag && buf[5] !== 1) {
    console.error(buf);
    throw new Error("Unknown flag");
  }

  buf = isFlag ? buf.subarray(6) : buf.subarray(4);

  let txInCount;
  [txInCount, buf] = readVarInt(buf);
  if (txInCount === 0) {
    throw new Error("LOL tx_in count is zero");
  }
  const txIn: BitcoinTransactionIn[] = [];
  while (txInCount > 0) {
    let tx;
    [tx, buf] = readTxIn(buf);
    txIn.push(tx);
    txInCount--;
  }

  let txOutCount;
  [txOutCount, buf] = readVarInt(buf);
  const txOut: BitcoinTransactionOut[] = [];
  while (txOutCount > 0) {
    let tx;
    [tx, buf] = readTxOut(buf);
    txOut.push(tx);
    txOutCount--;
  }

  if (isFlag) {
    throw new Error("Not implemented yet");
  }

  const lockTime = buf.readUInt32LE(0);
  buf = buf.subarray(4);

  const hashingSource = payload.subarray(0, payload.length - buf.length);
  const hash = sha256(sha256(hashingSource)) as TransactionHash;
  const rest = buf;
  return [
    {
      version,
      txIn,
      txOut,
      lockTime,
      hash,
    },
    rest,
  ] as const;
}
export type BitcoinTransaction = ReturnType<typeof readTx>[0];
