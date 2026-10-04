import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { herdrTheme } from "./theme"

test("herdrTheme maps herdr's [theme] name onto Flow's themes", () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-"))
  mkdirSync(join(dir, "herdr"))
  process.env.XDG_CONFIG_HOME = dir
  const write = (toml: string) => writeFileSync(join(dir, "herdr", "config.toml"), toml)

  write('onboarding = false\n\n[theme]\nname = "tokyo-night"\nauto_switch = false\n')
  expect(herdrTheme()).toBe("tokyonight")
  write('[theme]\nname = "kanagawa"\n')
  expect(herdrTheme()).toBeUndefined() // a herdr theme Flow doesn't have
  write('[ui]\nname = "nord"\n[theme]\n')
  expect(herdrTheme()).toBeUndefined() // name outside [theme] doesn't count
  delete process.env.XDG_CONFIG_HOME
})
