---
name: kanban
description: "Read and update the user's Flow kanban board (kanban-tui) from the shell. Use when the user asks you to work on, pick up, start, continue or finish a card or to-do (by id like K-07, by name, or \"the next one\"); when they mention their kanban, board, to-dos, cards or board projects; or when you find concrete follow-up work you won't do in this task (a bug you noticed, a TODO you left, a missing test) that meets the bar in this skill for becoming a To-do card."
---

# Kanban

The user tracks work on a kanban board (Flow, `kanban-tui`) with three columns: `todo`, `progress`, `done`. The board is often open in another pane; anything you change shows up there within a second, so you never need to open or restart it.

The board is split into projects, each with its own cards. Card commands work on the project open on the board unless you pass `--project <name>`, which uses that project without switching what the user sees.

## Commands

```bash
kanban-tui add "<title>" [--priority high|medium|low]   # new To-do card; prints its id, e.g. K-07
kanban-tui list                                         # open cards: id, column, priority, title (tab-separated)
kanban-tui list --all                                   # also Done cards
kanban-tui move <id> todo|progress|done                 # move a card
kanban-tui rm <id>                                      # delete a card

kanban-tui projects                                     # projects: name, to-do, doing, done counts, "open" on the open one
kanban-tui project add "<name>"                         # create a project (doesn't open it)
kanban-tui project open "<name>"                        # open a project on the user's board
kanban-tui project rename "<name>" "<new name>"         # rename a project
kanban-tui project rm "<name>"                          # delete a project AND all its cards
```

Add `--project "<name>"` to `add`, `list` or `status` to use a project other than the open one. Project names ignore case. Card ids are unique across projects, so `move` and `rm` find a card in any project.

`list` prints In Progress after To-do, and To-do from high to low priority, oldest first within a priority. So the first `todo` line is the card the user would pick up next.

To see every open card in every project, prefixed with its project:

```bash
kanban-tui projects | cut -f1 | while IFS= read -r p; do kanban-tui list --project "$p" | sed "s/^/$p\t/"; done
```

Never run `kanban-tui` with no arguments: that opens the interactive board and blocks your shell.

If `kanban-tui` isn't on `PATH`, Flow may be installed only as a herdr plugin; run `bun run <plugin dir>/index.ts <command>` instead.

## Picking the project

Use the first of these that applies:

1. The project the user named.
2. A project whose name matches the repo or area you're working in (ignoring case), even if the user has another project open.
3. The open project.

Pass the result with `--project` to `list` and `add`. `add --project` creates a missing project, so only pass names that `kanban-tui projects` listed, unless the user asked for a new project.

## Working on a card the user asks for

The user may name a card by id (`K-07`), by words from its title ("the auth refresh one"), or by position ("the next card", "what's in progress"). Find exactly one card before you touch any code.

1. Run `kanban-tui projects`, then pick the project as above.
2. Run `kanban-tui list --project "<project>"` (`--all` if they might mean a Done card).
3. Match the request:
   - An id: that card. Ids are unique across projects, so if it isn't in this project, search every project with the loop above.
   - Words: cards whose title contains those words or clearly means the same thing. If nothing matches in this project, search every project.
   - "Next", "top" or "first": the first `todo` card in the list.
   - "Current" or "what I'm doing": the `progress` card(s).
4. If exactly one card matches, say which before you start, in one line with its id, project and title, such as "Working on K-07 (Flow): Fix token refresh race in auth/session.ts." If the card's project doesn't match the repo you're in, say so and ask before changing code here.
5. If no card matches, or more than one does, don't guess. Show the candidates with id, project and title, and ask which one.
6. Then `move <id> progress`, do the work, and `move <id> done` only when it's finished and verified. If you stop early or it's blocked, leave it in `progress` and tell the user why.

The title is all the card holds. If it's too vague to act on, ask what the user wants before starting.

## When to add a card

Add a card only when the user asks for one, or when all of these are true:

- **Concrete:** you can name the file, function or area and say what's wrong or missing.
- **Out of scope:** it isn't part of the task you're doing now and you won't do it in this session. Steps of your current task belong in your own plan, not on the board.
- **Worth the user's time:** a real bug, a `TODO` you left in code, a missing test for code you touched, a refactor you deferred on purpose, or something the user said to do "later".
- **New:** `kanban-tui list --all --project "<project>"` shows nothing that already covers it.

Don't add cards for:

- Vague ideas: "improve performance", "clean up code", "add more tests".
- Style nits, speculative refactors, or "might be nice" features nobody asked for.
- Things you already fixed, or will fix before you finish.
- Work in a different repo or project than the one the card would go in.

If you're unsure, don't add it. Mention it in your final message ("I noticed X; want a card for it?") and let the user decide. If you have more than three candidates in one task, list them and ask which to add instead of adding them all.

Writing the card:

- The title is the whole card, so it must make sense weeks later with no context. Write a short imperative naming what and where, under ~70 characters: `Fix token refresh race in auth/session.ts`, `Add test for empty project name in cli.ts`. Not `fix bug`, `TODO`, or `look into auth`.
- Priority: `high` for a bug or blocker, `medium` (the default) for normal work, `low` for nice-to-haves.
- After adding, tell the user in one line with the id and project, such as "Added K-07 to Flow: Fix token refresh race in auth/session.ts."

Don't move or delete cards you weren't asked about.

## Managing projects

Create, open, rename or delete projects only when the user asks. `project rm` deletes every card in the project and can't be undone, so confirm with the user first unless they asked for that exact deletion. Don't `project open` to do your own work; use `--project` so the user's view stays put.
