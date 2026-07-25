type ExecFn = (command: string) => void;

export function run(exec: ExecFn) {
  exec(`pnpm typeorm  migration:run -d src/database/data-source.ts`);
}

export function revert(exec: ExecFn) {
  exec(`pnpm typeorm  migration:revert -d src/database/data-source.ts`);
}

export function show(exec: ExecFn) {
  exec(`pnpm typeorm  migration:show -d src/database/data-source.ts`);
}

export function generate(exec: ExecFn, name: string) {
  exec(
    `pnpm typeorm  migration:generate src/database/migrations/${name} -d src/database/data-source.ts`
  );
}

export function create(exec: ExecFn, name: string) {
  exec(`pnpm typeorm  migration:create src/database/migrations/${name}`);
}
