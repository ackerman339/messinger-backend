type ExecFn = (command: string) => void;

export function drop(exec: ExecFn): void {
  exec(`pnpm typeorm  schema:drop -d src/database/data-source.ts`);
}

export function sync(exec: ExecFn): void {
  exec(`pnpm typeorm  schema:sync -d src/database/data-source.ts`);
}

export function reset(exec: ExecFn): void {
  exec(`pnpm typeorm  schema:drop -d src/database/data-source.ts`); // Drop schema
  exec(`pnpm typeorm  schema:sync -d src/database/data-source.ts`); // Run migrations to recreate schema
  exec(`pnpm seed`);
}
