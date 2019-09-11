import Telegraf from 'telegraf'
import Stage from 'telegraf/stage'
import { inlineKeyboard, callbackButton } from 'telegraf/markup'
import RedisSession from 'telegraf-session-redis'
import { Context } from 'telegraf'

import { setCouponUseStatus } from '../core/mio'
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
/coupon - クーポンスイッチ
/autoswitch - 自動スイッチ設定
/help - ヘルプの表示
/bye - Botの無効化
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
    const user = await getUser(ctx)
    const { reply } = ctx

    if (user) {
      const { dataCap, remainingCoupon, isCoupon, usage } = user
      await reply(
        `本日の使用量: ${usage} MB / ${dataCap} MB
今月の残量: ${remainingCoupon} MB`
      )
      if (isCoupon) {
        await reply(
          `エコモード突入まで残り ${Math.max(0, dataCap - usage)} MBです`
        )
      } else {
        await reply(`現在エコモードになっています`)
      }
    } else {
      reply('まずは /start してセットアップしましょう')
    }
  })

  // coupon switch
  bot.command('coupon', async (ctx) => {
    const { isCoupon } = await getUser(ctx)
    const { reply } = ctx

    const panel = inlineKeyboard([
      callbackButton('ON', 'couponOn'),
      callbackButton('OFF', 'couponOff'),
    ]).extra()
    await reply(`クーポンスイッチ: ${isCoupon ? 'ON' : 'OFF'}`, panel)
  })

  // enable coupon
  bot.action('couponOn', async (ctx) => {
    const user = await getUser(ctx)
    const { reply } = ctx

    await setCouponUseStatus(true, {
      serviceCode: user.serviceCode,
      token: user.token,
    })
    await user.updateOne({ isCoupon: true })
    await reply(`クーポンスイッチをオンにしました`)
  })

  // disable coupon
  bot.action('couponOff', async (ctx) => {
    const user = await getUser(ctx)
    const { reply } = ctx

    await setCouponUseStatus(false, {
      serviceCode: user.serviceCode,
      token: user.token,
    })
    await user.updateOne({ isCoupon: false })
    await reply(`クーポンスイッチをオフにしました`)
  })

  // auto switch config
  bot.command('autoswitch', async (ctx) => {
    const { autoSwitch } = await getUser(ctx)
    const { reply } = ctx

    const panel = inlineKeyboard([
      callbackButton('ON', 'autoSwitchOn'),
      callbackButton('OFF', 'autoSwitchOff'),
    ]).extra()
    await reply(`自動スイッチ: ${autoSwitch ? 'ON' : 'OFF'}`, panel)
  })

  // enable autoSwitch
  bot.action('autoSwitchOn', async (ctx) => {
    const user = await getUser(ctx)
    const { reply } = ctx

    await user.updateOne({ autoSwitch: true })
    await reply(
      `自動スイッチをオンにしました。クーポンスイッチは自動で操作されます`
    )
  })

  // disable autoSwitch
  bot.action('autoSwitchOff', async (ctx) => {
    const user = await getUser(ctx)
    const { reply } = ctx

    await user.updateOne({ autoSwitch: false })
    await reply(
      `自動スイッチをオフにしました。クーポンスイッチは自動で操作されません`
    )
  })

  // deactivate account
  bot.command('bye', async (ctx) => {
    const { reply } = ctx

    await reply(`データの紐付けを解消します`)

    const user = await getUser(ctx)
    await user.remove()

    await reply(`完了しました。さようなら！ /start で再開できます`)
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
