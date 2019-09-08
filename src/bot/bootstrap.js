const { inlineKeyboard, urlButton, callbackButton } = require('telegraf/markup')
const jwt = require('jsonwebtoken')
const Scene = require('telegraf/scenes/base')
const addSeconds = require('date-fns/addSeconds')
const differenceInSeconds = require('date-fns/differenceInSeconds')
const assert = require('assert')

const { getAuthorizeURL } = require('../core/mio')
const { createUser, getUser } = require('../core/database')

const JWT_SECRET = process.env.JWT_SECRET
assert(JWT_SECRET, 'JWT_SECRET not specified')

// boostrap
const bootstrap = new Scene('bootstrap')
bootstrap.enter(async (ctx) => {
  ctx.webhookReply = false
  const { id, username } = ctx.chat
  const chat = await ctx.reply(`Preparing`)

  // reset user data for second time signup
  const user = await getUser(id)
  if (user) {
    user.remove()
  }

  const state = jwt.sign({ id: id, username: username }, JWT_SECRET)
  const authURL = getAuthorizeURL('http://localhost:3000/callback', state)
  const button = inlineKeyboard([
    urlButton('Proceed to IIJmio', authURL),
  ]).extra()

  await ctx.deleteMessage(chat.message_id)
  await ctx.reply('🚀 Login to IIJmio and paste token here', button)
})

bootstrap.on('message', async (ctx) => {
  const { message_id, text } = ctx.message

  // decompose token
  let userInfo = null
  try {
    let container = null
    try {
      container = JSON.parse(Buffer.from(text, 'base64'))
    } catch (err) {
      throw new Error('Invalid token.')
    }

    let id_token = null
    try {
      id_token = jwt.verify(container.sig, JWT_SECRET)
    } catch (err) {
      throw new Error('Invalid signature.')
    }

    const tokenChallengeIssuedAt = new Date(id_token.iat * 1000)
    console.log(differenceInSeconds(Date.now(), tokenChallengeIssuedAt))
    if (differenceInSeconds(Date.now(), tokenChallengeIssuedAt) > 5 * 60) {
    }

    console.log(id_token, ctx.chat)
    if (id_token.id !== ctx.chat.id) {
      throw new Error('Invalid user id.')
    }

    const tokenExpiresAt = addSeconds(Date.now(), container.exp)

    userInfo = {
      userID: id_token.id,
      username: id_token.username,
      token: container.token,
      tokenExpiresAt,
    }
    ctx.deleteMessage(message_id)
  } catch (err) {
    const button = inlineKeyboard([
      callbackButton('Start over', 'restart'),
      callbackButton('Cancel', 'cancel'),
    ]).extra()
    return ctx.reply(err.message, button)
  }

  // create user
  try {
    const user = await createUser(userInfo)
    console.log(user)
    await ctx.reply(`Setup finished! Welcome, ${ctx.chat.first_name}.`)
    await ctx.reply(`Try /usage`)
    ctx.scene.leave()
  } catch (err) {
    console.log(err)
    ctx.reply('Failed to create user. Try it again.')
    ctx.scene.reenter()
  }
})

bootstrap.action('cancel', (ctx) => ctx.scene.leave())
bootstrap.action('restart', (ctx) => ctx.scene.reenter())

module.exports = bootstrap
