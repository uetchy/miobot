import Telegraf from 'telegraf'
import Stage from 'telegraf/stage'
import { inlineKeyboard, callbackButton } from 'telegraf/markup'
import RedisSession from 'telegraf-session-redis'

import { setCouponUseStatus } from '../core/mio'
import { getUser, formatMb } from '../core/util'

import bootstrapScene from './scenes/bootstrap'
import settingsScene from './scenes/settings'

interface BotOption {
  port: number | string
  apiSecret: string
  botToken: string
  webhookURL: string
  redisURL: string
}

const HELP = `
/usage - データ使用量の確認
/coupon - クーポンスイッチ
/settings - 設定
/help - ヘルプの表示
/start - IIJmioアカウントに接続
`

function createBot(options: BotOption) {
  // create scene manager
  const stage = new Stage()

  stage.command('cancel', Stage.leave())
  stage.register(bootstrapScene)
  stage.register(settingsScene)

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

  bot.command('settings', (ctx) => ctx.scene.enter('settings'))

  // show usage
  bot.command('usage', async (ctx) => {
    const { reply, replyWithMarkdown } = ctx
    const user = await getUser(ctx)
    const { dataCap, remainingCoupon, isCoupon, usage } = user

    await replyWithMarkdown(
      `本日の使用量: ${formatMb(usage)} / ${formatMb(dataCap)}
今月の残量: ${formatMb(remainingCoupon)}`
    )
    if (isCoupon) {
      await replyWithMarkdown(
        `エコモード突入まで残り *${formatMb(
          Math.max(0, dataCap - usage)
        )}* です`
      )
    } else {
      await reply(`現在エコモードになっています`)
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

  // show help
  bot.on('message', ({ reply }) => reply(HELP))

  // show help
  bot.help(({ reply }) => reply(HELP))

  // export webhook handler
  bot.telegram.setWebhook(`${options.webhookURL}/bot${options.apiSecret}`)

  return bot.webhookCallback(`/bot${options.apiSecret}`, null, options.port)
}

export default createBot
