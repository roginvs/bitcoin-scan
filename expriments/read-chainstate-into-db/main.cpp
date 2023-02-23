#include <cassert>
#include "leveldb/db.h"
#include <iostream>
#include <memory>
#include <vector>
#include <span>
#include <sqlite3.h>

#include "./funcs.cpp"
#include "./from-bitcoin-code.cpp"

/*

g++ -std=c++20 main.cpp \
  /usr/lib/x86_64-linux-gnu/libleveldb.so \
  /usr/lib/x86_64-linux-gnu/libsecp256k1.so \
  /usr/lib/x86_64-linux-gnu/libsqlite3.so \
  -o main.bin && ./main.bin

*/

void ok(leveldb::Status status)
{
    if (!status.ok())
    {
        std::cerr << status.ToString() << std::endl;
        exit(1);
    }
}
void ok(bool condition, const char *message)
{
    if (!condition)
    {
        std::cerr << message << std::endl;
        exit(1);
    }
};

std::unique_ptr<leveldb::DB> init_db()
{
    leveldb::Options options;
    options.create_if_missing = false;

    leveldb::DB *db__;
    ok(leveldb::DB::Open(options, "/data/bitcoind-data/chainstate.copy/", &db__));

    return std::unique_ptr<leveldb::DB>(db__);
}

std::unique_ptr<leveldb::Iterator> get_all(leveldb::DB &db)
{
    leveldb::ReadOptions opts;
    // opts.verify_checksums = true;
    return std::unique_ptr<leveldb::Iterator>(db.NewIterator(opts));
}

// Copy-paste from financial.storage.ts
auto initdb_sql = R"blablafoo(
    CREATE TABLE IF NOT EXISTS unspent_transaction_outputs  (
      id INTEGER PRIMARY KEY, 
      transaction_hash CHARACTER(32) NOT NULL, 
      output_id INTEGER NOT NULL,
      pub_script BLOB NOT NULL,
      value integer
    );

    CREATE INDEX IF NOT EXISTS unspent_tx_out_idx ON unspent_transaction_outputs
     (transaction_hash, output_id);

    -- To get value per each wallet
    CREATE INDEX IF NOT EXISTS unspent_pub_script_idx ON unspent_transaction_outputs
     (pub_script);


    -- Just a way to remember which block we processed last time
    CREATE TABLE IF NOT EXISTS last_processed_block_hash (
        _uniq INTEGER NOT NULL CHECK (_uniq = 1),
        block_hash CHARACTER(32) NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS last_processed_block_hash_idx ON last_processed_block_hash
     (_uniq);



PRAGMA journal_mode=WAL;

delete from unspent_transaction_outputs;
delete from last_processed_block_hash;



)blablafoo";

