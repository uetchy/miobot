import path from 'path'
import assert from 'assert'
import express from 'express'
import { AddressInfo } from 'net'

import createBot from './bot'

const PORT = process.env.PORT || 3000
const REDIS_URL = process.env.REDISCLOUD_URL || '127.0.0.1'

const API_SECRET = process.env.API_SECRET!
const BOT_TOKEN = process.env.BOT_TOKEN!
const WEBHOOK_URL = process.env.WEBHOOK_URL!
assert(API_SECRET, 'API_SECRET is missing')
assert(BOT_TOKEN, 'BOT_TOKEN is missing')
assert(WEBHOOK_URL, 'WEBHOOK_URL is missing')

async function main() {
  const app = express()

  // telegram bot
  app.use(
    createBot({
      port: PORT,
      botToken: BOT_TOKEN,
      apiSecret: API_SECRET,
      redisURL: REDIS_URL,
      webhookURL: WEBHOOK_URL,
    })
  )

  // web
  app.use(express.static(path.join(__dirname, '../src/web/build')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/web/build/index.html'))
  })

  const server = app.listen(PORT, () => {
    const { port, address } = server.address() as AddressInfo
    console.log(`Gateway running on ${address}:${port}`)
  })
}

main().catch((err) => {
  console.log(err)
})
