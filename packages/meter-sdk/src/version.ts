import manifest from '../package.json' with { type: 'json' };

export const SDK_VERSION = manifest.version;
