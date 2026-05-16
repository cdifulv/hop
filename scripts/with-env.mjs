import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const [, , command, ...args] = process.argv

if (!command) {
  console.error("Usage: node scripts/with-env.mjs <command> [...args]")
  process.exit(1)
}

if (existsSync(".env")) {
  const lines = readFileSync(".env", "utf8").split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separator = trimmed.indexOf("=")

    if (separator === -1) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] ??= value
  }
}

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
