const fetch = require('node-fetch')
const { format } = require('date-fns')
const { remainingDays } = require('./date')

const MIO_DEVELOPER_ID = process.env.MIO_DEVELOPER_ID

function getAuthorizeURL(redirectURI, state = 1) {
  return `https://api.iijmio.jp/mobile/d/v1/authorization?response_type=token&client_id=${encodeURIComponent(
    MIO_DEVELOPER_ID
  )}&state=${state}&redirect_uri=${encodeURIComponent(redirectURI)}`
}

async function getDataUsage(token) {
  const response = await fetch(
    'https://api.iijmio.jp/mobile/d/v2/log/packet/',
    {
      headers: {
        'X-IIJmio-Developer': MIO_DEVELOPER_ID,
        'X-IIJmio-Authorization': token,
      },
    }
  ).then((res) => res.json())

  const serviceCode = response.packetLogInfo[0].hdoInfo[0].hdoServiceCode
  const usage = response.packetLogInfo[0].hdoInfo[0].packetLog.slice(-1)[0]
    .withCoupon

  return { serviceCode, usage }
}

async function getAvailableCoupon(token) {
  const response = await fetch('https://api.iijmio.jp/mobile/d/v2/coupon/', {
    headers: {
      'X-IIJmio-Developer': MIO_DEVELOPER_ID,
      'X-IIJmio-Authorization': token,
    },
  }).then((res) => res.json())

  if (response.returnCode !== 'OK') {
    throw new Error(response.returnCode)
  }

  const now = new Date()
  const currentMonth = parseInt(format(now, 'yyyyMM'))
  const remainingCoupon = response.couponInfo[0].coupon
    .filter((coupon) => parseInt(coupon.expire) >= currentMonth)
    .reduce((sum, cur) => sum + cur.volume, 0)

  const couponUse = response.couponInfo[0].hdoInfo[0].couponUse

  return { remainingCoupon, couponUse }
}

async function setCouponUseStatus(couponUse, { serviceCode, token }) {
  const options = {
    couponInfo: [
      {
        hdoInfo: [{ hdoServiceCode: serviceCode, couponUse: couponUse }],
      },
    ],
  }
  const response = await fetch('https://api.iijmio.jp/mobile/d/v2/coupon/', {
    method: 'PUT',
    headers: {
      'X-IIJmio-Developer': MIO_DEVELOPER_ID,
      'X-IIJmio-Authorization': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  }).then((res) => res.json())

  if (response.returnCode !== 'OK') {
    throw new Error(response.returnCode)
  }

  return response
}

async function calcDataCap(mioToken) {
  const { remainingCoupon } = await getAvailableCoupon(mioToken)
  const remaining = remainingDays()
  const dataMbPerDay = Math.floor(remainingCoupon / remaining)
  return dataMbPerDay
}

module.exports = {
  getAuthorizeURL,
  getDataUsage,
  getAvailableCoupon,
  setCouponUseStatus,
  calcDataCap,
}
