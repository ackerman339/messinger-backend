import { runtimeConfig, devOnlyConfig } from '../utils/cli-config';

type ExecFn = (command: string) => void;

export function run(exec: ExecFn) {
  exec(`${runtimeConfig.typeormCmd} migration:run -d ${runtimeConfig.dataSourcePath}`);
}

export function revert(exec: ExecFn) {
  exec(`${runtimeConfig.typeormCmd} migration:revert -d ${runtimeConfig.dataSourcePath}`);
}

export function show(exec: ExecFn) {
  exec(`${runtimeConfig.typeormCmd} migration:show -d ${runtimeConfig.dataSourcePath}`);
}

export function generate(exec: ExecFn, name: string) {
  exec(
    `${devOnlyConfig.typeormCmd} migration:generate ${devOnlyConfig.migrationsDir}/${name} -d src/database/data-source.ts`
  );
}

export function create(exec: ExecFn, name: string) {
  exec(`${devOnlyConfig.typeormCmd} migration:create ${devOnlyConfig.migrationsDir}/${name}`);
}
