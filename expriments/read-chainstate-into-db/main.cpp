#include <cassert>
#include "leveldb/db.h"
#include <iostream>
#include <memory>
#include <vector>
#include <span>

#include "./funcs.cpp"
/*

g++ -std=c++20 main.cpp /usr/lib/x86_64-linux-gnu/libleveldb.so -o main.bin && ./main.bin

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

int main()
{
    test_read_var_int();

    auto db = init_db();

    std::string obfuscate_key;

    char obfuscate_key_key[] = "\x0e\0obfuscate_key";
    ok(db->Get(leveldb::ReadOptions(), leveldb::Slice(obfuscate_key_key, sizeof(obfuscate_key_key) - 1), &obfuscate_key));

    std::cout << "Obfuscate key value = " << obfuscate_key << std::endl;

    auto iter = get_all(*db);

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

        auto txid = leveldb::Slice(keyData + 1, 32);
        uint64_t vout;
        auto rest = read_var_int(std::span(keyData + 1 + 32, key.size() - 1 - 32), &vout);
        ok(rest.size() == 0, "Nothing left");

        /*

        if (vout_packed.size() != 1)
        {
            printf("Tx td: ");

            for (uint i = 0; i < txid.size(); ++i)
            {
                printf("%02x", (unsigned char)(txid[31 - i]));
            };
            std::cout << " size is not ok " << vout_packed.size() << std::endl;
            printf("\n\n");
        }
  std::cout << "notc = " << *keyStart << std::endl;
            std::cout << key.ToString() << ": " << iter->value().ToString() << std::endl;

            std::cout << "Len = " << key.size() << "   data = ";
            for (uint i = 0; i < key.size(); ++i)
            {
                auto x = keyStart[i];
                printf("%02x", x);
            };
            std::cout << std::endl;
            std::cout << std::endl;
        */

        // std::cout << iter->key().ToString() << ": " << iter->value().ToString() << std::endl;
    }
    assert(iter->status().ok());

    std::cout << "Ok" << std::endl;
}