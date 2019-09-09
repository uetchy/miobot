import Telegraf from 'telegraf'
import Stage from 'telegraf/stage'
import { inlineKeyboard, callbackButton } from 'telegraf/markup'
import RedisSession from 'telegraf-session-redis'
import { Context } from 'telegraf'

import {
  getAvailableCoupon,
  getDataUsage,
  setCouponUseStatus,
} from '../core/mio'
import * as database from '../core/database'

import boostrapScene from './scenes/bootstrap'

async function getUser(ctx: Context) {
  const user = await database.getUser(ctx.chat.id)
  if (user) {
    return user
  } else {
    throw ctx.reply('まずは /start してセットアップしましょう')
  }
}

interface BotOption {
  port: number | string
  apiSecret: string
  botToken: string
  webhookURL: string
  redisURL: string
}

function createBot(options: BotOption) {
  const HELP = `
/usage - データ使用量の確認
/switch - クーポンスイッチ
/help - ヘルプの表示
/deactivate - Botの無効化
/start - Botの有効化
`

  // create scene manager
  const stage = new Stage()

  stage.command('cancel', Stage.leave())
  stage.register(boostrapScene)

  // session
  const session = new RedisSession({
    store: {
      url: options.redisURL,
      host: '',
      port: '',
    },
  })

  // create bot
  const bot = new Telegraf(options.botToken)
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
      const { remainingCoupon, isCoupon } = await getAvailableCoupon(token)
      const { usage } = await getDataUsage(token)

      ctx.deleteMessage(botMessage.message_id)

      await ctx.reply(
        `本日の使用量は ${usage} MBで、データキャップは ${dataCap} MBです。今月の残量は ${remainingCoupon} MB です`
      )
      await ctx.reply(
        `本日は、あと ${Math.max(0, dataCap - usage)} MB 使えます`
      )

      await user.updateOne({ isCoupon })
    } else {
      ctx.deleteMessage(botMessage.message_id)
      ctx.reply('まずは /start してセットアップしましょう')
    }
  })

  // coupon switch
  bot.command('switch', async (ctx) => {
    const { isCoupon } = await getUser(ctx)
    const panel = inlineKeyboard([
      callbackButton('ON', 'couponOn'),
      callbackButton('OFF', 'couponOff'),
    ]).extra()
    await ctx.reply(`クーポンスイッチ ${isCoupon ? 'ON' : 'OFF'}`, panel)
  })

  // enable coupon
  bot.action('couponOn', async (ctx) => {
    const user = await getUser(ctx)
    await setCouponUseStatus(true, {
      serviceCode: user.serviceCode,
      token: user.token,
    })
    await ctx.reply(`クーポンスイッチをオンにしました`)
    await user.updateOne({ isCoupon: true })
  })

  // disable coupon
  bot.action('couponOff', async (ctx) => {
    const user = await getUser(ctx)
    await setCouponUseStatus(false, {
      serviceCode: user.serviceCode,
      token: user.token,
    })
    await ctx.reply(`クーポンスイッチをオフにしました`)
    await user.updateOne({ isCoupon: false })
  })

  // deactivate account
  bot.command('deactivate', async (ctx) => {
    await ctx.reply(`データの紐付けを解消します`)
    const user = await getUser(ctx)
    await user.remove()
    await ctx.reply(`完了しました。さようなら！ /start で再開できます`)
  })

  // show help
  bot.on('message', ({ reply }) => reply(HELP))

  // show help
  bot.help(({ reply }) => reply(HELP))

  // export webhook handler
  bot.telegram.setWebhook(`${options.webhookURL}/bot${options.apiSecret}`)

  return bot.webhookCallback(`/bot${options.apiSecret}`, null, options.port)
}

export default createBot
