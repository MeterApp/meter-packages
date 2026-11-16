import manifest from '../package.json' with { type: 'json' };

export const CLI_VERSION = manifest.version;
export const PACKAGE_NAME = manifest.name;
export const BIN_NAME = 'meter';
export const DEFAULT_API_ORIGIN = 'https://www.meterapp.co';
