import Telegraf from 'telegraf'
import Stage from 'telegraf/stage'
import { inlineKeyboard, callbackButton } from 'telegraf/markup'
import RedisSession from 'telegraf-session-redis'
import assert from 'assert'
import { Context } from 'telegraf'

import {
  getAvailableCoupon,
  getDataUsage,
  setCouponUseStatus,
} from '../core/mio'
import * as database from '../core/database'

async function getUser(ctx: Context) {
  const user = await database.getUser(ctx.chat.id)
  if (user) {
    return user
  } else {
    throw ctx.reply('まずは /start してセットアップしましょう')
  }
}

// scenes
import boostrapScene from './scenes/bootstrap'

// config vars
const PORT = process.env.PORT || 3000
const REDISCLOUD_URL = process.env.REDISCLOUD_URL || '127.0.0.1'
const API_SECRET = process.env.API_SECRET!
const JWT_SECRET = process.env.JWT_SECRET!
const BOT_TOKEN = process.env.BOT_TOKEN!
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN!
const HELP = `
/usage - データ使用量の確認
/switch - クーポンスイッチ
/help - ヘルプの表示
/deactivate - Botの無効化
/start - Botの有効化
`

assert(REDISCLOUD_URL, 'REDISCLOUD_URL is missing')
assert(API_SECRET, 'API_SECRET is missing')
assert(JWT_SECRET, 'JWT_SECRET is missing')
assert(BOT_TOKEN, 'BOT_TOKEN is missing')
assert(WEBHOOK_DOMAIN, 'WEBHOOK_DOMAIN is missing')

// create scene manager
const stage = new Stage()

stage.command('cancel', Stage.leave())
stage.register(boostrapScene)

const session = new RedisSession({
  store: {
    url: REDISCLOUD_URL,
    host: '',
    port: '',
  },
})

// create bot
const bot = new Telegraf(BOT_TOKEN)
bot.use(session)
bot.use(stage.middleware())
bot.start(async (ctx) => {
  ctx.scene.enter('bootstrap')
})

// show usage
bot.command('usage', async (ctx) => {
  ctx.webhookReply = false

  const botMessage = await ctx.reply('確認しています🚀')

  const user = await getUser(ctx)
  if (user) {
    const { token, dataCap } = user
    const { remainingCoupon } = await getAvailableCoupon(token)
    const { usage } = await getDataUsage(token)

    ctx.deleteMessage(botMessage.message_id)

    await ctx.reply(
      `本日の使用量は ${usage} MBで、データキャップは ${dataCap} MBです。今月の残量は ${remainingCoupon} MB です`
    )
    await ctx.reply(`本日は、あと ${Math.max(0, dataCap - usage)} MB 使えます`)
  } else {
    ctx.deleteMessage(botMessage.message_id)
    ctx.reply('まずは /start してセットアップしましょう')
  }
})

bot.command('switch', async (ctx) => {
  const { isCoupon } = await getUser(ctx)
  const panel = inlineKeyboard([
    callbackButton('ON', 'couponOn'),
    callbackButton('OFF', 'couponOff'),
  ]).extra()
  await ctx.reply(`エコモード ${isCoupon ? 'OFF' : 'ON'}`, panel)
})

bot.action('couponOn', async (ctx) => {
  const { token, serviceCode } = await getUser(ctx)
  await setCouponUseStatus(true, { serviceCode: serviceCode, token })
  await ctx.reply(`クーポンスイッチをオンにしました`)
})

bot.action('couponOff', async (ctx) => {
  const { token, serviceCode } = await getUser(ctx)
  await setCouponUseStatus(false, { serviceCode: serviceCode, token })
  await ctx.reply(`クーポンスイッチをオフにしました`)
})

bot.command('deactivate', async (ctx) => {
  await ctx.reply(`データの紐付けを解消します`)
  const user = await getUser(ctx)
  await user.remove()
  await ctx.reply(`完了しました。さようなら！ /start で再開できます`)
})

bot.on('message', ({ reply }) => reply(HELP))

// show help
bot.help(({ reply }) => reply(HELP))

// export webhook handler
bot.telegram.setWebhook(`https://${WEBHOOK_DOMAIN}/bot${API_SECRET}`)
export default bot.webhookCallback(`/bot${API_SECRET}`, null, PORT)
