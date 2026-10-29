// strings.test.mjs — the Chinese and English texts (js/ui/strings/) stay in step:
//  • both languages have exactly the same keys
//  • a text's {placeholders} are the same in both, so t() fills in the same values
//  • no text is empty
// Run: node tests/strings.test.mjs
import assert from 'node:assert/strict';
import { zh } from '../js/ui/strings/zh.js';
import { en } from '../js/ui/strings/en.js';

const onlyIn = (a, b) => Object.keys(a).filter((k) => !(k in b));
assert.deepEqual(onlyIn(zh, en), [], 'keys only in zh.js');
assert.deepEqual(onlyIn(en, zh), [], 'keys only in en.js');

const holes = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
for (const key of Object.keys(en)) {
  assert.deepEqual(holes(zh[key]), holes(en[key]), `placeholders differ for "${key}"`);
  assert.ok(String(zh[key]).length && String(en[key]).length, `empty text for "${key}"`);
}

console.log(`strings: ${Object.keys(en).length} keys, both languages match`);
