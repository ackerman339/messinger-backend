import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { run } from './utils/excec';

import * as db from './commands/db';
import * as migration from './commands/migration';
import * as seed from './commands/seed';

yargs(hideBin(process.argv))
  .scriptName('cli')

  // --- DB ---
  .command('db <command>', 'Database commands', (y) =>
    y
      .command('drop', 'Drop schema', {}, () => {
        db.drop(run);
      })
      .command('sync', 'Sync schema', {}, () => {
        db.sync(run);
      })
      .command('reset', 'Reset database', {}, () => {
        db.reset(run);
      })
  )

  // --- MIGRATIONS ---
  .command('migration <command>', 'Migration commands', (y) =>
    y
      .command(
        'generate <name>',
        'Generate a migration',
        (y) =>
          y.positional('name', {
            type: 'string',
            demandOption: true,
            describe: 'Migration name',
          }),
        (argv) => {
          migration.generate(run, argv.name as string);
        }
      )
      .command(
        'create <name>',
        'Create empty migration',
        (y) =>
          y.positional('name', {
            type: 'string',
            demandOption: true,
            describe: 'Migration name',
          }),
        (argv) => {
          migration.create(run, argv.name as string);
        }
      )
      .command('run', 'Run migrations', {}, () => {
        migration.run(run);
      })
      .command('revert', 'Revert last migration', {}, () => {
        migration.revert(run);
      })
      .command('show', 'Show migrations', {}, () => {
        migration.show(run);
      })
  )

  // --- SEED ---
  .command('seed', 'Run seeders', {}, () => {
    seed.runSeed(run);
  })

  .demandCommand(1, 'You must provide a valid command')
  .strict()
  .help()
  .parse();
