#!/usr/bin/env node
/**
 * Stops any dev servers holding the app's ports (3000 frontend, 4000 backend).
 * Works on WSL/Linux (fuser) and Windows (netstat+taskkill via PowerShell/cmd).
 */
import { execSync } from "node:child_process";

const PORTS = [3000, 4000];
const isWin = process.platform === "win32";

let killed = 0;
for (const port of PORTS) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { shell: "cmd.exe" }).toString();
      const pids = [...new Set(out.trim().split("\n").map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
      for (const pid of pids) {
        execSync(`taskkill /F /PID ${pid}`, { shell: "cmd.exe", stdio: "ignore" });
        killed++;
        console.log(`killed pid ${pid} (port ${port})`);
      }
    } else {
      const out = execSync(`lsof -t -i :${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null`).toString().trim();
      const pids = [...new Set(out.split(/\s+/).filter(Boolean))];
      for (const pid of pids) {
        process.kill(Number(pid), "SIGKILL");
        killed++;
        console.log(`killed pid ${pid} (port ${port})`);
      }
    }
  } catch {
    /* nothing listening on this port */
  }
}
console.log(killed === 0 ? "ports already free" : `done — ${killed} process(es) stopped`);
