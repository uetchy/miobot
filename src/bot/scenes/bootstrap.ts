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
const CHALLENGE_EXPIRES_IN = 3 * 60

const JWT_SECRET = process.env.JWT_SECRET!
const MIO_CALLBACK_URL = process.env.MIO_CALLBACK_URL!
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

  const { token, sig, exp } = container

  let id_token: JwtToken | null = null
  try {
    id_token = jwt.verify(sig, JWT_SECRET) as JwtToken
  } catch (err) {
    throw new Error('不正な署名です😭')
  }

  const { id, username, iat } = id_token

  const tokenChallengeIssuedAt = new Date(iat * 1000)
  console.log(differenceInSeconds(Date.now(), tokenChallengeIssuedAt))
  if (
    differenceInSeconds(Date.now(), tokenChallengeIssuedAt) >
    CHALLENGE_EXPIRES_IN
  ) {
    throw new Error('トークンの有効期限が切れています😭')
  }

  if (id !== userID) {
    throw new Error('不正なユーザーIDです😭')
  }

  const tokenExpiresAt = addSeconds(Date.now(), exp)
  const { usage, serviceCode } = await getDataUsage(token)
  const { isCoupon, remainingCoupon } = await getAvailableCoupon(token)
  const dataCap = calcDataCap(remainingCoupon)

  return {
    userID,
    token,
    username,
    tokenExpiresAt,
    serviceCode,
    isCoupon,
    remainingCoupon,
    dataCap,
    usage,
    autoSwitch: true,
    lastCheck: new Date(),
    lastUpdate: new Date(),
  }
}

const bootstrap = new Scene('bootstrap')

bootstrap.enter(async (ctx: Context) => {
  ctx.webhookReply = false
  const { reply } = ctx
  const { id, first_name } = ctx.chat

  const state = jwt.sign({ id: id, username: first_name }, JWT_SECRET)
  const authURL = getAuthorizeURL(MIO_CALLBACK_URL, state)
  const panel = inlineKeyboard([
    urlButton('ログイン', authURL),
    callbackButton('中止', 'cancel'),
  ]).extra()

  await reply(
    'IIJmioにログインして、手に入れたトークンをここに貼り付けてください',
    panel
  )
})

bootstrap.on('message', async (ctx: Context) => {
  const { reply, deleteMessage, scene, message, chat } = ctx
  const { message_id, text } = message
  const { id } = chat

  try {
    // verify token
    let userInfo: User | null = null
    try {
      userInfo = (await verifyToken(text, id)) as User
      await deleteMessage(message_id)
    } catch (err) {
      throw new Error(err.message)
    }

    // reset user data
    try {
      const user = await getUser(id)
      if (user) {
        await user.remove()
      }
    } catch (err) {
      throw new Error(`ユーザーデータの初期化に失敗しました😭`)
    }

    // create user
    try {
      await createUser(userInfo)
      await reply(`こんにちは、${userInfo.username}`)
      await reply(
        `まずは /usage コマンドを試してください。 /help でヘルプを表示します`
      )
      return scene.leave()
    } catch (err) {
      console.log(err)
      throw new Error(`ユーザー作成に失敗しました😭`)
    }
  } catch (err) {
    await reply(err.message)
    return scene.reenter()
  }
})

bootstrap.action('cancel', async (ctx: Context) => {
  await ctx.reply(`セットアップモードを終了します`)
  await ctx.scene.leave()
})
bootstrap.action('restart', (ctx: Context) => ctx.scene.reenter())

export default bootstrap
