const { lastDayOfMonth, differenceInDays } = require('date-fns')

function remainingDays() {
  const now = new Date()
  const last = lastDayOfMonth(now)
  const remaining = differenceInDays(last, now) + 2
  return remaining
}

module.exports = {
  remainingDays,
}
