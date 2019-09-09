const { inlineKeyboard, urlButton, callbackButton } = require('telegraf/markup')
const jwt = require('jsonwebtoken')
const Scene = require('telegraf/scenes/base')
const addSeconds = require('date-fns/addSeconds')
const differenceInSeconds = require('date-fns/differenceInSeconds')
const assert = require('assert')

const { getAuthorizeURL, calcDataCap } = require('../../core/mio')
const { createUser, getUser } = require('../../core/database')

const JWT_SECRET = process.env.JWT_SECRET
const MIO_CALLBACK_URL = process.env.MIO_CALLBACK_URL
assert(JWT_SECRET, 'JWT_SECRET not specified')
assert(MIO_CALLBACK_URL, 'MIO_CALLBACK_URL not specified')

// boostrap
const bootstrap = new Scene('bootstrap')
bootstrap.enter(async (ctx) => {
  ctx.webhookReply = false
  const { id, first_name } = ctx.chat

  const state = jwt.sign({ id: id, username: first_name }, JWT_SECRET)
  const authURL = getAuthorizeURL(MIO_CALLBACK_URL, state)
  const button = inlineKeyboard([
    urlButton('IIJmioにログインする', authURL),
  ]).extra()

  await ctx.reply(
    'IIJmioにログインして、手に入れたトークンをここに貼り付けてください',
    button
  )
})

bootstrap.on('message', async (ctx) => {
  const { message_id, text } = ctx.message
  const chatID = ctx.chat.id

  // decompose token
  let userInfo = null
  try {
    let container = null
    try {
      container = JSON.parse(Buffer.from(text, 'base64'))
    } catch (err) {
      throw new Error('不正なトークン形式です😭')
    }

    let id_token = null
    try {
      id_token = jwt.verify(container.sig, JWT_SECRET)
    } catch (err) {
      throw new Error('不正な署名です😭')
    }

    const tokenChallengeIssuedAt = new Date(id_token.iat * 1000)
    console.log(differenceInSeconds(Date.now(), tokenChallengeIssuedAt))
    if (differenceInSeconds(Date.now(), tokenChallengeIssuedAt) > 5 * 60) {
    }

    if (id_token.id !== chatID) {
      throw new Error('不正なユーザーIDです😭')
    }

    const tokenExpiresAt = addSeconds(Date.now(), container.exp)

    userInfo = {
      userID: id_token.id,
      username: id_token.username,
      token: container.token,
      tokenExpiresAt,
      dataCap: await calcDataCap(container.token),
    }

    await ctx.deleteMessage(message_id)
  } catch (err) {
    const button = inlineKeyboard([
      callbackButton('やり直す', 'restart'),
      callbackButton('やめる', 'cancel'),
    ]).extra()
    return ctx.reply(err.message, button)
  }

  // reset user data for second time signup
  try {
    const user = await getUser(chatID)
    if (user) {
      await user.remove()
    }
  } catch (err) {
    ctx.reply(`ユーザーデータの初期化に失敗しました😭`)
    return ctx.scene.reenter()
  }

  // create user
  try {
    const user = await createUser(userInfo)
    console.log(user)
    await ctx.reply(`準備完了！`)
    await ctx.reply(`まずは /usage コマンドを試してください`)
    ctx.scene.leave()
  } catch (err) {
    console.log(err)
    ctx.reply(`サインアップに失敗しました😭`)
    return ctx.scene.reenter()
  }
})

bootstrap.leave(({ reply }) => reply(`セットアップモードを終了します`))

bootstrap.action('cancel', (ctx) => ctx.scene.leave())
bootstrap.action('restart', (ctx) => ctx.scene.reenter())

module.exports = bootstrap
