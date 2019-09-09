import express from 'express'
import path from 'path'
import { AddressInfo } from 'net'
import bot from './bot'

const PORT = process.env.PORT || 3000

const app = express()

// telegram bot
app.use(bot)

// web
app.use(express.static(path.join(__dirname, '../src/web/build')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/web/build/index.html'))
})

const server = app.listen(PORT, () => {
  const { port, address } = server.address() as AddressInfo
  console.log(`Gateway running on ${address}:${port}`)
})
