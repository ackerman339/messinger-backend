import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

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
 * Checks whether the current process is running inside a Docker container.
 */
function isRunningInDocker(): boolean {
  return existsSync('/.dockerenv');
}

/**
 * Executes a command.
 *
 * When running inside Docker, the command is executed directly.
 *
 * When running on the host, the command is executed inside
 * the Docker container defined by PROJECT_NAME.
 */
export function run(command: string): void {
  if (isRunningInDocker()) {
    execSync(command, {
      stdio: 'inherit',
    });

    return;
  }

  const projectName = process.env.PROJECT_NAME;

  if (!projectName) {
    console.error('PROJECT_NAME is not defined in .env');
    process.exit(1);
  }

  ensureContainerRunning(projectName);

  execSync(`docker exec -i ${projectName} ${command}`, {
    stdio: 'inherit',
  });
}
