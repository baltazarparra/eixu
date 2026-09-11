import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Uma fonte de identidade, incluída também no artefato de produção. */
export const soul = readFileSync(join(process.cwd(), 'SOUL.md'), 'utf8');
