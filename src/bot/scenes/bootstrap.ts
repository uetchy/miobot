import assert from 'assert'
import jwt from 'jsonwebtoken'
import Scene from 'telegraf/scenes/base'
import { inlineKeyboard, urlButton, callbackButton } from 'telegraf/markup'
import addSeconds from 'date-fns/addSeconds'
import differenceInSeconds from 'date-fns/differenceInSeconds'

import {
  getAuthorizeURL,
  calcDataCap,
  getAvailableCoupon,
  getDataUsage,
} from '../../core/mio'
import { createUser, getUser, User } from '../../core/database'
import { Context } from 'telegraf'

// config vars
const JWT_SECRET = process.env.JWT_SECRET!
const MIO_CALLBACK_URL = process.env.MIO_CALLBACK_URL!
const CHALLENGE_EXPIRES_IN = 3 * 60

assert(JWT_SECRET, 'JWT_SECRET is missing')
assert(MIO_CALLBACK_URL, 'MIO_CALLBACK_URL is missing')

interface TokenContainer {
  token: string
  sig: string
  exp: number
}

interface JwtToken {
  id: number
  username: string
  iat: number
}

async function verifyToken(text: string, userID: number): Promise<User> {
  let container: TokenContainer | null = null
  try {
    container = JSON.parse(
      Buffer.from(text, 'base64').toString()
    ) as TokenContainer
  } catch (err) {
    throw new Error('不正なトークン形式です😭')
  }

  let id_token: JwtToken | null = null
  try {
    id_token = jwt.verify(container.sig, JWT_SECRET) as JwtToken
  } catch (err) {
    throw new Error('不正な署名です😭')
  }

  const tokenChallengeIssuedAt = new Date(id_token.iat * 1000)
  console.log(differenceInSeconds(Date.now(), tokenChallengeIssuedAt))
  if (
    differenceInSeconds(Date.now(), tokenChallengeIssuedAt) >
    CHALLENGE_EXPIRES_IN
  ) {
    throw new Error('トークンの有効期限が切れています😭')
  }

  if (id_token.id !== userID) {
    throw new Error('不正なユーザーIDです😭')
  }

  const tokenExpiresAt = addSeconds(Date.now(), container.exp)
  const { serviceCode } = await getDataUsage(container.token)
  const { isCoupon } = await getAvailableCoupon(container.token)

  return {
    userID: id_token.id,
    username: id_token.username,
    token: container.token,
    tokenExpiresAt,
    serviceCode,
    isCoupon,
    dataCap: await calcDataCap(container.token),
    lastCheck: new Date(),
    lastUpdate: new Date(),
  }
}

const bootstrap = new Scene('bootstrap')

bootstrap.enter(async (ctx: Context) => {
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

bootstrap.on('message', async (ctx: Context) => {
  const { message_id, text } = ctx.message
  const userID = ctx.chat.id

  // verify token
  let userInfo: User | null = null
  try {
    userInfo = (await verifyToken(text, userID)) as User
    await ctx.deleteMessage(message_id)
  } catch (err) {
    const button = inlineKeyboard([
      callbackButton('再発行', 'restart'),
      callbackButton('中止', 'cancel'),
    ]).extra()
    return ctx.reply(err.message, button)
  }

  // reset user data
  try {
    const user = await getUser(userID)
    if (user) {
      await user.remove()
    }
  } catch (err) {
    ctx.reply(`ユーザーデータの初期化に失敗しました😭`)
    return ctx.scene.reenter()
  }

  // create user
  try {
    await createUser(userInfo)
    await ctx.reply(`こんにちは、${userInfo.username}`)
    await ctx.reply(
      `まずは /usage コマンドを試してください。 /help でヘルプを表示します`
    )
    return ctx.scene.leave()
  } catch (err) {
    console.log(err)
    ctx.reply(`サインアップに失敗しました😭`)
    return ctx.scene.reenter()
  }
})

bootstrap.action('cancel', async (ctx: Context) => {
  await ctx.reply(`セットアップモードを終了します`)
  await ctx.scene.leave()
})
bootstrap.action('restart', (ctx: Context) => ctx.scene.reenter())

export default bootstrap
