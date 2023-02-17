import * as fs from "fs";
import {
  BlockchainInfoApiBlocks,
  BlockchainInfoApiUnspentTranscation,
  BlockchainInfoTx,
} from "./blockchain_info_types";
import { convertInput } from "./converter";
import { fetchJson } from "./fetch";
import { printScript, readScript } from "./read_script";
import { isSomethingInteresting } from "./script_check";

function checkTx(tx: BlockchainInfoTx) {
  for (const input of tx.inputs) {
    const isInteresting = isSomethingInteresting(convertInput(input));
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
      console.info(printScript(isInteresting, 1));
    }
  }
}
function checkUnconfirmed() {
  const url = "https://blockchain.info/unconfirmed-transactions?format=json";
  return fetchJson(url).then((data: BlockchainInfoApiUnspentTranscation) => {
    console.info("Data fetched, parsing...");
    for (const tx of data.txs) {
      checkTx(tx);
    }
    console.info("Done");
  });
}

async function checkBlock(height: number) {
  const url = `https://blockchain.info/block-height/${height}?format=json `;
  const data = JSON.parse(
    fs.readFileSync(__dirname + "/776947.json").toString()
  ) as BlockchainInfoApiBlocks;
  for (const block of data.blocks) {
    console.info(`Checking block ${block.height}`);
    for (const tx of block.tx.slice(1)) {
      checkTx(tx);
    }
  }
}

checkBlock(776947);
