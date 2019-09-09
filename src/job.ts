import assert from 'assert'
import Telegraf from 'telegraf'
import { startOfToday } from 'date-fns'

import { calcDataCap, getDataUsage, setCouponUseStatus } from './core/mio'
import {
  getAllUsers,
  closeConnection,
  User,
  UserDocument,
} from './core/database'

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

async function check(user: UserDocument) {
  // check interval
  if (isTooManyRequest(user.lastCheck)) {
    throw new Error('too many request')
  }
  user.lastCheck = new Date()
  await user.save()

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
    console.log('refresh datacap')
    user.dataCap = await calcDataCap(user.token)
    user.lastUpdate = new Date()
    await user.save()

    await setCouponUseStatus(true, {
      token: user.token,
      serviceCode: user.serviceCode,
    })

    await sendMessage(
      user.userID,
      `次の日になりました。本日の残量は ${user.dataCap} MBです`
    )
  }
}

async function handler() {
  const users = await getAllUsers()

  let hasError = false
  for (const user of users) {
    try {
      await check(user)
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
