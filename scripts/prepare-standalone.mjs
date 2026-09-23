import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.join(process.cwd(), '.next', 'static');
const destination = path.join(process.cwd(), '.next', 'standalone', '.next', 'static');

await mkdir(path.dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true, force: true });

console.log('Copied Next static assets into the standalone server bundle.');
