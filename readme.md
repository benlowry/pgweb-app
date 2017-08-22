# PGWeb SaaS
This is a proof-of-concept merging the standalone single-user web app "pgweb" 
with dashboard.

## How it works
1) Users save connection information as bookmarks
2) Opening a bookmark starts a copy of pgweb bound to that connection
3) Proxy requests to their pgweb process

### Changes:
1) /static/ contents copied to /public/ and remapped in index.html
3) index.html modified to include navbar template for UserAppStore
4) index.html modified to remove connection form and navigation 
5) app.js modified to store last-selected table etc in sessionStorage
6) app.js modified to use /api and append bookmarkid=X to apiCall() requests
7) app.js modified to open to eg query or rows or indexes based on URL

## Demonstration 1
This is running as a standalone web app, users register and pay and etc all 
on your own SaaS website.  Sign in as "test" with password "testtest" for
an account with a preconfigured database:

        https://secure-gorge-46054.herokuapp.com/

## Demonstration 2
This is running as an app in UserAppStore, in this case users install the 
app to their dashboard alongside any other apps they have installed. 

When publishing on UserAppStore a lot of the dashboard dependencies aren't 
used because the account, subscriptions etc are in UserAppStore. 

You will need to register to use this example.  After signing in browse to
the App Store, locate pgweb and install it to your dashboard:

        https://userappstore.com/ 

## Requirements
The dashboard software requires NodeJS and Redis.  For convenience the 
rest of the non-pgweb components run alongside the dashboard software
while an unmodified copy of pgweb executables is used.

1) Install current NodeJS from https://nodejs.org/
2) Install current Redis from https://redis.io/

## Setup
Clone the git repository:

    $ git clone https://github.com/benlowry/pgweb-saas
    $ cd pgweb-saas
    $ npm install
    $ node main.js

## Run as a standalone web app
To run as an independent app you need to configure these ENV variables:

    UUID_ENCODING_CHARACTERS="abcde..." (encodes sequential ids to short url type strings)
    BCRYPT_FIXED_SALT: "" (see notes below)
    MINIMUM_PASSWORD_LENGTH: 5
    MINIMUM_USERNAME_LENGTH: 5
    MINIMUM_TOKEN_LENGTH: 5
    REDIS_URL: "redis://localhost:6379"

## Run as a UserAppStore app
To run as an AppStore app you need to configure this ENV variable:

    USERAPPSTORE="https://userappstore.com"
    UUID_ENCODING_CHARACTERS="abcde..." (encodes sequential ids to short url type strings)
    BCRYPT_FIXED_SALT: "$...." (see notes below)
    BCRYPT_WORKLOAD_FACTOR: 10 (see notes below)
    REDIS_URL: "redis://localhost:6379"

### Generating a salt
Fixed-salts return the same hash every time, for usernames and some other fields where the 
hashed value is a surrogate for the real value and still used for comparisons, uniqueness etc.  

Because the hashed data is used a low work factor should be used so the operation completes quickly.

    $ node
    $ var bcrypt = require('bcrypt-node')
    $ bcrypt.genSaltSync(1);

The BCRYPT_WORKLOAD_FACTOR is used when hashing with random salts, for passwords
and generally where the hashed value is not used for anything.  It should be 10+ to ensure
anyone trying to reverse it requires too much computing power.

### Encrypting Redis data in production
You can encrypt your Redis database using a combination of AES-256 for data and 
fixed-salt bcrypt hashes for keys.  To encrypt Redis configure these ENV variables:

    REDIS_ENCRYPTION_KEY: "this is a secret"
    REDIS_KEY_HASH: "this is a secret"

### UUID encoding
The encoding works like url shortener websites - a sequential id is used and 
encoded to a string value, 1 -> 'a' 2 -> 'b' .... 

To make your ID values unpredictable you can randomize the characters and order
in your ENV variable:

    UUID_ENCODING_CHARACTERS="abcde..."
    UUID_ENCODING_CHARACTERS="z8dFg..."

A single Redis counter is used as the source of ID integers.  Many parts of the 
dashboard generate IDs so the first might be for a userid, the second a sessionid and
the third a recovery token. The sequence can be made fuzzier with ENV variables:

    ID_SEED: 0
    ID_MINIMUM_INCREASE: 1
    ID_MAXIMUM_INCREASE: 0