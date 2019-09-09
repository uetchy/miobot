import assert from 'assert'
import fetch from 'node-fetch'
import { format } from 'date-fns'
import { remainingDays } from './date'

const MIO_DEVELOPER_ID = process.env.MIO_DEVELOPER_ID!
assert(MIO_DEVELOPER_ID, 'MIO_DEVELOPER_ID is missing')

export function getAuthorizeURL(redirectURI: string, state: string = '1') {
  return `https://api.iijmio.jp/mobile/d/v1/authorization?response_type=token&client_id=${encodeURIComponent(
    MIO_DEVELOPER_ID
  )}&state=${state}&redirect_uri=${encodeURIComponent(redirectURI)}`
}

export async function getDataUsage(token: string) {
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

export async function getAvailableCoupon(token: string) {
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
    .filter(
      (coupon: { expire: string }) => parseInt(coupon.expire) >= currentMonth
    )
    .reduce((sum: number, cur: { volume: number }) => sum + cur.volume, 0)

  const couponUse = response.couponInfo[0].hdoInfo[0].couponUse

  return { remainingCoupon, isCoupon: couponUse }
}

export async function setCouponUseStatus(
  couponUse: boolean,
  { serviceCode, token }: { serviceCode: string; token: string }
) {
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

export async function calcDataCap(token: string) {
  const { remainingCoupon } = await getAvailableCoupon(token)
  const remaining = remainingDays()
  const dataMbPerDay = Math.floor(remainingCoupon / remaining)
  return dataMbPerDay
}
