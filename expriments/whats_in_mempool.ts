import https from "https";
import { readVarInt } from "../bitcoin/protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionHash,
  WitnessStackItem,
} from "../bitcoin/protocol/messages.types";
import { printScript, readScript } from "./read_script";

const url = "https://blockchain.info/unconfirmed-transactions?format=json";

https.get(url, (res) => {
  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    const json = JSON.parse(body);
    onData(json);
  });
});

function onData(data: {
  txs: {
    hash: TransactionHash;
    ver: number;
    vin_sz: number;
    vout_sz: number;
    size: number;
    weight: number;
    fee: number;
    relayed_by: string;
    lock_time: number;
    tx_index: number;
    double_spend: boolean;
    time: number;
    block_index: null | number;
    block_height: null | number;
    inputs: [
      {
        sequence: number;
        // Need to parse it, hex
        witness: string;
        // hex
        script: string;
        index: number;
        prev_out: {
          addr: string;
          n: number;
          script: string;
          spending_outpoints: [
            {
              n: number;
              tx_index: number;
            }
          ];
          spent: boolean;
          tx_index: number;
          type: number;
          value: number;
        };
      }
    ];
    out: [
      {
        type: number;
        spent: boolean;
        value: number;
        spending_outpoints: [];
        n: number;
        tx_index: number;
        script: string;
        addr: string;
      }
    ];
  }[];
}) {
  console.info("Data fetched, parsing...");
  for (const tx of data.txs) {
    for (const input of tx.inputs) {
      const witness =
        input.witness.length > 0
          ? (() => {
              let witnesses: WitnessStackItem[] = [];
              let witnessesCount;
              let buf = Buffer.from(input.witness, "hex");
              [witnessesCount, buf] = readVarInt(buf);
              for (let ii = 0; ii < witnessesCount; ii++) {
                let witnessItemLen;
                [witnessItemLen, buf] = readVarInt(buf);
                const witnessItem = buf.subarray(
                  0,
                  witnessItemLen
                ) as WitnessStackItem;
                buf = buf.subarray(witnessItemLen);
                witnesses.push(witnessItem);
              }
              return witnesses;
            })()
          : [];

      const pkScript = Buffer.from(input.prev_out.script, "hex") as PkScript;
      const scriptSig = Buffer.from(input.script, "hex") as SignatureScript;
      const isInteresting = isSomethingInteresting(
        pkScript,
        scriptSig,
        witness
      );
      if (isInteresting === null) {
        // nothing interesting
      } else if (typeof isInteresting === "string") {
        console.info(
          `ERROR ${isInteresting} with tx=${tx.hash} input=${input.index}`
        );
        console.info(input);
        console.info("");
      } else {
        console.info(
          `Something interesting with tx=${tx.hash} input=${input.index}`
        );
        console.info(printScript(isInteresting));
      }
    }
  }
  console.info("Done");
}

function is_p2pk(buf: Buffer) {
  // P2PK: <pub key> OP_CHECKSIG
  return (
    buf.length === 1 + 33 + 1 && buf[0] === 0x33 && buf[buf.length - 1] === 0xac
  );
}
function is_p2sh(buf: Buffer) {
  // P2SH: OP_HASH160 <data> OP_EQUAL
  return (
    buf.length === 23 &&
    buf[0] === 0xa9 &&
    buf[1] === 0x14 &&
    buf[buf.length - 1] == 0x87
  );
}
function is_p2pkh(buf: Buffer) {
  return (
    buf.length === 25 &&
    buf[0] === 0x76 &&
    buf[1] === 0xa9 &&
    buf[2] === 20 &&
    buf[buf.length - 2] === 0x88 &&
    buf[buf.length - 1] === 0xac
  );
}
function is_witness_0_p2wpkh(buf: Buffer) {
  return buf[0] === 0 && buf[1] === 160 / 8 && buf.length === 22;
}
function is_witness_0_p2wsh(buf: Buffer) {
  return buf[0] === 0 && buf[1] === 256 / 8 && buf.length === 34;
}
function is_witness_1(buf: Buffer) {
  return buf[0] === 0x51 && buf[1] === 0x20 && buf.length === 34;
}
function is_null(buf: Buffer) {
  return buf[0] === 0x6a; // OP_RETURN
}
function is_multisig(buf: Buffer) {
  const script = readScript(buf);
  if (script[script.length - 1] !== "OP_CHECKMULTISIG") {
    return false;
  }
  if (
    script[script.length - 2] !== "OP_TRUE" &&
    !script[script.length - 2].match(/^OP_(\d+)$/)
  ) {
    return false;
  }
  if (script[0] !== "OP_TRUE" && !script[0].match(/^OP_(\d+)$/)) {
    return false;
  }
  if (script.slice(1, 2).some((x) => x.startsWith("OP_"))) {
    return false;
  }
  return true;
}

