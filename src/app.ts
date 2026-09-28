import {
  BoxRenderable,
  InputRenderable,
  ScrollBoxRenderable,
  TextRenderable,
  bold,
  fg,
  italic,
  strikethrough,
  t,
  type CliRenderer,
} from "@opentui/core"
import { type Board, type Card, type ColumnId } from "./board"
import { clamp, formatAge, formatClock, formatDate } from "./format"
import { columnLabel, priorityColor, priorityLabel, theme } from "./theme"
import { joinChunks, keyHints, progressBar } from "./widgets"

/** The subset of a key event the app cares about (easy to fake in previews). */
export interface KeyLike {
  name: string
  ctrl?: boolean
  shift?: boolean
}

export type KeyResult = "handled" | "quit" | "ignored"

export interface KanbanApp {
  root: BoxRenderable
  /** Route a key press. Returns `quit` when the app wants to exit. */
  handleKey(key: KeyLike): KeyResult
  /** Repaint header/footer and, when needed, the board itself. */
  refresh(): void
  destroy(): void

  // Exposed for the headless preview and for future tests.
  focusColumn(delta: number): void
  moveSelection(delta: number): void
  moveSelected(column: ColumnId): void
  deleteSelected(): void
  openComposer(value?: string): void
  closeComposer(): void
  submitComposer(): void
}

interface ColumnView {
  id: ColumnId
  title: string
  accent: string
  empty: string
  hint: string
  panel: BoxRenderable
  scroll: ScrollBoxRenderable
}

const TOAST_MS = 3600
const FLASH_MS = 900
const CARD_ROWS = 2
const CARD_GAP = 1

