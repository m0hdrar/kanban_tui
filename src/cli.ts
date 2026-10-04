/**
 * Non-interactive commands, so scripts and coding agents can read and change
 * the board while it is open in another pane.
 */
import { statusLine, type Board, type Card, type ColumnId, type Priority } from "./board"

export const USAGE = `usage:
  kanban-tui                                          open the board
  kanban-tui add <title> [--priority high|medium|low] add a card to To-do; prints its id
  kanban-tui list [--all]                             To-do and In Progress cards (--all adds Done)
  kanban-tui move <id> todo|progress|done             move a card
  kanban-tui rm <id>                                  delete a card
  kanban-tui status                                   one line for status bars

  kanban-tui projects                                 every project with its card counts
  kanban-tui project add <name>                       create a project (doesn't open it)
  kanban-tui project open <name>                      open a project on the board
  kanban-tui project rename <name> <new name>         rename a project (quote names with spaces)
  kanban-tui project rm <name>                        delete a project and all its cards

Card commands work on the project open on the board; add --project <name>
to use another one without switching the board (add creates it if needed).`

const COLUMNS: readonly ColumnId[] = ["todo", "progress", "done"]
const PRIORITIES: readonly Priority[] = ["high", "medium", "low"]

function oneOf<T extends string>(value: string | undefined, options: readonly T[], what: string): T {
  if (options.includes(value as T)) return value as T
  throw new Error(`${what} must be one of: ${options.join(", ")}`)
}

function find(board: Board, id: string | undefined): Card {
  const card = board.cards.find((c) => c.id.toLowerCase() === id?.toLowerCase())
  if (!card) throw new Error(`no card ${id ?? ""}; run \`kanban-tui list --all\` to see ids`)
  return card
}

function findProject(board: Board, name: string | undefined): string {
  const match = board.projects.find((p) => p.toLowerCase() === name?.trim().toLowerCase())
  if (!match) throw new Error(`no project "${name ?? ""}"; run \`kanban-tui projects\` to see them`)
  return match
}

function projectCommand(board: Board, [action, ...args]: string[]): string {
  switch (action) {
    case "add":
      return `added project "${board.addProject(args.join(" "))}"`
    case "open": {
      const name = findProject(board, args.join(" "))
      board.openProject(name)
      return `opened "${name}"`
    }
    case "rename": {
      const from = findProject(board, args[0])
      return `renamed "${from}" to "${board.renameProject(from, args.slice(1).join(" "))}"`
    }
    case "rm": {
      const name = findProject(board, args.join(" "))
      const removed = board.deleteProject(name)
      return `deleted project "${name}" and its ${removed} card${removed === 1 ? "" : "s"}`
    }
    default:
      throw new Error(`project needs add, open, rename or rm\n${USAGE}`)
  }
}

/** Runs one command and returns what to print. Throws with a message on bad input. */
export function runCommand(board: Board, argv: string[]): string {
  const [command, ...args] = argv
  const flag = args.indexOf("--project")
  if (flag >= 0) {
    const name = args.splice(flag, 2)[1]
    if (!name?.trim()) throw new Error("--project needs a name")
    const existing = board.projects.find((p) => p.toLowerCase() === name.trim().toLowerCase())
    board.useProject(existing ?? (command === "add" ? name : findProject(board, name)))
  }

  switch (command) {
    case "projects": {
      const count = (name: string, column: ColumnId) =>
        board.cards.filter((card) => card.project === name && card.column === column).length
      return board.projects
        .map((name) =>
          [
            name,
            `${count(name, "todo")} to-do`,
            `${count(name, "progress")} doing`,
            `${count(name, "done")} done`,
            ...(name === board.project ? ["open"] : []),
          ].join("\t"),
        )
        .join("\n")
    }

    case "project":
      return projectCommand(board, args)

    case "status":
      return statusLine(board.counts())

    case "add": {
      let priority: Priority = "medium"
      const flag = args.indexOf("--priority")
      if (flag >= 0) priority = oneOf(args.splice(flag, 2)[1], PRIORITIES, "priority")
      const title = args.join(" ").trim()
      if (!title) throw new Error("add needs a title")
      return board.create(title, { priority }).id
    }

    case "list": {
      const columns = args.includes("--all") ? COLUMNS : COLUMNS.slice(0, 2)
      return columns
        .flatMap((column) => board.inColumn(column))
        .map((card) => `${card.id}\t${card.column}\t${card.priority}\t${card.title}`)
        .join("\n")
    }

    case "move": {
      const card = find(board, args[0])
      const column = oneOf(args[1], COLUMNS, "column")
      board.move(card, column)
      return `${card.id} → ${column}`
    }

    case "rm": {
      const card = find(board, args[0])
      board.remove(card)
      return `${card.id} deleted`
    }

    case "help":
    case "--help":
    case "-h":
      return USAGE

    default:
      throw new Error(`unknown command: ${command}\n${USAGE}`)
  }
}
