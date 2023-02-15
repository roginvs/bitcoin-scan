import { bitcoinMessageMagic, protocolVersion } from "./consts";
import { sha256 } from "../utils/hashes";
import {
  BitcoinAddr,
  BitcoinAddrWithTime,
  BitcoinTransaction,
  BitcoinTransactionIn,
  BitcoinTransactionOut,
  BitcoinService,
  servicesData,
} from "./messages.parse";
import {
  BitcoinMessage,
  BlockHash,
  InventoryItem,
  MessagePayload,
  TransactionPayload,
} from "./messages.types";
import { nodeId } from "./nodeid";
import { joinBuffers } from "../utils/joinBuffer";

export function buildMessage(command: string, payload: MessagePayload) {
  const commandBuf = Buffer.alloc(12).fill(0);
  commandBuf.write(command);

  const out = Buffer.alloc(
    bitcoinMessageMagic.length + commandBuf.length + 4 + 4 + payload.length
  );
  bitcoinMessageMagic.copy(out, 0);
  commandBuf.copy(out, bitcoinMessageMagic.length);
  out.writeInt32LE(
    payload.length,
    bitcoinMessageMagic.length + commandBuf.length
  );

  const checksum = sha256(sha256(payload)).subarray(0, 4);
  checksum.copy(out, bitcoinMessageMagic.length + commandBuf.length + 4);

  payload.copy(out, bitcoinMessageMagic.length + commandBuf.length + 4 + 4);

  return out as BitcoinMessage;
}

export function packVarInt(value: number) {
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
    b.writeBigUInt64LE(BigInt(value), 1);
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
  const services = Buffer.from([1 | 8, 0, 0, 0, 0, 0, 0, 0]);
  const date = Buffer.alloc(8).fill(0);
  date.writeInt32LE(new Date().getTime() / 1000);
  const addr = Buffer.from(
    "010000000000000000000000000000000000FFFF000000000000",
    "hex"
  );

  const subVersion = packVarStr("Oink&Baa 1");
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

export function createGetheadersMessage(
  hashes: BlockHash[],
  hashStop: BlockHash = Buffer.alloc(32).fill(0) as BlockHash
) {
  const payload = joinBuffers(
    protocolVersion,
    packVarInt(hashes.length),
    ...hashes,
    hashStop
  ) as MessagePayload;
  return buildMessage("getheaders", payload);
}

function packInventories(inventories: InventoryItem[]) {
  const invCount = packVarInt(inventories.length);
  const payload = joinBuffers(
    invCount,
    ...inventories.flatMap(([type, value]) => [packUint32(type), value])
  ) as MessagePayload;
  return payload;
}
export function createGetdataMessage(inventories: InventoryItem[]) {
  return buildMessage("getdata", packInventories(inventories));
}
export function createNotfoundMessage(inventories: InventoryItem[]) {
  return buildMessage("notfound", packInventories(inventories));
}

export function packTxIn(txin: BitcoinTransactionIn) {
  const outpointIndex = Buffer.alloc(4);
  outpointIndex.writeUInt32LE(txin.outpointIndex);

  const scriptLen = packVarInt(txin.script.length);
  const sequence = Buffer.alloc(4);
  sequence.writeUInt32LE(txin.sequence);
  return joinBuffers(
    txin.outpointHash,
    outpointIndex,
    scriptLen,
    txin.script,
    sequence
  );
}
export function packTxOut(txout: BitcoinTransactionOut) {
  const value = Buffer.alloc(8);
  value.writeBigUInt64LE(txout.value);
  const pkScriptLen = packVarInt(txout.script.length);
  return joinBuffers(value, pkScriptLen, txout.script);
}
export function packTx(tx: BitcoinTransaction) {
  const version = Buffer.alloc(4);
  version.writeUInt32LE(tx.version);

  const witnessFlag = tx.isWitness
    ? Buffer.from("0001", "hex")
    : Buffer.alloc(0);
  const txInCount = packVarInt(tx.txIn.length);
  const txInList = tx.txIn.map((txIn) => packTxIn(txIn));

  const txOutCount = packVarInt(tx.txOut.length);
  const txOutList = tx.txOut.map((txOut) => packTxOut(txOut));

  const witness: Buffer[] = [];
  if (tx.isWitness) {
    for (const txIn of tx.txIn) {
      const count = txIn.witness ? txIn.witness.length : 0;
      witness.push(packVarInt(count));
      if (txIn.witness) {
        for (const witnessItem of txIn.witness) {
          witness.push(packVarInt(witnessItem.length));
          witness.push(witnessItem);
        }
      }
    }
  }

  const lockTime = Buffer.alloc(4);
  lockTime.writeUInt32LE(tx.lockTime);

  return joinBuffers(
    version,
    witnessFlag,
    txInCount,
    ...txInList,
    txOutCount,
    ...txOutList,
    ...witness,
    lockTime
  ) as TransactionPayload;
}

export function packServices(services: BitcoinService[]) {
  const out = Buffer.alloc(8, 0);
  let val = 0;
  for (const [n, service] of servicesData) {
    if (services.includes(service)) {
      val |= n;
    }
  }
  out.writeUInt32LE(val, 0);
  return out;
}

export function packAddr(address: BitcoinAddr) {
  const services = packServices(address.services);
  const ipaddr = Buffer.alloc(16, 0);
  if (address.ipFamily === 4) {
    Buffer.from("00000000000000000000FFFF", "hex").copy(ipaddr);
    for (const [i, o] of address.host.split(".").entries()) {
      ipaddr[12 + i] = parseInt(o);
    }
  } else if (address.ipFamily === 6) {
    throw new Error("Too lazy to write this code");
  } else {
    const n: never = address.ipFamily;
  }
  const port = Buffer.alloc(2);
  port.writeUInt16BE(address.port);
  return joinBuffers(services, ipaddr, port);
}
export function packAddrWithTime(address: BitcoinAddrWithTime) {
  const time = Buffer.alloc(4);
  time.writeUInt32LE(new Date(address.time).getTime() / 1000);
  return joinBuffers(time, packAddr(address));
}

export function createAddrMessage(addresses: BitcoinAddrWithTime[]) {
  const count = packVarInt(addresses.length);
  const payload = joinBuffers(
    count,
    ...addresses.map((addr) => packAddrWithTime(addr))
  ) as MessagePayload;
  return buildMessage("addr", payload);
}
