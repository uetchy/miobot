import assert from 'assert'
import Telegraf from 'telegraf'
import { startOfToday } from 'date-fns'

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

  if (usage > user.dataCap) {
    // switch coupon and notify only if coupon switch is enabled
    if (user.isCoupon) {
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
  if (startOfToday() > user.lastUpdate) {
    const { remainingCoupon, isCoupon } = await getAvailableCoupon(user.token)
    const newDataCap = calcDataCap(remainingCoupon)

    if (!isCoupon) {
      await setCouponUseStatus(true, {
        token: user.token,
        serviceCode: user.serviceCode,
      })
    }

    await user.updateOne({
      dataCap: newDataCap,
      lastUpdate: new Date(),
      isCoupon: true,
    })

    await sendMessage(
      user.userID,
      `次の日になりました。本日の残量は ${newDataCap} MBです`
    )
  }
}

async function handler() {
  const users = await getAllUsers()

  let hasError = false
  for (const user of users) {
    try {
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
