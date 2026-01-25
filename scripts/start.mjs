import { spawn } from "node:child_process";

// DigitalOcean App Platform provides PORT. Locally it may be unset.
const port = String(process.env.PORT ?? "3000");
// Always bind to all interfaces in containers/managed platforms.
// (Some platforms set HOSTNAME to an internal name that is not publicly resolvable.)
const host = "0.0.0.0";

const args = ["node_modules/next/dist/bin/next", "start", "-p", port, "-H", host];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

