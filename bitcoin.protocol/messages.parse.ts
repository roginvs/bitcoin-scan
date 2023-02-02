import { bitcoinMessageMagic, protocolVersion } from "./consts";
import { sha256 } from "./hashes";
import { packTx } from "./messages.create";
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
  InventoryItem,
  HashType,
  WitnessStackItem,
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

  return [count, buf.subarray(startAt)] as const;
}

/** Accepts buf with 8 bytes of services */
function parseServices(payload: Buffer) {
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
  const version = payload.subarray(0, 4).readUInt32LE(0);
  const services = payload.subarray(4, 4 + 8);
  // Timestamp is 64bit but for now I do not care
  const timestamp = payload.readUInt32LE(4 + 8);
  // Skip addresses for now
  const nonce = payload.subarray(4 + 8 + 8 + 26 + 26, 4 + 8 + 8 + 26 + 26 + 8);
  const [userAgentLen, fromUserAgent] = readVarInt(
    payload.subarray(4 + 8 + 8 + 26 + 26 + 8)
  );
  const userAgent = fromUserAgent.subarray(0, userAgentLen);
  const startHeight = fromUserAgent.readUInt32LE(userAgentLen);

  let relay = false;
  const rest = fromUserAgent.subarray(userAgentLen + 4);
  if (version >= 70001) {
    if (rest.length !== 1) {
      throw new Error(
        `No data or too many data for relay flag: len=${rest.length}`
      );
    }
    relay = !!rest[0];
  } else {
    if (rest.length > 0) {
      throw new Error(`Some data is left`);
    }
  }

  return {
    version,
    services: parseServices(services),
    startHeight,
    userAgent: userAgent.toString(),
    nonce: nonce.toString("hex"),
    relay,
    timestamp,
  };
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
  const headerPayload = buf.subarray(0, 4 + 32 + 32 + 4 + 4 + 4);
  const hash = sha256(sha256(headerPayload)) as BlockHash;

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
      transactions.map((tx) => tx.txid)
    );
    if (!merkleRoot.equals(merkleRootCalculated)) {
      throw new Error(`Wrong Merkle root hash`);
    }

    const isNeedToCheckCommitment = transactions.some((tx) => tx.isWitness);
    if (isNeedToCheckCommitment) {
      const witnessRootHash = calculateMerkleRoot(
        transactions.map((tx) => tx.wtxid)
      );
      const coinbaseTx = transactions[0];
      if (!coinbaseTx.isWitness) {
        throw new Error(`No witness for coinbase`);
      }
      if (coinbaseTx.txIn.length !== 1) {
        throw new Error(`Coinbase inputs len is not one`);
      }
      if (coinbaseTx.txIn[0].witness?.length !== 1) {
        throw new Error(`Coinbase witness len is not one`);
      }
      const witnessReversedValue = coinbaseTx.txIn[0].witness![0];
      const commitmentHash = sha256(
        sha256(joinBuffers(witnessRootHash, witnessReversedValue))
      );

      let commitmentOutIndex = -1;
      for (const [index, txOut] of coinbaseTx.txOut.entries()) {
        if (
          txOut.script.length >= 38 &&
          txOut.script.subarray(0, 6).equals(Buffer.from("6a24aa21a9ed", "hex"))
        ) {
          commitmentOutIndex = index;
        }
      }
      if (commitmentOutIndex === -1) {
        throw new Error(`Did not found commitment`);
      }
      const expectedCommitmentHash = coinbaseTx.txOut[
        commitmentOutIndex
      ].script.subarray(6, 38);
      if (!expectedCommitmentHash.equals(commitmentHash)) {
        throw new Error(`Commitment verification failed`);
      }
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
      headerPayload,
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
      witness: undefined as undefined | WitnessStackItem[],
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
  const isWitness = buf[4] === 0;
  if (isWitness && buf[5] !== 1) {
    console.error(payload);
    throw new Error("Unknown flag");
  }

  buf = isWitness ? buf.subarray(6) : buf.subarray(4);

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

  if (isWitness) {
    for (let i = 0; i < txIn.length; i++) {
      let witness: WitnessStackItem[] = [];
      let witnessesCount;
      [witnessesCount, buf] = readVarInt(buf);
      for (let ii = 0; ii < witnessesCount; ii++) {
        let witnessItemLen;
        [witnessItemLen, buf] = readVarInt(buf);
        const witnessItem = buf.subarray(0, witnessItemLen) as WitnessStackItem;
        buf = buf.subarray(witnessItemLen);
        witness.push(witnessItem);
      }
      txIn[i] = {
        ...txIn[i],
        witness,
      };
    }
  }

  const lockTime = buf.readUInt32LE(0);
  buf = buf.subarray(4);

  const txNoHashes = {
    version,
    txIn,
    txOut,
    lockTime,
    isWitness,
  } as const;

  const fullTransactionBuf = payload.subarray(
    0,
    payload.length - buf.length
  ) as TransactionPayload;
  let txid: TransactionHash;
  if (!isWitness) {
    txid = sha256(sha256(fullTransactionBuf)) as TransactionHash;
  } else {
    const packedWithNoWitness = packTx({
      ...txNoHashes,
      isWitness: false,
      txid: Buffer.alloc(0) as TransactionHash,
      wtxid: Buffer.alloc(0) as TransactionHash,
      payload: Buffer.alloc(0) as TransactionPayload,
    });
    txid = sha256(sha256(packedWithNoWitness)) as TransactionHash;
  }

  let wtxid: TransactionHash;
  const isAllTxInAreNoWitness = txIn.every(
    (tx) => !tx.witness || tx.witness.length === 0
  );

  if (isWitness && !isAllTxInAreNoWitness) {
    if (
      txIn.length === 1 &&
      txIn[0].outpointHash.equals(Buffer.alloc(32, 0)) &&
      txIn[0].outpointIndex === 0xffffffff
    ) {
      // Looks like coinbase
      wtxid = Buffer.alloc(32, 0) as TransactionHash;
    } else {
      wtxid = sha256(sha256(fullTransactionBuf)) as TransactionHash;
    }
  } else {
    wtxid = txid;
  }

  const rest = buf;
  return [
    {
      ...txNoHashes,
      txid,
      wtxid,
      // We might want to clone buffer here to prevent memory leak.
      // If we read big block and keep reference to one tx then
      // subarray of the buffer will still point into block raw data
      payload: fullTransactionBuf,
    },
    rest,
  ] as const;
}
export type BitcoinTransaction = ReturnType<typeof readTx>[0];

