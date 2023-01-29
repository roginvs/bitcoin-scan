# Scan bitcoin blockchain for vulnarable signatures

This is a small project to fetch all bitcoin transactions and to find out signatures with the same k value.

Currently works only for P2PKH scripts.

## Usage

```
./node_modules/.bin/ts-node main.ts <peer ip> <peer port>
```

Then check found keys

```
sqlite3 database/files/transactions.db -quote 'select * from found_keys'

# Or this way:
while true; do \
  date ; \
  echo -n "Unspent transaction outputs: " ; \
  sqlite3 database/files/transactions.db -quote 'select count(*) from unspent_transaction_output'; \
  echo -n "Signatures: " ; \
  sqlite3 database/files/transactions.db -quote 'select count(*) from signatures'; \
  echo -n "Processed blocks: " ; \
  sqlite3 database/files/blockchain.db -quote 'select count(*) from blocks where is_processed'; \
  echo "File sizes"; \
  ls -lah database/files/blockchain.db database/files/transactions.db ; \
  echo "Found keys so far: " ; \
  sqlite3 database/files/transactions.db -quote 'select * from found_keys'; \
  echo "" ; \
  sleep 10;
done
```

## TODO:

- Listen to incoming updates and fetch new data immediately when it is available

- Sometimes public key is uncompressed so generated bitcoin wallet is wrong

- Implement other scripts

- Slighly split transactions database logic with recovery logic

- Implement transaction flag and witness

- Maybe automatically create transaction to withdraw funds into pre-defined wallet

## Links

https://www.blockchain.com/explorer
https://en.bitcoin.it/wiki/OP_CHECKSIG
https://developer.bitcoin.org/devguide/transactions.html#locktime_parsing_rules
https://en.bitcoin.it/wiki/Script
https://en.bitcoin.it/wiki/Protocol_documentation
https://bitnodes.io/nodes/?q=Finland
