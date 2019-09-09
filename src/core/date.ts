import { lastDayOfMonth, differenceInDays } from 'date-fns'

export function remainingDays() {
  const now = new Date()
  const last = lastDayOfMonth(now)
  const remaining = differenceInDays(last, now) + 2
  return remaining
}
