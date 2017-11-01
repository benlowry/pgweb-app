const EncryptedRedis = require('encrypted-redis')
const Redis = require('redis')

const client = Redis.createClient(process.env.REDIS_URL)
client.on('error', () => {
  throw new Error('A database error occurred')
})

module.exports = EncryptedRedis(client)
