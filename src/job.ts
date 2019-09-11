import assert from 'assert'
import Telegraf from 'telegraf'
import { startOfToday, addHours } from 'date-fns'

import {
  calcDataCap,
  getDataUsage,
  setCouponUseStatus,
  getAvailableCoupon,
} from './core/mio'
import { getAllUsers, closeConnection, UserDocument } from './core/database'

const CHECK_THRESHOLD_IN_SECONDS = 60
const BOT_TOKEN = process.env.BOT_TOKEN!
assert(BOT_TOKEN, 'BOT_TOKEN is missing')

function sendMessage(userID: number, message: string) {
  const app = new Telegraf(BOT_TOKEN)
  return app.telegram.sendMessage(userID, message)
}

function isTooManyRequest(lastCheck: Date) {
  const lastCheckInSeconds = Math.floor(
    (Date.now() - lastCheck.getTime()) / 1000
  )
  return lastCheckInSeconds < CHECK_THRESHOLD_IN_SECONDS
}

async function handleUser(user: UserDocument) {
  // check interval
  if (isTooManyRequest(user.lastCheck)) {
    throw new Error('too many request')
  }

  await user.updateOne({
    lastCheck: new Date(),
  })

  // check if data usage exceed maximum data cap
  const { usage } = await getDataUsage(user.token)
  user.usage = usage

  if (usage > user.dataCap) {
    console.log('data exceeded')

    // switch coupon and notify only if coupon switch is enabled
    if (user.isCoupon) {
      console.log('eco on')
      await setCouponUseStatus(false, {
        token: user.token,
        serviceCode: user.serviceCode,
      })

      await sendMessage(
        user.userID,
        `エコモードを有効にしました☘️ 現時点での使用量は ${usage} MBです`
      )
    }
  }

  // recalc data caps and notify new value every day
  const sotUTC = startOfToday()
  const tzOffset = new Date().getTimezoneOffset() / -60
  const sotJST = addHours(sotUTC, tzOffset)

  console.log('TZ', process.env.TZ)
  console.log('offset', tzOffset)
  console.log('sotUTC', sotUTC)
  console.log('sotJST', sotJST)
  console.log('lastUpdate', user.lastUpdate)
  console.log(
    'sotJST - lastUpdate / 1000 / 60',
    (sotJST.getTime() - user.lastUpdate.getTime()) / 1000 / 60
  )
  console.log(
    'sotUTC - lastUpdate / 1000 / 60',
    (sotUTC.getTime() - user.lastUpdate.getTime()) / 1000 / 60
  )

  if (sotUTC > user.lastUpdate) {
    console.log('new day coming')
    const { remainingCoupon, isCoupon } = await getAvailableCoupon(user.token)
    const newDataCap = calcDataCap(remainingCoupon)
    user.dataCap = newDataCap

    await sendMessage(
      user.userID,
      `次の日になりました。昨日の使用実績は ${user.usage} MBです。本日の残量は ${newDataCap} MBです`
    )

    if (!isCoupon && user.autoSwitch) {
      console.log('eco off')
      await setCouponUseStatus(true, {
        token: user.token,
        serviceCode: user.serviceCode,
      })
      await sendMessage(user.userID, `エコモードをOFFにしました`)
      user.isCoupon = true
    } else if (!user.autoSwitch) {
      await sendMessage(
        user.userID,
        `自動スイッチが無効化されているため、エコモードを継続します`
      )
      user.isCoupon = false
    }

    user.lastUpdate = new Date()
    await user.save()
  }
}

async function handler() {
  const users = await getAllUsers()

  let hasError = false
  for (const user of users) {
    try {
      console.log(`Start(${user.username}):`)
      await handleUser(user)
    } catch (err) {
      console.log(`Error(${user.username}):`)
      console.log(err)
      hasError = true
    }
  }

  return hasError
}

handler()
  .catch((err) => {
    console.log(`Worker error: ${err}`)
  })
  .finally(() => closeConnection())
