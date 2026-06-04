import type { MonthData, MonthSummary, ParticipantSummary, Settlement, User } from '@shared/schema'

export function calculateSettlements(monthData: MonthData, users: User[]): MonthSummary {
  // 1. Map userId → User for quick lookup
  const userMap = new Map(users.map((u) => [u.id, u]))

  // Separate shared expenses from personal debts
  const sharedExpenses = monthData.expenses.filter((e) => !e.debtToUserId)
  const debtExpenses = monthData.expenses.filter((e) => !!e.debtToUserId)

  // 2. Aggregate payments per userId (only shared expenses count towards fair share initially)
  const paid = new Map<string, number>()
  for (const expense of sharedExpenses) {
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amount)
  }

  const participantIds = Array.from(paid.keys())
  const participantCount = participantIds.length

  if (participantCount === 0 && debtExpenses.length === 0) {
    return {
      totalAmount: 0,
      participantCount: 0,
      fairShare: 0,
      participants: [],
      settlements: []
    }
  }

  // 3. Calculate total and fair share (shared expenses only)
  const totalShared = Array.from(paid.values()).reduce((sum, v) => sum + v, 0)
  const fairShare = participantCount > 0 ? Math.round(totalShared / participantCount) : 0

  // 4. Calculate Net Balances per user
  // We start with (What they paid for shared) - (Fair share)
  const netBalances = new Map<string, number>()

  // Initialize with users who participated in shared expenses or all users if needed
  // To be safe, let's consider all users mentioned in any expense
  const allInvolvedUserIds = new Set([
    ...participantIds,
    ...debtExpenses.map((e) => e.paidBy),
    ...debtExpenses.map((e) => e.debtToUserId!)
  ])

  for (const userId of allInvolvedUserIds) {
    const userPaidShared = paid.get(userId) ?? 0
    // Only users who are part of the shared pool get a fairShare deduction
    const userFairShare = participantIds.includes(userId) ? fairShare : 0
    netBalances.set(userId, userPaidShared - userFairShare)
  }

  // 5. Adjust net balances with Personal Debts (Value Extra)
  // If A paid for B, then A's balance increases (creditor) and B's balance decreases (debtor)
  for (const expense of debtExpenses) {
    const creditorId = expense.paidBy
    const debtorId = expense.debtToUserId!

    netBalances.set(creditorId, (netBalances.get(creditorId) ?? 0) + expense.amount)
    netBalances.set(debtorId, (netBalances.get(debtorId) ?? 0) - expense.amount)
  }

  // 6. Build participant summaries for display
  const participants: ParticipantSummary[] = Array.from(netBalances.entries()).map(
    ([userId, balance]) => {
      return {
        userId,
        userName: userMap.get(userId)?.name ?? 'Desconhecido',
        paid:
          (paid.get(userId) ?? 0) +
          debtExpenses.filter((e) => e.paidBy === userId).reduce((s, e) => s + e.amount, 0),
        fairShare: participantIds.includes(userId) ? fairShare : 0,
        balance
      }
    }
  )

  // 7. Greedy minimum-transfer settlement algorithm using the consolidated net balances
  const debtors = participants
    .filter((p) => p.balance < 0)
    .map((p) => ({ name: p.userName, amount: -p.balance }))
  const creditors = participants
    .filter((p) => p.balance > 0)
    .map((p) => ({ name: p.userName, amount: p.balance }))

  const settlements: Settlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const transfer = Math.min(debtor.amount, creditor.amount)

    if (transfer > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: transfer
      })
    }

    debtor.amount -= transfer
    creditor.amount -= transfer

    if (debtor.amount === 0) i++
    if (creditor.amount === 0) j++
  }

  // Total amount includes everything for display
  const totalAmount = totalShared + debtExpenses.reduce((sum, e) => sum + e.amount, 0)

  return {
    totalAmount,
    participantCount,
    fairShare,
    participants,
    settlements
  }
}
