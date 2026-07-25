type ExecFn = (command: string) => void;

export function runSeed(exec: ExecFn): void {
  exec(`pnpm seed`);
}
