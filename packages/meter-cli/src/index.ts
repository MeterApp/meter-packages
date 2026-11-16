/** Programmatic surface of the Meter CLI (used by tests and embedders). */
export { main, type MainDeps } from './main.ts';
export { parseArgs, type ParsedArgs, type FlagValue } from './args.ts';
export { createBridge, serveStdio, type Bridge } from './mcp/bridge.ts';
export {
  runLogin,
  refreshCredential,
  buildAuthorizationUrl,
  type LoginDeps
} from './oauth/login.ts';
export { discover, type Discovery } from './oauth/discovery.ts';
export { createPkcePair, challengeFor } from './oauth/pkce.ts';
export {
  buildToolArgs,
  catalogToolSpecs,
  findCatalogTool,
  remoteToolSpec,
  type ToolSpec,
  type FieldSpec
} from './tools.ts';
export {
  renderAgentConfig,
  mcpServersDocument,
  AGENT_HOSTS,
  type AgentHost
} from './agent-config.ts';
export {
  credentialsPath,
  configDir,
  readCredentials,
  saveCredential,
  deleteCredential,
  type StoredCredential
} from './config.ts';
export { CLI_VERSION, PACKAGE_NAME, DEFAULT_API_ORIGIN } from './version.ts';
