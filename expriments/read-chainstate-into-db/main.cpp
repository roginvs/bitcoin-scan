#include <cassert>
#include "leveldb/db.h"
#include <iostream>
#include <memory>

/*

g++ main.cpp /usr/lib/x86_64-linux-gnu/libleveldb.so -o main.bin && ./main.bin

*/

std::unique_ptr<leveldb::DB> init_db()
{
    leveldb::Options options;
    options.create_if_missing = false;

    leveldb::DB *db__;
    leveldb::Status status = leveldb::DB::Open(options, "/tmp/testdb", &db__);
    assert(status.ok());

    return std::unique_ptr<leveldb::DB>(db__);
}

int main()
{
    auto db = init_db();

    std::cout << "Ok" << std::endl;
}