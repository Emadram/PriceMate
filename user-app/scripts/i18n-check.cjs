const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const I18N_FILE = path.join(SRC_DIR, 'lib', 'i18n.js');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function extractTKeysFromFile(text) {
  const keys = new Set();
  // Matches t('key' ...) or t("key" ...)
  const re = /\bt\(\s*(['"])([^'"]+)\1/g;
  let m;
  while ((m = re.exec(text))) {
    keys.add(m[2]);
  }
  return keys;
}

function sliceBetween(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start === -1) return '';
  const end = endNeedle ? text.indexOf(endNeedle, start + startNeedle.length) : -1;
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function extractTranslationKeysFromI18n(i18nText, lang) {
  // Heuristic: grab the language block, then regex out "key":
  const startNeedle = `${lang}: {`;
  const endNeedle = lang === 'en' ? 'tr: {' : null;
  const langSlice = sliceBetween(i18nText, startNeedle, endNeedle);

  const translationIdx = langSlice.indexOf('translation: {');
  if (translationIdx === -1) return new Set();

  // From translation: { to the end of the lang slice; good enough for key extraction.
  const tSlice = langSlice.slice(translationIdx);

  const keys = new Set();
  const re = /"([^"]+)"\s*:/g;
  let m;
  while ((m = re.exec(tSlice))) {
    keys.add(m[1]);
  }
  return keys;
}

function main() {
  const files = walk(SRC_DIR).filter((f) => /\.(jsx?|tsx?)$/.test(f));
  const usedKeys = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const k of extractTKeysFromFile(text)) usedKeys.add(k);
  }

  const i18nText = fs.readFileSync(I18N_FILE, 'utf8');
  const enKeys = extractTranslationKeysFromI18n(i18nText, 'en');
  const trKeys = extractTranslationKeysFromI18n(i18nText, 'tr');

  const missingEn = [];
  const missingTr = [];
  for (const k of Array.from(usedKeys).sort()) {
    if (!enKeys.has(k)) missingEn.push(k);
    if (!trKeys.has(k)) missingTr.push(k);
  }

  console.log(`i18n-check: ${usedKeys.size} keys used in src/`);
  console.log(`i18n-check: ${enKeys.size} keys in en.translation`);
  console.log(`i18n-check: ${trKeys.size} keys in tr.translation`);

  if (missingEn.length) {
    console.log('\nMissing in EN:');
    for (const k of missingEn) console.log(`- ${k}`);
  }
  if (missingTr.length) {
    console.log('\nMissing in TR:');
    for (const k of missingTr) console.log(`- ${k}`);
  }

  const ok = missingEn.length === 0 && missingTr.length === 0;
  if (!ok) {
    console.log(`\nFAILED: Missing keys (EN=${missingEn.length}, TR=${missingTr.length})`);
    process.exit(1);
  }
  console.log('\nOK: No missing keys.');
}

main();

