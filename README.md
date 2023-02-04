# Scan bitcoin blockchain for vulnerable signatures

This is a small project to fetch all bitcoin transactions and to find out signatures with the same k value.

Currently works only with P2PKH scripts.

In 2023 this is not very actual because all known clients do not have this vulnerability and all vulnerabile wallets are empty now.

## Usage

1. Install nodejs at least version 16, do `npm install`.

2. (optional) Copy `.env.defaults` into `.env` and change configuration there

3. Start `./node_modules/.bin/ts-node scanner/main.ts`

4. Periodically check found keys

```
sqlite3 data/scanner.db -quote 'select * from found_keys'
```

## TODO:

- Implement other script types

- Slighly split transactions database logic with recovery logic

- Maybe automatically create transaction to withdraw funds into pre-defined wallet (careful here!)

- Listen to mempool transactions and scan them too

## Links

https://www.blockchain.com/explorer
https://en.bitcoin.it/wiki/OP_CHECKSIG
https://developer.bitcoin.org/devguide/transactions.html#locktime_parsing_rules
https://en.bitcoin.it/wiki/Script
https://en.bitcoin.it/wiki/Protocol_documentation
https://bitnodes.io/nodes/?q=Finland
https://developer.bitcoin.org/devguide/contracts.html
