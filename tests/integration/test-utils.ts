import { resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';

// Ensure integration .env is loaded if present so keys can be detected
dotenv.config({ path: resolve(__dirname, '.env') });

export function hasRequiredIntegrationEnv(): boolean {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!process.env.OPENWEATHER_API_KEY) missing.push('OPENWEATHER_API_KEY');

  if (missing.length) {
    // Provide a concise hint in CI logs

    console.warn(`Skipping integration tests: missing ${missing.join(', ')}`);
    return false;
  }
  return true;
}

export async function startCubiclerServerWithHealthCheck(
  serverPort: number,
  timeoutMs: number = 45000
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
      }
      reject(new Error(`Server startup timeout after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    const serverProcess = spawn('npm', ['start'], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';
    let serverStarted = false;

    serverProcess.stdout?.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write('Server stdout: ' + chunk);

      // Look for server ready indicators - be more flexible
      if (
        !serverStarted &&
        (chunk.includes('All services ready!') ||
          chunk.includes('Cubicler server running on') ||
          chunk.includes('Server listening on port'))
      ) {
        serverStarted = true;
        // Start health check polling instead of immediate resolve
        pollHealthCheck(resolve, reject, timeout, output, errorOutput, serverPort, serverProcess);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      process.stderr.write('Server stderr: ' + chunk);

      // Check for critical errors that should fail fast
      // Exclude normal operational errors like dispatch errors and agent errors
      if (
        chunk.includes('EADDRINUSE') ||
        chunk.includes('Cannot find module') ||
        chunk.includes('SyntaxError') ||
        (chunk.includes('Error:') &&
          !chunk.includes('Warning') &&
          !chunk.includes('Agent not found') &&
          !chunk.includes('POST /dispatch') &&
          !chunk.includes('Agent stderr') &&
          !chunk.includes('Agent process error') &&
          !chunk.includes('Write error'))
      ) {
        clearTimeout(timeout);
        if (serverProcess) {
          serverProcess.kill('SIGTERM');
        }
        reject(new Error(`Server startup failed: ${chunk}`));
      }
    });

    serverProcess.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0 && !serverStarted) {
        reject(
          new Error(
            `Server exited with code ${code}, signal ${signal}. Output: ${output}, Error: ${errorOutput}`
          )
        );
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Failed to start server: ${error.message}. Output: ${output}, Error: ${errorOutput}`
        )
      );
    });
  });
}

async function pollHealthCheck(
  resolve: (serverProcess: ChildProcess) => void,
  reject: (error: Error) => void,
  timeout: ReturnType<typeof setTimeout>,
  output: string,
  errorOutput: string,
  serverPort: number,
  serverProcess: ChildProcess
): Promise<void> {
  const maxAttempts = 15; // 15 attempts over 15 seconds
  const serverUrl = `http://localhost:${serverPort}`;
  let attempts = 0;

  const poll = async () => {
    attempts++;

    try {
      const response = await fetch(`${serverUrl}/health`, {
        signal: globalThis.AbortSignal.timeout(2000), // 2 second timeout per request
      });

      if (response.ok) {
        clearTimeout(timeout);
        console.log(`✅ Server health check passed after ${attempts} attempts`);
        resolve(serverProcess);
        return;
      }
    } catch {
      // Health check failed, continue polling
    }

    if (attempts >= maxAttempts) {
      clearTimeout(timeout);
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
      }
      reject(
        new Error(
          `Server health check failed after ${attempts} attempts. Output: ${output}, Error: ${errorOutput}`
        )
      );
      return;
    }

    // Wait 1 second before next attempt
    setTimeout(poll, 1000);
  };

  // Start polling after a brief delay
  setTimeout(poll, 1000);
}
