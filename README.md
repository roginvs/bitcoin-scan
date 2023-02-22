# Scan Bitcoin blockchain for vulnerable signatures

This is a small project to fetch all bitcoin transactions and to find out signatures with the same k value.

Currently works only with P2PKH scripts.

In 2023 this is not very actual because all known clients do not have this vulnerability and all vulnerabile wallets are empty now.

It is easier to obtain the same result just by patching official Bitcoin client but I made this project in order to learn Bitcoin internals.

## Usage

1. Install nodejs at least version 16, do `npm install`.

2. (optional) Copy `.env.defaults` into `.env` and change configuration there

3. Start `./node_modules/.bin/ts-node scanner/main.ts`

4. Periodically check found keys

```
sqlite3 data/scanner.db -quote 'select * from found_keys'
```

## Bonus item

There is a Bitcoin signature verification website https://roginvs.github.io/bitcoin-scan/

## TODO:

- Implement other script types

- Maybe automatically create transaction to withdraw funds into pre-defined wallet (careful here!)

- Listen to mempool transactions and scan them too

## Links

https://www.blockchain.com/explorer

https://en.bitcoin.it/wiki/OP_CHECKSIG

https://developer.bitcoin.org/devguide/transactions.html#locktime_parsing_rules

https://en.bitcoin.it/wiki/Script

https://en.bitcoin.it/wiki/Protocol_documentation

https://en.bitcoin.it/wiki/Transaction

https://bitnodes.io/nodes/?q=Finland

https://developer.bitcoin.org/devguide/contracts.html

https://github.com/bitcoin/bips/blob/master/README.mediawiki

https://btcinformation.org/en/developer-guide#block-chain-overview
