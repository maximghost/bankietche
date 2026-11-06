// Vérifie qu'aucune information légale n'est restée « [À COMPLÉTER ».
// À lancer avant toute mise en vente : npm run check:legal
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/legal/identity.ts', import.meta.url), 'utf8');
const missing = [...src.matchAll(/(\w+):\s*'\[À COMPLÉTER[^']*'/g)].map((m) => m[1]);
if (missing.length) {
  console.error(`✗ Informations légales à compléter dans src/legal/identity.ts : ${missing.join(', ')}`);
  process.exit(1);
}
console.log('✓ Informations légales complètes.');
