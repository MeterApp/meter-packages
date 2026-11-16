import { createServer, type Server } from 'node:http';
import { CliError } from '../errors.ts';

export interface LoopbackServer {
  port: number;
  redirectUri: string;
  /** Resolves with the authorization code once the browser hits /callback with the expected state. */
  waitForCode(timeoutMs: number): Promise<string>;
  close(): Promise<void>;
}

const SUCCESS_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Meter CLI</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0b0b0c;color:#f4f4f5}main{text-align:center;padding:2rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0;color:#a1a1aa}</style></head>
<body><main><h1>Signed in to Meter</h1><p>You can close this window and return to the terminal.</p></main></body></html>`;

function errorHtml(message: string): string {
  const escaped = message.replace(
    /[&<>"']/g,
    (char) => `&#${char.charCodeAt(0)};`
  );
  return SUCCESS_HTML.replace('Signed in to Meter', 'Sign-in failed').replace(
    'You can close this window and return to the terminal.',
    `${escaped}. Return to the terminal and run <code>meter login</code> again.`
  );
}

/**
 * Starts a loopback HTTP server on 127.0.0.1. `preferredPort` is tried first
 * (so a cached client registration keeps a valid redirect URI); 0 picks a
 * random free port.
 */
export function startLoopbackServer(
  expectedState: string,
  preferredPort = 0
): Promise<LoopbackServer> {
  return new Promise((resolveServer, rejectServer) => {
    let resolveCode: ((code: string) => void) | null = null;
    let rejectCode: ((error: Error) => void) | null = null;
    let settled = false;
    const outcome = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    // Avoid unhandled-rejection noise when the caller times out before reading.
    outcome.catch(() => undefined);

    const server: Server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        response
          .writeHead(404, { 'Content-Type': 'text/plain' })
          .end('Not found');
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (state !== expectedState) {
        // Not our login attempt (or a local page probing the port): answer, but never settle the flow.
        response
          .writeHead(400, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
          })
          .end(
            errorHtml(
              'The callback did not match this login attempt (bad state)'
            )
          );
        return;
      }
      const finish = (
        status: number,
        html: string,
        result: { code: string } | { error: Error }
      ) => {
        response
          .writeHead(status, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
          })
          .end(html);
        if (settled) return;
        settled = true;
        if ('code' in result) resolveCode?.(result.code);
        else rejectCode?.(result.error);
      };
      if (error) {
        const description = url.searchParams.get('error_description') ?? '';
        finish(
          400,
          errorHtml(`${error}${description ? `: ${description}` : ''}`),
          {
            error: new CliError(
              `Authorization failed: ${error}${description ? ` (${description})` : ''}`,
              1,
              'Approve the request in the browser, or run `meter login --no-browser` and open the printed URL.'
            )
          }
        );
        return;
      }
      if (!code) {
        finish(400, errorHtml('The callback carried no authorization code'), {
          error: new CliError(
            'The OAuth callback carried no authorization code.',
            1,
            'Run `meter login` again and use the URL it prints.'
          )
        });
        return;
      }
      finish(200, SUCCESS_HTML, { code });
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && preferredPort !== 0) {
        server.removeAllListeners('error');
        server.on('error', rejectServer);
        server.listen(0, '127.0.0.1');
        return;
      }
      rejectServer(error);
    });

    server.on('listening', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address ? address.port : preferredPort;
      resolveServer({
        port,
        redirectUri: `http://127.0.0.1:${port}/callback`,
        waitForCode(timeoutMs: number) {
          return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                rejectCode?.(
                  new CliError(
                    'Timed out waiting for the browser to complete sign-in.',
                    1,
                    'Run `meter login` again.'
                  )
                );
              }
            }, timeoutMs);
            outcome.then(
              (code) => {
                clearTimeout(timer);
                resolve(code);
              },
              (error: Error) => {
                clearTimeout(timer);
                reject(error);
              }
            );
          });
        },
        close() {
          return new Promise<void>((resolve) => {
            server.closeAllConnections?.();
            server.close(() => resolve());
          });
        }
      });
    });

    server.listen(preferredPort, '127.0.0.1');
  });
}
