const assert = require('assert')
const Telegraf = require('telegraf')
const { startOfToday } = require('date-fns')
const { getAvailableCoupon } = require('./core/mio')

const { calcDataCap, getDataUsage, setCouponUseStatus } = require('./core/mio')
const { getAllUsers, closeConnection } = require('./core/database')

const CHECK_THRESHOLD_IN_SECONDS = 60
const BOT_TOKEN = process.env.BOT_TOKEN
assert(BOT_TOKEN, 'BOT_TOKEN is missing')

function sendMessage(userID, message) {
  const app = new Telegraf(BOT_TOKEN)
  return app.telegram.sendMessage(userID, message)
}

function isTooManyRequest(lastCheck) {
  const lastCheckInSeconds = Math.floor((Date.now() - lastCheck) / 1000)
  return lastCheckInSeconds < CHECK_THRESHOLD_IN_SECONDS
}

async function check(user) {
  // check interval
  if (isTooManyRequest(user.lastCheck)) {
    throw new Error('too many request')
  }
  user.lastCheck = Date.now()
  await user.save()

  // check if data usage exceed maximum data cap
  const { usage, serviceCode } = await getDataUsage(user.token)
  if (usage > user.dataCap) {
    // enable eco mode
    const { couponUse } = await getAvailableCoupon(user.token)
    console.log('couponUse', couponUse)

    // switch coupon and notify only if coupon switch is enabled
    if (couponUse) {
      await setCouponUseStatus(false, {
        token: user.token,
        serviceCode,
      })
      await sendMessage(
        user.userID,
        `エコモードを有効にしました☘️ 現時点での使用量は ${usage} MBです`
      )
    }
  }

  // recalc data caps and notify new value every day
  if (startOfToday() > user.lastUpdate || !user.dataCap) {
    console.log('refresh datacap')
    user.dataCap = await calcDataCap(user.token)
    user.lastUpdate = Date.now()
    await user.save()

    await setCouponUseStatus(true, {
      token: user.token,
      serviceCode,
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
