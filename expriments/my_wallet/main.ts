/*

# First, generate private key
openssl ecparam -genkey -out wallet.pem -name secp256k1 -noout

# Encrypt and save somewhere
openssl aes-256-cbc -e -pbkdf2 -in wallet.pem -out wallet.enc.pem
# Decrypt
openssl aes-256-cbc -d -pbkdf2 -in wallet.enc.pem -out wallet.decccc.pem

*/
