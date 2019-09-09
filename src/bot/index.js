const Telegraf = require('telegraf')
const RedisSession = require('telegraf-session-redis')
const Stage = require('telegraf/stage')
const assert = require('assert')

const { getUser } = require('../core/database')
const { getAvailableCoupon, getDataUsage } = require('../core/mio')

// scenes
const boostrapScene = require('./scenes/bootstrap')

const PORT = process.env.PORT || 3000
const REDISCLOUD_URL = process.env.REDISCLOUD_URL || '127.0.0.1'
const API_SECRET = process.env.API_SECRET
const JWT_SECRET = process.env.JWT_SECRET
const BOT_TOKEN = process.env.BOT_TOKEN
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN
assert(REDISCLOUD_URL, 'REDISCLOUD_URL is missing')
assert(API_SECRET, 'API_SECRET is missing')
assert(JWT_SECRET, 'JWT_SECRET is missing')
assert(BOT_TOKEN, 'BOT_TOKEN is missing')
assert(WEBHOOK_DOMAIN, 'WEBHOOK_DOMAIN is missing')

const HELP = `
/help - このメッセージ
/start - Botの初期セットアップ
/usage - データ使用量の確認
`

// create scene manager
const stage = new Stage()
stage.command('cancel', Stage.leave())
stage.register(boostrapScene)

const session = new RedisSession({
  store: {
    url: REDISCLOUD_URL,
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
  const userID = ctx.message.from.id
  const botMessage = await ctx.reply('🚀')
  const user = await getUser(userID)
  if (user) {
    console.log(user)
    const { remainingCoupon } = await getAvailableCoupon(user.token)
    const { usage } = await getDataUsage(user.token)
    const { dataCap } = user
    ctx.deleteMessage(botMessage.message_id)
    await ctx.reply(
      `本日の使用量は ${usage} MBで、データキャップは ${dataCap} MBです。今月は残り ${remainingCoupon} MB 使えます`
    )
  } else {
    ctx.deleteMessage(botMessage.message_id)
    ctx.reply('まずは /start してセットアップしましょう')
  }
})

bot.on('message', ({ reply }) => reply(HELP))

// show help
bot.help(({ reply }) => reply(HELP))

bot.telegram.setWebhook(`https://${WEBHOOK_DOMAIN}/bot${API_SECRET}`)
module.exports = bot.webhookCallback(`/bot${API_SECRET}`, null, PORT)
