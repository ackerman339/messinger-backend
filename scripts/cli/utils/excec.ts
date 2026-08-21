import { execSync } from 'node:child_process';

/**
 * Finds a running Docker container whose name matches the project name.
 * Exits the process if no matching container is found or if it is not running.
 */
function findContainer(projectName: string): string {
  try {
    const result = execSync(`docker ps --filter "name=^${projectName}$" --format "{{.ID}}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (!result) {
      console.error(`Container "${projectName}" does not exist or is not running.`);
      process.exit(1);
    }

    return result.split('\n')[0];
  } catch {
    console.error(`Failed to find container "${projectName}".`);
    process.exit(1);
  }
}

/**
 * Executes a command inside a running Docker container.
 */
export function run(command: string): void {
  const projectName = process.env.PROJECT_NAME;

  if (!projectName) {
    console.error('PROJECT_NAME is not defined in .env');
    process.exit(1);
  }

  const container = findContainer(projectName);

  execSync(`docker exec -i ${container} ${command}`, {
    stdio: 'inherit',
  });
}
