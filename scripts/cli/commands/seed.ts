import { runtimeConfig } from '../utils/cli-config';

type ExecFn = (command: string) => void;

export function runSeed(exec: ExecFn): void {
  exec(runtimeConfig.seedCmd);
}
