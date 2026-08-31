import type { Expense } from '@shared/schema'

export interface DuplicateCandidate {
  categoryId: string
  description: string
  amount: number // em centavos
}

/**
 * Normaliza a descrição para comparação, de forma agressiva: ignora
 * maiúsculas/minúsculas, remove acentos (a pessoa pode digitar sem) e remove
 * todos os espaços, inclusive os internos.
 *
 * "Condomínio Mensal", "CONDOMINIO mensal" e " condomíniomensal " viram todos
 * "condominiomensal".
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD') // separa a letra do acento
    .replace(/[\u0300-\u036f]/g, '') // descarta os acentos (inclusive a cedilha)
    .replace(/\s+/g, '') // remove todos os espaços
    .toLowerCase()
}

/**
 * Despesas de `existing` (as do mês/ano de destino) que são possivelmente
 * duplicatas do lançamento candidato: mesma categoria, mesma descrição
 * normalizada e mesmo valor em centavos.
 *
 * `ignoreId` exclui a própria despesa durante a edição.
 */
export function findDuplicateExpenses(
  candidate: DuplicateCandidate,
  existing: Expense[],
  ignoreId?: string
): Expense[] {
  const target = normalizeText(candidate.description)
  return existing.filter(
    (e) =>
      e.id !== ignoreId &&
      e.categoryId === candidate.categoryId &&
      e.amount === candidate.amount &&
      normalizeText(e.description) === target
  )
}
