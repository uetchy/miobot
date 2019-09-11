import { lastDayOfMonth, differenceInDays } from 'date-fns'
import bytes from 'bytes'

export function remainingDays() {
  const now = new Date()
  const last = lastDayOfMonth(now)
  const remaining = differenceInDays(last, now) + 2
  return remaining
}

export function formatMb(dataInMb: number): string {
  return bytes(dataInMb * 1024 * 1024, { unitSeparator: ' ' })
}
