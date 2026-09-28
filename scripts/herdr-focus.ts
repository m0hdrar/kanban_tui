// herdr plugin action: jump to the Kanban pane, or open one if there isn't one.
import { spawnSync } from "node:child_process"

const herdr = process.env.HERDR_BIN_PATH ?? "herdr"
const run = (...args: string[]) => spawnSync(herdr, args, { encoding: "utf8" })

const panes: { pane_id: string; label?: string }[] = JSON.parse(run("pane", "list").stdout).result.panes
const pane = panes.find((p) => p.label === "Kanban")

// Focus only works on panes this plugin opened; anything else falls through to a new pane.
if (!pane || run("plugin", "pane", "focus", pane.pane_id).status !== 0) {
  run("plugin", "pane", "open", "--plugin", process.env.HERDR_PLUGIN_ID!, "--entrypoint", "board", "--focus")
}
