import { execSync } from 'node:child_process';

/**
 * Ensures that a Docker container exists and is currently running.
 * Exits the process if the container is missing or stopped.
 */
function ensureContainerRunning(container: string): void {
  try {
    const result = execSync(`docker inspect -f '{{.State.Running}}' ${container}`, {
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (result !== 'true') {
      console.error(`Container "${container}" exists but is not running.`);
      process.exit(1);
    }
  } catch {
    console.error(`Container "${container}" does not exist.`);
    process.exit(1);
  }
}

/**
 * Executes a command inside a running Docker container.
 */
export function run(command: string): void {
  const projectName = process.env.PROJECT_NAME;
  const container = `${projectName}`;

  if (!projectName) {
    console.error('PROJECT_NAME is not defined in .env');
    process.exit(1);
  }

  ensureContainerRunning(container);
  execSync(`docker exec -i ${container} ${command}`, {
    stdio: 'inherit',
  });
}
