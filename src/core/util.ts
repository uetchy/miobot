import { lastDayOfMonth, differenceInDays } from 'date-fns'
import bytes from 'bytes'
import { Context } from 'telegraf'
import * as database from './database'

export function remainingDays() {
  const now = new Date()
  const last = lastDayOfMonth(now)
  const remaining = differenceInDays(last, now) + 2
  return remaining
}

export function formatMb(dataInMb: number): string {
  return bytes(dataInMb * 1024 * 1024, { unitSeparator: ' ' })
}

export async function getUser(ctx: Context) {
  const user = await database.getUser(ctx.chat.id)
  if (user) {
    return user
  } else {
    throw ctx.reply('まずは /start してセットアップしましょう')
  }
}
