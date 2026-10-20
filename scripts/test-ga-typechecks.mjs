import { runObservableGate } from "./lib/observable-gate-runner.mjs";

const runPnpm = (label, args) => {
  if (process.platform === "win32") {
    runObservableGate(label, process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `pnpm ${args.join(" ")}`]);
  } else {
    runObservableGate(label, "pnpm", args);
  }
};

runPnpm("frontend TypeScript", ["--filter", "@workspace/bimlog", "run", "typecheck"]);
runPnpm("API TypeScript", ["--filter", "@workspace/api-server", "run", "typecheck"]);
console.log("GA_TYPESCRIPT_PASS frontend=0 api=0");
