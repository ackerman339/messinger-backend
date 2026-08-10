const isCompiled = process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production';

export const runtimeConfig = {
  typeormCmd: isCompiled ? 'npx typeorm' : 'npx tsx ./node_modules/typeorm/cli.js',
  dataSourcePath: isCompiled ? 'dist/src/database/data-source.js' : 'src/database/data-source.ts',
  seedCmd: isCompiled ? 'node dist/src/scripts/seeds.js' : 'npx tsx src/scripts/seeds.ts',
};

// generate/create: siempre dev, escriben archivos .ts fuente
export const devOnlyConfig = {
  typeormCmd: 'npx tsx ./node_modules/typeorm/cli.js',
  migrationsDir: 'src/database/migrations',
};
