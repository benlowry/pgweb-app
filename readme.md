# PGWeb SaaS
This is a proof-of-concept merging the standalone single-user web app "pgweb" 
with dashboard.

## How it works
1) Users save connection information as bookmarks
2) Opening a bookmark starts a copy of pgweb bound to their connection
3) Proxy requests to their pgweb process

### Notes:
1) /static/ directory assets moved to /public/ and remapped in index.html
3) index.html modified to include navbar template for UserAppStore
4) app.js modified to store last-selected table etc in sessionStorage
5) app.js modified to use /api and append bookmarkid=X to apiCall() requests
6) app.js modified to open to eg query or rows or indexes based on URL

## Demonstration 1
This is running as a standalone app, in this case users would register and 
pay and etc all on your own SaaS website.  You will need to register to
use this example, or sign in as "test" with password "testtest" to explore
a preconfigured database:

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
    BCRYPT_FIXED_SALT: "" (see generate notes below)
    BCRYPT_WORKLOAD_FACTOR: 4
    MINIMUM_PASSWORD_LENGTH: 5
    MINIMUM_USERNAME_LENGTH: 5
    MINIMUM_TOKEN_LENGTH: 5

## Run as a UserAppStore app
To run as an AppStore app you need to configure this ENV variable:

    USERAPPSTORE="https://userappstore.com"

### Generating a salt
Fixed-salts return the same hash every time, this is useful for usernames and
some other fields where you want to retrieve by value or ensure non-duplicates.  

Passwords and wherever possible a random salt is used each time.

    $ node
    $ var bcrypt = require('node-bcrypt')
    $ bcrypt.genSaltSync(bcryptWorkFactor);

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
dashboard generate IDs so the sequence might be #1 = userid #2 = sessionid. The
sequence can be made fuzzier with ENV variables:

    ID_SEED: 0
    ID_MINIMUM_INCREASE: 1
    ID_MAXIMUM_INCREASE: 0