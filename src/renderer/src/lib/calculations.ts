import type { MonthData, MonthSummary, ParticipantSummary, Settlement, User } from '@shared/schema'

export function calculateSettlements(monthData: MonthData, users: User[]): MonthSummary {
  // 1. Map userId → User for quick lookup
  const userMap = new Map(users.map((u) => [u.id, u]))

  // 2. Aggregate payments per userId (only participants who paid at least once)
  const paid = new Map<string, number>()
  for (const expense of monthData.expenses) {
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amount)
  }

  const participantIds = Array.from(paid.keys())
  const participantCount = participantIds.length

  if (participantCount === 0) {
    return {
      totalAmount: 0,
      participantCount: 0,
      fairShare: 0,
      participants: [],
      settlements: []
    }
  }

  // 3. Calculate total and fair share
  const totalAmount = Array.from(paid.values()).reduce((sum, v) => sum + v, 0)
  const fairShare = Math.round(totalAmount / participantCount)

  // 4. Build participant summaries with balance
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
  // Debtors: balance < 0 (paid less than fair share)
  // Creditors: balance > 0 (paid more than fair share)
  const debtors = participants
    .filter((p) => p.balance < 0)
    .map((p) => ({ name: p.userName, amount: -p.balance })) // amount is positive
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

  return {
    totalAmount,
    participantCount,
    fairShare,
    participants,
    settlements
  }
}
