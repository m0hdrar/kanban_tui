/**
 * Domain model for the kanban board: cards, columns and the handful of
 * operations the UI performs on them. Deliberately framework-free so it can be
 * exercised from tests or the headless preview without a renderer.
 */

export type ColumnId = "todo" | "progress" | "done"
export type Priority = "high" | "medium" | "low"

export interface Card {
  /** user-facing id such as `K-04` */
  id: string
  title: string
  column: ColumnId
  priority: Priority
  /** epoch ms the card was created */
  createdAt: number
  /** epoch ms the card last entered its current column */
  movedAt: number
  /** epoch ms the card landed in `done`, if it ever has */
  completedAt?: number
}

export interface Board {
  cards: Card[]
  /** Create a card, appending it to the given column (To-do by default). */
  create(title: string, opts?: { column?: ColumnId; priority?: Priority }): Card
  /** Move a card between columns. Returns true when the column changed. */
  move(card: Card, column: ColumnId): boolean
  remove(card: Card): void
  /** Cards of one column, in display order. */
  inColumn(column: ColumnId): Card[]
  counts(): Record<ColumnId, number>
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

interface SeedCard {
  title: string
  column: ColumnId
  priority: Priority
  /** how long before "now" the card was created */
  createdAgoMs: number
  /** how long before "now" the card entered its current column (defaults to createdAgoMs) */
  columnSinceAgoMs?: number
}

/** A believable sprint, seeded so a fresh board looks alive. */
const SEED: SeedCard[] = [
  // To-do
  { title: "Ship the onboarding checklist", column: "todo", priority: "high", createdAgoMs: 2.4 * HOUR },
  { title: "Fix token refresh race", column: "todo", priority: "high", createdAgoMs: 5 * HOUR },
  { title: "Design empty states", column: "todo", priority: "medium", createdAgoMs: 9 * HOUR },
  { title: "Add CSV export to reports", column: "todo", priority: "low", createdAgoMs: 26 * HOUR },
  // In progress
  {
    title: "Migrate auth to OIDC",
    column: "progress",
    priority: "high",
    createdAgoMs: 30 * HOUR,
    columnSinceAgoMs: 40 * MINUTE,
  },
  {
    title: "Dark-mode contrast audit",
    column: "progress",
    priority: "medium",
    createdAgoMs: 20 * HOUR,
    columnSinceAgoMs: 3 * HOUR,
  },
  {
    title: "Instrument checkout funnel",
    column: "progress",
    priority: "medium",
    createdAgoMs: 12 * HOUR,
    columnSinceAgoMs: 5 * HOUR,
  },
  // Done
  {
    title: "Cut release 1.4.0",
    column: "done",
    priority: "medium",
    createdAgoMs: 28 * HOUR,
    columnSinceAgoMs: 1.5 * HOUR,
  },
  {
    title: "Upgrade CI runners",
    column: "done",
    priority: "low",
    createdAgoMs: 50 * HOUR,
    columnSinceAgoMs: 4 * HOUR,
  },
  {
    title: "Refactor billing webhooks",
    column: "done",
    priority: "high",
    createdAgoMs: 72 * HOUR,
    columnSinceAgoMs: 8 * HOUR,
  },
  {
    title: "Publish API reference",
    column: "done",
    priority: "low",
    createdAgoMs: 80 * HOUR,
    columnSinceAgoMs: 26 * HOUR,
  },
]

export function createBoard(options: { now?: () => number } = {}): Board {
  const time = options.now ?? (() => Date.now())
  const start = time()

  let nextNumber = 1
  const cards: Card[] = []

  const makeId = () => `K-${String(nextNumber++).padStart(2, "0")}`

  for (const seed of SEED) {
    const createdAt = start - seed.createdAgoMs
    const movedAt = start - (seed.columnSinceAgoMs ?? seed.createdAgoMs)
    const card: Card = {
      id: makeId(),
      title: seed.title,
      column: seed.column,
      priority: seed.priority,
      createdAt,
      movedAt,
    }
    if (seed.column === "done") card.completedAt = movedAt
    cards.push(card)
  }

  const board: Board = {
    cards,

    create(title, opts = {}) {
      const at = time()
      const card: Card = {
        id: makeId(),
        title: title.trim(),
        column: opts.column ?? "todo",
        priority: opts.priority ?? "medium",
        createdAt: at,
        movedAt: at,
      }
      cards.push(card)
      return card
    },

    move(card, column) {
      if (card.column === column) return false
      const at = time()
      card.column = column
      card.movedAt = at
      if (column === "done") card.completedAt = at
      else delete card.completedAt
      return true
    },

    remove(card) {
      const index = cards.indexOf(card)
      if (index >= 0) cards.splice(index, 1)
    },

    inColumn(column) {
      const list = cards.filter((card) => card.column === column)
      // Done reads newest-first; the other columns keep their creation order.
      if (column === "done") {
        list.sort((a, b) => (b.completedAt ?? b.movedAt) - (a.completedAt ?? a.movedAt))
      }
      return list
    },

    counts() {
      const out: Record<ColumnId, number> = { todo: 0, progress: 0, done: 0 }
      for (const card of cards) out[card.column]++
      return out
    },
  }

  return board
}