export function readInvPayload(payload: MessagePayload) {
  let inventories: InventoryItem[] = [];
  let [count, buf] = readVarInt(payload);
  if (buf.length !== count * 36) {
    throw new Error(`Wrong length for inv payload`);
  }
  for (let i = 0; i < count; i++) {
    const type = buf.readUInt32LE(36 * i);
    const hash = buf.subarray(36 * i + 4, 36 * i + 4 + 32);
    if (type === HashType.ERROR) {
      // do nothing, just ignore
    } else if (type === HashType.MSG_BLOCK) {
      inventories.push([type, hash as BlockHash]);
    } else if (type === HashType.MSG_TX) {
      inventories.push([type, hash as TransactionHash]);
    } else {
      // TODO
      // Just ignore for now
    }
  }
  return inventories;
}
export function readNotFoundPayload(payload: MessagePayload) {
  return readInvPayload(payload);
}
export function readAddr(payload: Buffer) {
  const services = parseServices(payload.subarray(0, 8));
  const ipv4or6 = payload.subarray(8, 8 + 16);
  let host;
  let ipFamily;
  if (
    ipv4or6
      .subarray(0, 12)
      .equals(Buffer.from("00000000000000000000FFFF", "hex"))
  ) {
    host = [12, 13, 14, 15]
      .map((i) => ipv4or6.readUInt8(i).toString())
      .join(".");

    ipFamily = 4 as const;
  } else {
    host = [0, 2, 4, 6, 8, 10, 12, 14]
      .map((i) => ipv4or6.subarray(i, i + 2).toString("hex"))
      .join(":");

    ipFamily = 6 as const;
  }
  const port = payload.readUInt16BE(8 + 16);
  return [
    {
      services,
      host,
      port,
      ipFamily,
    },
    payload.subarray(8 + 16 + 2),
  ] as const;
}

export function readAddrWithTime(buf: Buffer) {
  const time = new Date(buf.readUint32LE() * 1000);
  const [addr, rest] = readAddr(buf.subarray(4));
  return [
    {
      ...addr,
      time,
    },
    rest,
  ] as const;
}