export function createKanbanApp(
  renderer: CliRenderer,
  board: Board,
  options: { now?: () => number } = {},
): KanbanApp {
  const ctx = renderer
  const now = options.now ?? (() => Date.now())

  // -------------------------------------------------------------------- root
  const root = new BoxRenderable(ctx, {
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: theme.bg,
  })

  // ------------------------------------------------------------------ header
  const tagline = new TextRenderable(ctx, {
    content: t`${fg(theme.textDim)("kanban board")}`,
  })

  const clockLine = new TextRenderable(ctx, { content: t`${fg(theme.textDim)("--:--:--")}` })
  const progressLine = new TextRenderable(ctx, { content: t`${fg(theme.textFaint)("loading…")}` })
  const countsLine = new TextRenderable(ctx, { content: t`` })

  const headerMeta = new BoxRenderable(ctx, {
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "center",
    flexGrow: 1,
  })
  headerMeta.add(clockLine)
  headerMeta.add(progressLine)
  headerMeta.add(countsLine)

  const header = new BoxRenderable(ctx, {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingX: 2,
    paddingY: 1,
    flexShrink: 0,
    border: ["bottom"],
    borderStyle: "single",
    borderColor: theme.borderSoft,
    backgroundColor: theme.panel,
  })
  header.add(tagline)
  header.add(headerMeta)

  // ------------------------------------------------------------------- board
  const boardRow = new BoxRenderable(ctx, {
    id: "board",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    gap: 1,
    padding: 1,
    overflow: "hidden",
  })

  const columnSpecs: Array<Omit<ColumnView, "panel" | "scroll">> = [
    {
      id: "todo",
      title: "TO-DO",
      accent: theme.todo,
      empty: "nothing queued",
      hint: "press n to add a card",
    },
    {
      id: "progress",
      title: "IN PROGRESS",
      accent: theme.progress,
      empty: "nothing in flight",
      hint: "press p on a card",
    },
    {
      id: "done",
      title: "DONE",
      accent: theme.done,
      empty: "nothing shipped yet",
      hint: "press d on a card",
    },
  ]

  const views: ColumnView[] = columnSpecs.map((spec) => {
    const panel = new BoxRenderable(ctx, {
      id: `column-${spec.id}`,
      flexDirection: "column",
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 18,
      border: true,
      borderStyle: "rounded",
      borderColor: theme.borderSoft,
      backgroundColor: theme.panel,
      padding: 1,
      overflow: "hidden",
    })

    const scroll = new ScrollBoxRenderable(ctx, {
      id: `scroll-${spec.id}`,
      flexGrow: 1,
      flexShrink: 1,
      scrollX: false,
      scrollY: true,
      contentOptions: { flexDirection: "column", gap: CARD_GAP, width: "100%" },
      viewportOptions: { width: "100%" },
      verticalScrollbarOptions: {
        trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.accent },
      },
    })

    panel.add(scroll)
    boardRow.add(panel)

    // The board drives its own scrolling (the selection follows the card), so
    // the scrollbar is left out — it keeps the columns calm and symmetric.
    scroll.verticalScrollBar.visible = false
    scroll.horizontalScrollBar.visible = false

    return { ...spec, panel, scroll }
  })

  // ----------------------------------------------------------------- composer
  const composerInput = new InputRenderable(ctx, {
    id: "composer-input",
    placeholder: "what needs doing?",
    backgroundColor: theme.composer,
    focusedBackgroundColor: theme.composer,
    textColor: theme.text,
    focusedTextColor: theme.text,
    placeholderColor: theme.textFaint,
    flexGrow: 1,
  })

  const composerRow = new BoxRenderable(ctx, { flexDirection: "row", gap: 1, paddingX: 1 })
  composerRow.add(new TextRenderable(ctx, { content: t`${fg(theme.accent)("▸")}` }))
  composerRow.add(composerInput)

  const composerHint = new TextRenderable(ctx, {
    content: joinChunks([
      fg(theme.textDim)("enter"),
      fg(theme.textFaint)(" add card to To-do"),
      fg(theme.textFaint)("   ·   "),
      fg(theme.textDim)("esc"),
      fg(theme.textFaint)(" cancel"),
    ]),
  })

  const composer = new BoxRenderable(ctx, {
    id: "composer",
    flexDirection: "column",
    flexShrink: 0,
    marginX: 1,
    marginBottom: 1,
    border: true,
    borderStyle: "rounded",
    borderColor: theme.accent,
    backgroundColor: theme.composer,
    paddingX: 1,
    title: " new card ",
    titleColor: theme.accent,
    visible: false,
  })
  composer.add(composerRow)
  composer.add(composerHint)

  // ------------------------------------------------------------------- footer
  const hints = new TextRenderable(ctx, {
    height: 1,
    wrapMode: "none",
    truncate: true,
    content: keyHints([
      { key: "n", action: "new" },
      { key: "p", action: "progress" },
      { key: "d", action: "done" },
      { key: "t", action: "to-do" },
      { key: "space", action: "priority" },
      { key: "x", action: "delete" },
      { key: "↑↓", action: "card" },
      { key: "←→", action: "column" },
      { key: "q", action: "quit" },
    ]),
  })
  const status = new TextRenderable(ctx, { content: t``, height: 1, wrapMode: "none", truncate: true })

  const footer = new BoxRenderable(ctx, {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    paddingX: 2,
    height: 2,
    flexShrink: 0,
    border: ["top"],
    borderStyle: "single",
    borderColor: theme.borderSoft,
    backgroundColor: theme.panel,
  })
  footer.add(hints)
  footer.add(status)

  root.add(header)
  root.add(boardRow)
  root.add(composer)
  root.add(footer)

  // -------------------------------------------------------------------- state
  const selected: Record<ColumnId, number> = { todo: 0, progress: 0, done: 0 }
  let focusIdx = 0
  let composerOpen = false
  let boardDirty = true

  let toast = ""
  let toastColor: string = theme.textDim
  let toastUntil = 0
  let flashId: string | null = null
  let flashUntil = 0

  let repaintTimer: ReturnType<typeof setTimeout> | undefined
  let repaintAt = 0

  function scheduleRepaint(delay: number) {
    const target = now() + delay
    if (repaintTimer && repaintAt <= target) return
    if (repaintTimer) clearTimeout(repaintTimer)
    repaintAt = target
    repaintTimer = setTimeout(() => {
      repaintTimer = undefined
      repaintAt = 0
      refresh()
    }, delay)
  }

  function setToast(message: string, color: string = theme.textDim, ms = TOAST_MS) {
    toast = message
    toastColor = color
    toastUntil = now() + ms
    scheduleRepaint(ms + 80)
  }

  function activeColumn(): ColumnView {
    return views[focusIdx]!
  }

  // ------------------------------------------------------------------ render
  function refresh() {
    clampSelections()
    if (boardDirty) {
      renderColumns()
      boardDirty = false
    }
    renderHeader()
    renderFooter()
  }

  function clampSelections() {
    for (const view of views) {
      const length = board.inColumn(view.id).length
      selected[view.id] = length === 0 ? 0 : Math.min(selected[view.id], length - 1)
    }
  }

  function renderHeader() {
    const at = now()
    clockLine.content = t`${bold(fg(theme.text)(formatClock(at)))} ${fg(theme.textFaint)("·")} ${fg(
      theme.textDim,
    )(formatDate(at))}`

    const counts = board.counts()
    const total = board.cards.length
    const ratio = total === 0 ? 0 : counts.done / total
    progressLine.content = joinChunks([
      progressBar(ratio, 22, theme.done),
      fg(theme.textDim)(`  ${Math.round(ratio * 100)}%`),
      fg(theme.textFaint)("  shipped"),
    ])
    countsLine.content = t`${fg(theme.textDim)(`${counts.todo} to-do`)} ${fg(theme.textFaint)("·")} ${fg(
      theme.textDim,
    )(`${counts.progress} in progress`)} ${fg(theme.textFaint)("·")} ${fg(theme.textDim)(`${counts.done} done`)}`
  }

  function renderFooter() {
    const text = (() => {
      if (toast && now() < toastUntil) return { content: t`${fg(toastColor)(toast)}` }

      const view = activeColumn()
      const cards = board.inColumn(view.id)
      const card = cards[selected[view.id]]
      if (!card) return { content: t`${fg(theme.textFaint)("empty column")}` }

      return {
        content: t`${fg(theme.textFaint)("selected")} ${fg(theme.textDim)(card.id)} ${fg(theme.textFaint)("·")} ${fg(
          theme.textDim,
        )(`${selected[view.id] + 1} of ${cards.length}`)}`,
      }
    })()
    status.content = text.content
  }

  function renderColumns() {
    views.forEach((view, index) => {
      const focused = index === focusIdx
      const cards = board.inColumn(view.id)

      view.panel.borderColor = focused ? view.accent : theme.borderSoft
      view.panel.backgroundColor = focused ? theme.panelFocused : theme.panel
      view.panel.title = ` ${view.title} · ${cards.length} `
      view.panel.titleColor = focused ? view.accent : theme.textFaint

      for (const child of view.scroll.getChildren()) view.scroll.remove(child)

      if (cards.length === 0) {
        const empty = new BoxRenderable(ctx, { flexDirection: "column", paddingY: 2 })
        empty.add(
          new TextRenderable(ctx, {
            content: t`${fg(theme.textFaint)(view.empty)}`,
            width: "100%",
            textAlign: "center",
          }),
        )
        empty.add(
          new TextRenderable(ctx, {
            content: t`${fg(theme.textFaint)(italic(view.hint))}`,
            width: "100%",
            textAlign: "center",
          }),
        )
        view.scroll.add(empty)
        return
      }

      cards.forEach((card, cardIndex) => {
        view.scroll.add(buildCard(card, cardIndex, view, focused))
      })
    })
  }

  function buildCard(card: Card, index: number, view: ColumnView, focused: boolean): BoxRenderable {
    const isSelected = focused && selected[card.column] === index
    const isDone = card.column === "done"
    const isFlashing = card.id === flashId && now() < flashUntil

    const box = new BoxRenderable(ctx, {
      id: card.id,
      width: "100%",
      flexDirection: "column",
      paddingLeft: 1,
      backgroundColor: isSelected ? theme.cardSelected : theme.card,
      border: ["left"],
      borderStyle: "heavy",
      borderColor: isSelected ? theme.borderFocus : isFlashing ? view.accent : theme.borderSoft,
    })

    const marker = isSelected ? "▸ " : "  "
    const lead = isDone ? fg(theme.done)("✓ ") : fg(priorityColor[card.priority])("● ")
    const title = isDone
      ? strikethrough(fg(theme.textDim)(card.title))
      : isSelected
        ? bold(fg(theme.text)(card.title))
        : fg(theme.text)(card.title)

    box.add(
      new TextRenderable(ctx, {
        content: joinChunks([fg(isSelected ? theme.accent : theme.textFaint)(marker), lead, title]),
        width: "100%",
        height: 1,
        wrapMode: "none",
        truncate: true,
      }),
    )

    const age = isDone
      ? formatAge(card.completedAt ?? card.movedAt, now())
      : card.column === "progress"
        ? formatAge(card.movedAt, now())
        : formatAge(card.createdAt, now())
    const tail = isDone ? fg(theme.done)("done") : fg(priorityColor[card.priority])(priorityLabel[card.priority])

    box.add(
      new TextRenderable(ctx, {
        content: joinChunks([
          fg(theme.textFaint)(`  ${card.id} · ${age} · `),
          tail,
        ]),
        width: "100%",
        height: 1,
        wrapMode: "none",
        truncate: true,
      }),
    )

    return box
  }

  /**
   * Keep the selected card inside the column viewport. Cards are uniform, so
   * the offset can be computed directly — `scrollChildIntoView` needs a layout
   * pass first, which isn't available the moment a column is rebuilt.
   */
  function scrollToSelected(view: ColumnView) {
    const cards = board.inColumn(view.id)
    if (cards.length === 0) {
      view.scroll.scrollTop = 0
      return
    }

    const viewportHeight = view.scroll.viewport.height
    if (viewportHeight <= 0) return // no layout yet — nothing to scroll against

    const rowHeight = CARD_ROWS + CARD_GAP
    const cardTop = selected[view.id] * rowHeight
    const cardBottom = cardTop + CARD_ROWS

    let offset = view.scroll.scrollTop
    if (cardTop < offset) offset = cardTop
    else if (cardBottom > offset + viewportHeight) offset = cardBottom - viewportHeight

    offset = Math.max(0, offset)
    if (offset !== view.scroll.scrollTop) view.scroll.scrollTo(offset)
  }

  // -------------------------------------------------------------- interaction
  function focusColumn(delta: number) {
    focusIdx = (focusIdx + delta + views.length) % views.length
    boardDirty = true
    refresh()
    scrollToSelected(activeColumn())
  }

  function moveSelection(delta: number) {
    const view = activeColumn()
    const cards = board.inColumn(view.id)
    if (cards.length === 0) return
    selected[view.id] = clamp(selected[view.id] + delta, 0, cards.length - 1)
    boardDirty = true
    refresh()
    scrollToSelected(view)
  }

  function moveSelected(column: ColumnId) {
    const view = activeColumn()
    const cards = board.inColumn(view.id)
    const card = cards[selected[view.id]]
    if (!card) {
      setToast("no card selected", theme.warn)
      return
    }
    if (card.column === column) {
      setToast(`${card.id} is already in ${columnLabel[column]}`, theme.warn)
      return
    }

    board.move(card, column)
    const landing = board.inColumn(column).indexOf(card)
    if (landing >= 0) selected[column] = landing

    flashId = card.id
    flashUntil = now() + FLASH_MS
    scheduleRepaint(FLASH_MS + 80)
    setToast(`${card.id} moved to ${columnLabel[column]}`, theme.ok)
    boardDirty = true
    refresh()
  }

  function cycleSelectedPriority() {
    const view = activeColumn()
    const card = board.inColumn(view.id)[selected[view.id]]
    if (!card) {
      setToast("no card selected", theme.warn)
      return
    }
    if (card.column === "done") {
      setToast("done cards have no priority", theme.warn)
      return
    }

    const priority = board.cyclePriority(card)
    // The column re-sorts by priority; keep the selection on the same card.
    selected[view.id] = board.inColumn(view.id).indexOf(card)

    flashId = card.id
    flashUntil = now() + FLASH_MS
    scheduleRepaint(FLASH_MS + 80)
    setToast(`${card.id} is now ${priorityLabel[priority]} priority`, priorityColor[priority])
    boardDirty = true
    refresh()
    scrollToSelected(view)
  }

  function deleteSelected() {
    const view = activeColumn()
    const cards = board.inColumn(view.id)
    const card = cards[selected[view.id]]
    if (!card) {
      setToast("nothing to delete", theme.warn)
      return
    }

    board.remove(card)
    if (flashId === card.id) flashId = null
    setToast(`${card.id} deleted`, theme.danger)
    boardDirty = true
    refresh()
  }

  function openComposer(value = "") {
    composerOpen = true
    composer.visible = true
    composerInput.value = value
    composerInput.focus()
    refresh()
  }

  function closeComposer() {
    composerOpen = false
    composer.visible = false
    composerInput.blur()
    refresh()
  }

  function submitComposer() {
    const title = composerInput.value.trim()
    if (!title) {
      setToast("give the card a title first", theme.warn)
      return
    }

    const card = board.create(title)
    composerInput.value = ""
    composerOpen = false
    composer.visible = false
    composerInput.blur()

    focusIdx = 0 // To-do is always the first column
    selected.todo = board.inColumn("todo").indexOf(card)
    flashId = card.id
    flashUntil = now() + FLASH_MS
    scheduleRepaint(FLASH_MS + 80)
    setToast(`${card.id} added to To-do`, theme.ok)
    boardDirty = true
    refresh()
    scrollToSelected(views[0]!)
  }

  function handleKey(key: KeyLike): KeyResult {
    // While composing, the input owns the keyboard; only Escape is ours.
    if (composerOpen) {
      if (key.name === "escape") {
        closeComposer()
        return "handled"
      }
      return "ignored"
    }

    if (key.ctrl && (key.name === "c" || key.name === "q")) return "quit"

    switch (key.name) {
      case "q":
        return "quit"
      case "left":
      case "h":
        focusColumn(-1)
        return "handled"
      case "right":
      case "l":
        focusColumn(1)
        return "handled"
      case "up":
      case "k":
        moveSelection(-1)
        return "handled"
      case "down":
      case "j":
        moveSelection(1)
        return "handled"
      case "tab":
        focusColumn(key.shift ? -1 : 1)
        return "handled"
      case "n":
        openComposer()
        return "handled"
      case "p":
        moveSelected("progress")
        return "handled"
      case "d":
        moveSelected("done")
        return "handled"
      case "t":
        moveSelected("todo")
        return "handled"
      case "space":
        cycleSelectedPriority()
        return "handled"
      case "x":
      case "delete":
        deleteSelected()
        return "handled"
      default:
        return "ignored"
    }
  }

  composerInput.on("enter", submitComposer)

  refresh()

  return {
    root,
    handleKey,
    refresh,
    destroy() {
      if (repaintTimer) clearTimeout(repaintTimer)
      root.destroyRecursively()
    },
    focusColumn,
    moveSelection,
    moveSelected,
    deleteSelected,
    openComposer,
    closeComposer,
    submitComposer,
  }
}
