import Scene from 'telegraf/scenes/base'
import {
  inlineKeyboard,
  keyboard,
  callbackButton,
  removeKeyboard,
} from 'telegraf/markup'
import { Context } from 'telegraf'

import { getUser } from '../../core/util'

const settings = new Scene('settings')

async function init(ctx: Context) {
  const { reply } = ctx

  const panel = keyboard(['自動スイッチ', '全データ削除', 'もどる'])
    .oneTime()
    .resize()
    .extra()

  await reply('設定です', panel)
}

settings.enter(async (ctx: Context) => {
  await init(ctx)
})

// auto switch config
settings.hears('自動スイッチ', async (ctx: Context) => {
  const { autoSwitch } = await getUser(ctx)
  const { reply } = ctx

  const panel = inlineKeyboard([
    callbackButton('ON', 'autoSwitchOn'),
    callbackButton('OFF', 'autoSwitchOff'),
  ]).extra()
  await reply(`自動スイッチ: ${autoSwitch ? 'ON' : 'OFF'}`, panel)
})

// enable autoSwitch
settings.action('autoSwitchOn', async (ctx: Context) => {
  const user = await getUser(ctx)
  const { reply } = ctx

  await user.updateOne({ autoSwitch: true })
  await reply(
    `自動スイッチをオンにしました。クーポンスイッチは自動で操作されます`
  )
})

// disable autoSwitch
settings.action('autoSwitchOff', async (ctx: Context) => {
  const user = await getUser(ctx)
  const { reply } = ctx

  await user.updateOne({ autoSwitch: false })
  await reply(
    `自動スイッチをオフにしました。クーポンスイッチは自動で操作されません`
  )
})

// deactivate account
settings.hears('全データ削除', async (ctx: Context) => {
  const { reply } = ctx

  await reply(`データの紐付けを解消します`)

  const user = await getUser(ctx)
  await user.remove()

  await reply(`完了しました。さようなら！ /start で再開できます`)
  await ctx.scene.leave()
})

settings.hears('もどる', async (ctx: Context) => ctx.scene.leave())

settings.leave(async (ctx: Context) => {
  await ctx.reply(`設定を終了します`, removeKeyboard().extra())
})

settings.on('message', (ctx: Context) => init(ctx))

export default settings
