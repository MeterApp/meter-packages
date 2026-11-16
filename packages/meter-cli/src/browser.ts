import { spawn } from 'node:child_process';

/** Opens a URL in the default browser without blocking; returns false when no opener exists. */
export function openBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const executable =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args =
    platform === 'win32' ? ['/c', 'start', '', url.replace(/&/g, '^&')] : [url];
  try {
    const child = spawn(executable, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {
      // The opener is missing (headless server); the caller already printed the URL.
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
