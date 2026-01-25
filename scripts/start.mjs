import { spawn } from "node:child_process";

// DigitalOcean App Platform provides PORT. Locally it may be unset.
const port = String(process.env.PORT ?? "3000");
// Bind to all interfaces in containers/managed platforms.
const host = String(process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0");

const args = ["node_modules/next/dist/bin/next", "start", "-p", port, "-H", host];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

