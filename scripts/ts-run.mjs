// Registers the .js -> .ts resolver hook. Used to run family-pack from source:
//   node --experimental-strip-types --import ./scripts/ts-run.mjs src/cli/index.ts
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./ts-loader.mjs', import.meta.url), pathToFileURL('./'));