function is_standard(pkScript: Buffer) {
  return (
    is_p2pk(pkScript) ||
    is_null(pkScript) ||
    is_witness_0_p2wpkh(pkScript) ||
    is_witness_1(pkScript) ||
    is_p2pkh(pkScript) ||
    is_multisig(pkScript) ||
    is_p2sh(pkScript) ||
    is_witness_0_p2wsh(pkScript)
  );
}
function is_redeem(pkScript: Buffer) {
  if (is_p2pk(pkScript)) {
    return false;
  } else if (is_null(pkScript)) {
    return false;
  } else if (is_witness_0_p2wpkh(pkScript)) {
    return false;
  } else if (is_witness_1(pkScript)) {
    // TODO
    return false;
  } else if (is_p2pkh(pkScript)) {
    return false;
  } else if (is_multisig(pkScript)) {
    return false;
  } else if (is_p2sh(pkScript)) {
    return true;
  } else if (is_witness_0_p2wsh(pkScript)) {
    return true;
  }

  return true;
}

function is_script_sig_pushes_only(scriptSig: SignatureScript) {
  const stack: Buffer[] = [];
  for (const op of readScript(scriptSig)) {
    if (!op.startsWith("OP_")) {
      stack.push(Buffer.from(op, "hex"));
    } else if (op === "OP_FALSE") {
      stack.push(Buffer.alloc(0));
    } else if (op === "OP_1NEGATE") {
      stack.push(Buffer.from([0x81]));
    } else if (op === "OP_TRUE") {
      stack.push(Buffer.from([0x01]));
    } else {
      const m = op.match(/^OP_(\d+)$/);
      if (m) {
        stack.push(Buffer.from([parseInt(m[1])]));
      } else {
        return null;
      }
    }
  }

  return stack;
}

function isSomethingInteresting(
  pkScript: PkScript,
  scriptSig: SignatureScript,
  witness: WitnessStackItem[]
) {
  if (!is_standard(pkScript)) {
    console.info(pkScript, is_standard(pkScript));
    console.info(is_p2pk(pkScript));
    console.info(is_null(pkScript));
    console.info(is_witness_0_p2wpkh(pkScript));
    console.info(is_witness_1(pkScript));
    console.info(is_p2pkh(pkScript));
    console.info(is_multisig(pkScript));
    console.info(is_p2sh(pkScript));
    console.info(is_witness_0_p2wsh(pkScript));

    return "non-standart pkScript";
  }

  const scriptSigItems = is_script_sig_pushes_only(scriptSig);

  if (!scriptSigItems) {
    console.info(readScript(scriptSig));
    return `Not a push in scriptSig`;
  }

  if (is_p2sh(pkScript)) {
    const redeemScript = scriptSigItems[scriptSigItems.length - 1];
    if (!redeemScript) {
      return `No redeem script!`;
    }
    if (is_p2sh(redeemScript)) {
      return `What, one more time p2sh?`;
    }
    if (is_witness_0_p2wsh(redeemScript)) {
      const witnessRedeem = witness[witness.length - 1];
      if (!witnessRedeem) {
        return `No redeem script!`;
      }
      if (is_standard(witnessRedeem)) {
        return null;
      }
      return readScript(witnessRedeem);
    }
  } else if (is_witness_0_p2wsh(pkScript)) {
    const witnessRedeem = witness[witness.length - 1];
    if (!witnessRedeem) {
      return `No redeem script in witness!`;
    }
    if (is_standard(witnessRedeem)) {
      return null;
    }
    return readScript(witnessRedeem);
  }

  // No redeem, nothing interesting
  return null;
}
