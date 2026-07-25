# messinger-backend

Real time communications

## Tech Stack

- Node.js · TypeScript · Express
- PostgreSQL · TypeORM
- ESLint + Prettier
- Vitest · @vitest/coverage-v8
- Docker
- Git Hooks — Husky · commitlint · lint-staged

## Requirements

- Node.js >= 22.0.0
- pnpm
- PostgreSQL

## Getting Started

### Installation

```bash
pnpm install
```

### Environment Variables

```bash
cp .env.example .env
```

### Database

```bash
# Run migrations
pnpm cli migration run

# Run seeds
pnpm cli seed
```

### Running the app

```bash
# Start with Docker
docker-compose up -d

# Stop
docker-compose down
```

## Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `docker-compose up -d` | Start with Docker                |
| `docker-compose down`  | Stop Docker containers           |
| `pnpm build`           | Build for production             |
| `pnpm test`            | Run tests                        |
| `pnpm test:coverage`   | Run tests with coverage          |
| `pnpm lint`            | Lint code                        |
| `pnpm format`          | Format code                      |
| `pnpm validate`        | Lint + format check + type check |

## CLI

```bash
# Database
pnpm cli db drop          # Drop schema
pnpm cli db sync          # Sync schema
pnpm cli db reset         # Drop + sync + seed

# Migrations
pnpm cli migration run              # Run pending migrations
pnpm cli migration revert           # Revert last migration
pnpm cli migration show             # Show migrations status
pnpm cli migration generate <name>  # Generate migration from entities
pnpm cli migration create <name>    # Create empty migration

# Seeds
pnpm cli seed             # Run seeders
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

## Project Structure

```
messinger-backend/
├── scripts/
│   └── cli/
│       ├── commands/
│       │   ├── db.ts
│       │   ├── migration.ts
│       │   └── seed.ts
│       ├── utils/
│       │   └── excec.ts
│       └── index.ts
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── environment.ts
│   │   └── logger.ts
│   ├── database/
│   │   ├── migrations/
│   │   │   └── index.ts
│   │   ├── seeds/
│   │   │   └── index.ts
│   │   └── data-source.ts
│   ├── entities/
│   │   └── index.ts
│   ├── repositories/
│   │   └── index.ts
│   ├── services/
│   │   └── index.ts
│   ├── controllers/
│   │   └── index.ts
│   ├── logging/
│   │   ├── adapters/
│   │   │   └── typeorm.logger.ts
│   │   ├── context/
│   │   │   ├── async-context.ts
│   │   │   └── get-request-id.ts
│   │   ├── errors/
│   │   │   └── error-handler.ts
│   │   ├── middleware/
│   │   │   ├── context.middleware.ts
│   │   │   └── logging.middleware.ts
│   │   └── index.ts
│   ├── middlewares/
│   │   ├── index.ts
│   │   └── dto-validation.ts
│   ├── dtos/
│   │   └── index.ts
│   ├── routes/
│   │   ├── v1/
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── express.d.ts
│   ├── utils/
│   │   ├── index.ts
│   │   └── database.ts
│   ├── constants/
│   │   └── index.ts
│   ├── jobs/
│   │   └── index.ts
│   ├── queues/
│   │   └── index.ts
│   ├── exceptions/
│   │   ├── index.ts
│   │   ├── base-exception.ts
│   │   ├── bad-request-exception.ts
│   │   ├── conflict-exception.ts
│   │   ├── forbidden-exception.ts
│   │   ├── notfound-exception.ts
│   │   ├── unauthorized-exception.ts
│   │   └── validation-exception.ts
│   ├── docs/
│   │   └── swagger.config.ts
│   ├── scripts/
│   │   └── seeds.ts
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   │   └── index.ts
│   ├── integration/
│   │   └── index.ts
│   ├── e2e/
│   │   └── index.ts
│   ├── fixtures/
│   │   └── index.ts
│   ├── helpers/
│   │   └── index.ts
│   └── setup.ts
├── logs/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── nodemon.json
├── .prettierrc
├── eslint.config.mjs
└── vitest.config.ts
```
