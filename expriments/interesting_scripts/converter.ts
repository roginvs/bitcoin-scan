import { readVarInt } from "../../bitcoin/protocol/messages.parse";
import {
  PkScript,
  SignatureScript,
  WitnessStackItem,
} from "../../bitcoin/protocol/messages.types";
import {
  BlockchainInfoTx,
  BlockchainInfoTxInput,
} from "./blockchain_info_types";

export function convertInput(input: BlockchainInfoTxInput) {
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
  return {
    witness,
    pkScript,
    scriptSig,
  };
}
