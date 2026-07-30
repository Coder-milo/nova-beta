import { cli } from './node_modules/astro/dist/cli/index.js';

cli(['node', 'astro', 'dev', '--host', '0.0.0.0', '--port', '3000']);
setInterval(() => {}, 100000);
