export interface User {
  id: string
  name: string
  originalName?: string
  color?: string
  createdAt: string
}

export interface Expense {
  id: string
  name?: string
  description: string
  amount: number // stored in cents to avoid float issues (e.g., R$ 100,50 = 10050)
  paidBy: string // User.id
  createdAt: string // ISO 8601
  categoryId: string
  debtToUserId?: string // User.id — if set, this is a personal debt (not shared). paidBy paid on behalf of debtToUserId
  updatedAt?: string // ISO 8601
  updatedBy?: string // User.id
  recurrenceGroupId?: string // shared by all copies of a recurring expense; used to detect the group's current months across the year
}

export interface MonthData {
  expenses: Expense[]
}

// months keyed as "01" to "12"
export type YearData = Record<string, MonthData>

export interface AppData {
  version: string
  createdAt: string
  users: User[]
  categories?: { id: string; name: string }[]
  years: Record<string, YearData>
}

// Settlement calculation types
export interface Settlement {
  from: string // user name who owes money
  to: string // user name who should receive
  amount: number // in cents
}

export interface ParticipantSummary {
  userId: string
  userName: string
  paid: number // total paid in cents
  fairShare: number // what they should have paid
  balance: number // paid - fairShare (positive = overpaid, negative = underpaid)
}

export interface MonthSummary {
  totalAmount: number // in cents
  participantCount: number
  fairShare: number // per participant in cents
  participants: ParticipantSummary[]
  settlements: Settlement[]
}
