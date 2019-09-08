const express = require('express')
const assert = require('assert')
const Telegraf = require('telegraf')
const { startOfToday } = require('date-fns')

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

  // check if today's data usage exceed data cap
  const { usage, serviceCode } = await getDataUsage(user.token)
  if (usage > user.dataCap) {
    // enable eco mode
    console.log('enable eco mode')
    await setCouponUseStatus(false, {
      token: user.token,
      serviceCode,
    })
    await sendMessage(user.userID, `Eco mode is enabled from now on.`)
  }

  // refresh data caps once per day
  if (startOfToday() > user.lastUpdate || !user.dataCap) {
    console.log('refresh datacap')
    user.dataCap = await calcDataCap(user.token)
    user.lastUpdate = Date.now()
    await setCouponUseStatus(true, {
      token: user.token,
      serviceCode,
    })
    await sendMessage(user.userID, `Today's data cap is ${user.dataCap} MB`)
  }

  await user.save()
}

async function handler() {
  const users = await getAllUsers()

  let hasError = false
  for (const user of users) {
    try {
      await check(user)
    } catch (err) {
      console.log(`Error(${user.userID}) ${err.message}`)
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
