import assert from 'assert'
import Telegraf from 'telegraf'
import { startOfToday } from 'date-fns'

import * as mio from './core/mio'
import { getAllUsers, closeConnection, UserDocument } from './core/database'
import { formatMb } from './core/util'

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
  console.log(`usage: ${usage} for ${serviceCode}`)
  user.usage = usage
  user.serviceCode = serviceCode

  const { remainingCoupon, isCoupon } = await mio.getAvailableCoupon(token)
  user.remainingCoupon = remainingCoupon
  user.isCoupon = isCoupon

  // check if data usage exceed maximum data cap
  // and switch coupon only if coupon switch is enabled
  if (usage > user.dataCap && isCoupon && user.autoSwitch) {
    console.log('eco on')
    await mio.setCouponUseStatus(false, {
      token: token,
      serviceCode: user.serviceCode,
    })
    user.isCoupon = false

    await sendMessage(
      user.userID,
      `エコモードを有効にしました☘️ 現時点での使用量は ${formatMb(
        usage
      )} / ${formatMb(user.dataCap)} です`
    )
  }

  // recalc data caps and notify new value every day
  const sot = startOfToday()
  console.log('sot Locale', sot.toLocaleString())
  console.log('now Locale', new Date().toLocaleString())

  if (sot > user.lastUpdate) {
    console.log('new day coming')
    const newDataCap = mio.calcDataCap(remainingCoupon)
    user.dataCap = newDataCap
    user.lastUpdate = new Date()

    await sendMessage(
      user.userID,
      `次の日になりました。昨日の使用実績は ${formatMb(
        usage
      )} です。本日の残量は ${formatMb(newDataCap)} です`
    )

    if (!isCoupon) {
      if (user.autoSwitch) {
        console.log('eco off')
        await mio.setCouponUseStatus(true, {
          token,
          serviceCode,
        })
        user.isCoupon = true

        await sendMessage(user.userID, `エコモードをOFFにしました`)
      } else {
        user.isCoupon = false

        await sendMessage(
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
      console.log(`Start(${user.userID}):`)
      await handleUser(user)
    } catch (err) {
      console.log(`Error(${user.userID}):`)
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
