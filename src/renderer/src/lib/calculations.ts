import type { MonthData, MonthSummary, ParticipantSummary, Settlement, User } from '@shared/schema'

export function calculateSettlements(monthData: MonthData, users: User[]): MonthSummary {
  // 1. Map userId → User for quick lookup
  const userMap = new Map(users.map((u) => [u.id, u]))

  // Separate shared expenses from personal debts
  const sharedExpenses = monthData.expenses.filter((e) => !e.debtToUserId)
  const debtExpenses = monthData.expenses.filter((e) => !!e.debtToUserId)

  // 2. Aggregate payments per userId (only shared expenses count towards fair share)
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

  // 4. Build participant summaries with balance (shared expenses)
  const participants: ParticipantSummary[] = participantIds.map((userId) => {
    const userPaid = paid.get(userId) ?? 0
    const balance = userPaid - fairShare
    return {
      userId,
      userName: userMap.get(userId)?.name ?? 'Desconhecido',
      paid: userPaid,
      fairShare,
      balance
    }
  })

  // 5. Greedy minimum-transfer settlement algorithm
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

  // 6. Add personal debt settlements (debtToUserId owes paidBy)
  for (const expense of debtExpenses) {
    const debtorName = userMap.get(expense.debtToUserId!)?.name ?? 'Desconhecido'
    const creditorName = userMap.get(expense.paidBy)?.name ?? 'Desconhecido'
    settlements.push({
      from: debtorName,
      to: creditorName,
      amount: expense.amount
    })
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