int main()
{
    std::cout << "Starting" << std::endl;

    sqlite3 *sql;
    if (sqlite3_open("/data/bitcoin/newfinancial.db", &sql))
    {
        printf("Failed to open sqlite database: %s\n", sqlite3_errmsg(sql));
        exit(1);
    };

    char *sql_zErrMsg = 0;
    if (sqlite3_exec(sql, initdb_sql, NULL, 0, &sql_zErrMsg) != SQLITE_OK)
    {
        fprintf(stderr, "SQL error: %s\n", sql_zErrMsg);
        sqlite3_free(sql_zErrMsg);
        exit(1);
    };

    if (sqlite3_exec(sql, "BEGIN TRANSACTION", NULL, 0, &sql_zErrMsg) != SQLITE_OK)
    {
        fprintf(stderr, "SQL error: %s\n", sql_zErrMsg);
        sqlite3_free(sql_zErrMsg);
        exit(1);
    };

    sqlite3_stmt *insert_stmt;
    auto insert_stmt_sql = "insert into unspent_transaction_outputs (transaction_hash, output_id, pub_script, value) values (?,?,?,?)";
    if (sqlite3_prepare_v2(
            sql,                     // the handle to your (opened and ready) database
            insert_stmt_sql,         // the sql statement, utf-8 encoded
            strlen(insert_stmt_sql), // max length of sql statement
            &insert_stmt,            // this is an "out" parameter, the compiled statement goes here
            nullptr)                 // pointer to the tail end of sql statement (when there are
        != SQLITE_OK)
    {
        printf("Failed to prepare statement: %s\n", sqlite3_errmsg(sql));
        exit(1);
    }
    // test_read_var_int();

    size_t highest_block_height_seen = 0;
    size_t transactions_count = 0;

    auto db = init_db();

    std::string obfuscate_key;

    char obfuscate_key_key[] = "\x0e\0obfuscate_key";
    ok(db->Get(leveldb::ReadOptions(), leveldb::Slice(obfuscate_key_key, sizeof(obfuscate_key_key) - 1), &obfuscate_key));

    // std::cout << "Obfuscate key value = " << obfuscate_key << " len=" << obfuscate_key.size() << std::endl;
    // for (uint i = 0; i < obfuscate_key.size(); ++i)
    // {
    //     printf("%02x", (unsigned char)(obfuscate_key[i]));
    // };
    // std::cout << std::endl
    //           << std::endl;

    auto iter = get_all(*db);

    std::cout << "Fetching transcations" << std::endl;

    for (iter->SeekToFirst(); iter->Valid(); iter->Next())
    {
        auto key = iter->key();
        auto keyData = key.data();

        // std::vector<char> w_(iter->key().data, iter->key().data + iter->key().length);
        if (key.size() < 1 + 32 + 1)
        {
            continue;
        }
        if (*keyData != 0x43)
        {
            continue;
        }

        transactions_count++;

        auto txid = leveldb::Slice(keyData + 1, 32);
        uint64_t vout;
        auto rest = read_var_int(std::span(keyData + 1 + 32, key.size() - 1 - 32), &vout);
        ok(rest.size() == 0, "Nothing left");

        auto value = deobfuscate(std::span(iter->value().data(), iter->value().size()), std::span(obfuscate_key.data() + 1, obfuscate_key.size() - 1));

        // for (uint i = 0; i < txid.size(); ++i)
        // {
        //     printf("%02x", (unsigned char)(txid[31 - i]));
        // };
        // std::cout << " vout=" << vout << std::endl;

        uint64_t block_height_and_is_coinbase;
        rest = read_var_int(std::span(value.data(), value.size()), &block_height_and_is_coinbase);
        uint64_t block_height = block_height_and_is_coinbase / 2;
        uint64_t is_coinbase = block_height_and_is_coinbase % 2 == 0;
        if (block_height > highest_block_height_seen)
        {
            highest_block_height_seen = block_height;
        }
        // std::cout << "block_height=" << block_height << std::endl;

        uint64_t amount_compressed;
        rest = read_var_int(rest, &amount_compressed);
        uint64_t amount = DecompressAmount(amount_compressed);
        // std::cout << "amount=" << amount << std::endl;

        uint64_t script_n_size;
        rest = read_var_int(rest, &script_n_size);
        // std::cout << "script_n_size=" << script_n_size << " rest len = " << rest.size() << std::endl;
        std::vector<unsigned char> script;
        ok(DecompressScript(script, script_n_size, rest), "Failed to decompress script");

        sqlite3_bind_blob(insert_stmt, 1, txid.data(), txid.size(), NULL);
        sqlite3_bind_int64(insert_stmt, 2, vout);
        sqlite3_bind_blob(insert_stmt, 3, script.data(), script.size(), NULL);
        sqlite3_bind_int64(insert_stmt, 4, amount);
        if (sqlite3_step(insert_stmt) != SQLITE_DONE)
        {
            fprintf(stderr, "insert statement didn't return DONE %s\n", sqlite3_errmsg(sql));
            exit(2);
        }

        sqlite3_reset(insert_stmt);

        // for (uint i = 0; i < script.size(); ++i)
        // {
        //     printf("%02x", (unsigned char)(script[i]));
        // };
        // printf("\n\n");

        if (transactions_count % 1000 == 0)
        {
            std::cout << "Processed " << transactions_count << " transactions" << std::endl;
        }
    }
    assert(iter->status().ok());

    std::cout << "Ok, committing transcation" << std::endl;

    if (sqlite3_exec(sql, "COMMIT", NULL, 0, &sql_zErrMsg) != SQLITE_OK)
    {
        fprintf(stderr, "SQL error: %s\n", sql_zErrMsg);
        sqlite3_free(sql_zErrMsg);
        exit(1);
    };

    sqlite3_finalize(insert_stmt);
    sqlite3_close(sql);
    std::cout << "Ok, done." << std::endl;
    std::cout << "transactions_count=" << transactions_count << std::endl;
    std::cout << "highest_block_height_seen=" << highest_block_height_seen << std::endl;
    std::cout << "Now you need to do this in financial.sql: " << std::endl;
}