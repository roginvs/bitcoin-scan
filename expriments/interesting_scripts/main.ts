import {
  BlockchainInfoApiBlocks,
  BlockchainInfoApiUnspentTranscation,
  BlockchainInfoTx,
} from "./blockchain_info_types";
import { convertInput } from "./converter";
import { fetchJson, fetchJsonNoFail } from "./fetch";
import { createInterestingScriptStorage } from "./interesting.storage";
import { printScript, readScript } from "./read_script";
import { isSomethingInteresting } from "./script_check";

const { isThisScriptInterstingAndNew } = createInterestingScriptStorage();

function checkTx(tx: BlockchainInfoTx, blockHash: string) {
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
      const isNew = isThisScriptInterstingAndNew(
        isInteresting,
        blockHash,
        tx.hash,
        input.sequence
      );
      if (isNew !== false) {
        // Do nothing, we already print in storage
      }
    }
  }
}
function checkUnconfirmed() {
  const url = "https://blockchain.info/unconfirmed-transactions?format=json";
  return fetchJson(url).then((data: BlockchainInfoApiUnspentTranscation) => {
    console.info("Data fetched, parsing...");
    for (const tx of data.txs) {
      checkTx(tx, "<unconfirmed>");
    }
    console.info(`Done ${data.txs.length} transactions`);
  });
}

async function checkBlock(height: number) {
  const url = `https://blockchain.info/block-height/${height}?format=json `;
  // const data = JSON.parse(
  //   fs.readFileSync(__dirname + "/776947.json").toString()
  // ) as BlockchainInfoApiBlocks;
  console.info(`Fetching ${url}`);
  const data: BlockchainInfoApiBlocks = await fetchJsonNoFail(url);

  for (const block of data.blocks) {
    console.info(`Checking block ${block.height}`);
    for (const tx of block.tx.slice(1)) {
      checkTx(tx, block.hash);
    }
    console.info(`Done ${block.tx.length - 1} transactions (no coinbase)`);
  }
  return data.blocks.map((block) => block.height);
}

(async () => {
  // let i = 776947 + 0;
  let i = 776947 + 0;
  while (true) {
    const blocks = await checkBlock(i);
    if (blocks.length === 0) {
      console.info(`No blocks at height ${i}`);
      break;
    }

    i++;
  }
})();

// checkUnconfirmed();
