export interface BlockchainInfoTxInput {
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

export interface BlockchainInfoTx {
  hash: string;
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
  inputs: [BlockchainInfoTxInput];
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
}
export interface BlockchainInfoApiUnspentTranscation {
  txs: BlockchainInfoTx[];
}

export interface BlockchainInfoBlock {
  hash: string;
  ver: number;
  prev_block: string;
  mrkl_root: string;
  time: number;
  bits: number;
  next_block: [string];
  fee: number;
  nonce: number;
  n_tx: number;
  size: number;
  block_index: number;
  main_chain: true;
  height: number;
  weight: number;
  tx: BlockchainInfoTx[];
}
export interface BlockchainInfoApiBlocks {
  blocks: BlockchainInfoBlock[];
}
