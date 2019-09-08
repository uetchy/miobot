const express = require('express')
const path = require('path')

const bot = require('./bot')
// const api = require('./worker')

const PORT = process.env.PORT || 3000

const app = express()

// telegram bot
app.use(bot)

// web
app.use(express.static(path.join(__dirname, '/web/build')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/web/build/index.html'))
})

const server = app.listen(PORT, () => {
  console.log(
    `Gateway running on ${server.address().address}:${server.address().port}`
  )
})
