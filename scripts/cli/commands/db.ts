import { runtimeConfig } from '../utils/cli-config';

type ExecFn = (command: string) => void;

export function drop(exec: ExecFn): void {
  exec(`${runtimeConfig.typeormCmd} schema:drop -d ${runtimeConfig.dataSourcePath}`);
}

export function sync(exec: ExecFn): void {
  exec(`${runtimeConfig.typeormCmd} schema:sync -d ${runtimeConfig.dataSourcePath}`);
}

export function reset(exec: ExecFn): void {
  exec(`${runtimeConfig.typeormCmd} schema:drop -d ${runtimeConfig.dataSourcePath}`);
  exec(`${runtimeConfig.typeormCmd} schema:sync -d ${runtimeConfig.dataSourcePath}`);
  exec(runtimeConfig.seedCmd);
}
