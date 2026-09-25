import { spawn } from "node:child_process";

const children = ["@cake-galaxy/api", "@cake-galaxy/web"].map((workspace) =>
  spawn("npm", ["run", "dev", "-w", workspace], { stdio: "inherit", shell: process.platform === "win32" })
);

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  children.forEach((child) => child.kill(signal));
});
