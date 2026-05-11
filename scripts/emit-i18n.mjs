import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../src/assets/i18n');

const ar = (await import('./i18n-data/ar.mjs')).default;
const en = (await import('./i18n-data/en.mjs')).default;
const fr = (await import('./i18n-data/fr.mjs')).default;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'ar.json'), JSON.stringify(ar, null, 2), 'utf8');
writeFileSync(join(outDir, 'en.json'), JSON.stringify(en, null, 2), 'utf8');
writeFileSync(join(outDir, 'fr.json'), JSON.stringify(fr, null, 2), 'utf8');
console.log('Wrote i18n JSON files to', outDir);
