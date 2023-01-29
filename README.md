# Scan bitcoin blockchain for vulnarable signatures

This is a small project to fetch all bitcoin transactions and to find out signatures with the same k value.

Currently works only for P2PKH scripts.

## Usage

```
./node_modules/.bin/ts-node main.ts <peer ip> <peer port>
```

Then check found keys

```
sqlite3 db/transactions.db -quote 'select * from found_keys'
```
