import { readVarInt } from "../../bitcoin/protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  TransactionHash,
  WitnessStackItem,
} from "../../bitcoin/protocol/messages.types";
import { UnconfimedTransactions } from "./blockchain_info_types";
import { convertInput } from "./converter";
import { fetchJson } from "./fetch";
import { printScript, readScript } from "./read_script";
import { isSomethingInteresting } from "./script_check";

const url = "https://blockchain.info/unconfirmed-transactions?format=json";

fetchJson(url).then((data: UnconfimedTransactions) => {
  console.info("Data fetched, parsing...");
  for (const tx of data.txs) {
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
  console.info("Done");
});
