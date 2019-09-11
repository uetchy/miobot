import assert from 'assert'
import Telegraf from 'telegraf'
import { startOfToday } from 'date-fns'

import * as mio from './core/mio'
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
  const { token } = user

  // check interval
  if (isTooManyRequest(user.lastCheck)) {
    throw new Error('too many request')
  }

  user.lastCheck = new Date()

  const { usage, serviceCode } = await mio.getDataUsage(token)
  user.usage = usage
  user.serviceCode = serviceCode

  const { remainingCoupon, isCoupon } = await mio.getAvailableCoupon(token)
  user.remainingCoupon = remainingCoupon
  user.isCoupon = isCoupon

  // check if data usage exceed maximum data cap
  if (usage > user.dataCap) {
    // switch coupon and notify only if coupon switch is enabled
    if (user.isCoupon) {
      console.log('eco on')
      await mio.setCouponUseStatus(false, {
        token: token,
        serviceCode: user.serviceCode,
      })
      user.isCoupon = false

      sendMessage(
        user.userID,
        `エコモードを有効にしました☘️ 現時点での使用量は ${usage} MB / ${user.dataCap} MBです`
      )
    }
  }

  // recalc data caps and notify new value every day
  const sot = startOfToday()
  console.log('sot Locale', sot.toLocaleString())
  console.log('now Locale', new Date().toLocaleString())
  console.log('lastUpdate Locale', user.lastUpdate.toLocaleString())
  console.log(
    'sot - lastUpdate in hours',
    (sot.getTime() - user.lastUpdate.getTime()) / 1000 / 60 / 60
  )

  if (sot > user.lastUpdate) {
    console.log('new day coming')
    const newDataCap = mio.calcDataCap(remainingCoupon)
    user.dataCap = newDataCap
    user.lastUpdate = new Date()

    await sendMessage(
      user.userID,
      `次の日になりました。昨日の使用実績は ${user.usage} MBです。本日の残量は ${newDataCap} MBです`
    )

    if (!isCoupon) {
      if (user.autoSwitch) {
        console.log('eco off')
        await mio.setCouponUseStatus(true, {
          token,
          serviceCode,
        })
        user.isCoupon = true

        sendMessage(user.userID, `エコモードをOFFにしました`)
      } else {
        user.isCoupon = false

        sendMessage(
          user.userID,
          `自動スイッチが無効化されているため、エコモードを継続します`
        )
      }
    }
  }

  await user.save()
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
