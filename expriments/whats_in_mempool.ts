import https from "https";
import { PkScript, TransactionHash } from "../bitcoin/protocol/messages.types";

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
  console.info("====");
  for (const tx of data.txs) {
    for (const input of tx.inputs) {
      const pkScript = Buffer.from(input.prev_out.script, "hex") as PkScript;

      if (pkScript[0] === 0) {
        if (pkScript.length === 22 || pkScript.length === 34) {
          // ok, witness 0
        } else {
          console.info(tx);
          throw new Error(` Unknown witness 0`);
        }
      } else if (pkScript[0] === 0x51) {
        if (pkScript.length === 34) {
          // ok, witness 1
        } else {
          console.info(tx);
          throw new Error(` Unknown witness 1`);
        }
      } else if (
        pkScript.length === 23 &&
        pkScript[0] === 0xa9 &&
        pkScript[1] === 0x14 &&
        pkScript[pkScript.length - 1] == 0x87
      ) {
        // P2SH: OP_HASH160 <data> OP_EQUAL
      } else if (
        pkScript.length === 1 + 33 + 1 &&
        pkScript[0] === 0x33 &&
        pkScript[pkScript.length - 1] === 0xac
      ) {
        // P2PK: <pub key> OP_CHECKSIG
      } else if (
        pkScript.length === 25 &&
        pkScript[0] === 0x76 &&
        pkScript[1] === 0xa9 &&
        pkScript[2] === 20 &&
        pkScript[pkScript.length - 2] === 0x88 &&
        pkScript[pkScript.length - 1] === 0xac
      ) {
        // P2PKH:OP_DUP OP_HASH160 <20-byte pubkey hash> OP_EQUALVERIFY OP_CHECKSIG
      } else {
        console.info(tx);
        console.info(input);
        console.info("");
      }
    }
  }
  console.info("ok");
}
