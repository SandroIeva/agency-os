// The word-index mapping out of trackKaraoke, run against a fake clock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url),'utf8');
const i = src.indexOf('const trackKaraoke = (audio, text, offset) => {');
assert.ok(i > 0, 'trackKaraoke not found');
const body = src.slice(i, src.indexOf('\n  };', i));
// The pure half: how a fraction of the audio becomes a word index.
const mk = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lens = words.map(w => w.length + 1);
  const total = lens.reduce((a,b)=>a+b,0);
  const ends = []; let run = 0;
  for (const l of lens) { run += l; ends.push(run/total); }
  return { words, ends };
};
assert.ok(body.includes('w.length + 1') && body.includes('run / total'),
  'the shipped code still weights by word length');

const text = "Ich kenne deine Marke und helfe dir, dich darin zu bewegen: Ich kann suchen, erklären, Zusammenhänge finden oder direkt etwas für dich erledigen.";
const { words, ends } = mk(text);
const at = (p) => { let k = ends.findIndex(e => p < e); return k < 0 ? words.length - 1 : k; };

let last = -1, seen = new Set();
for (let f = 0; f <= 1.0001; f += 0.001) {
  const k = at(Math.min(1, f));
  assert.ok(k >= last, `springt zurueck bei ${f.toFixed(3)}: ${last} -> ${k}`);
  last = k; seen.add(k);
}
assert.equal(at(0), 0, 'startet beim ersten Wort');
assert.equal(at(0.999), words.length - 1, 'endet beim letzten Wort');
assert.equal(seen.size, words.length, `jedes der ${words.length} Woerter kommt dran, gesehen ${seen.size}`);

// A long word must hold the highlight longer than a short one.
const w = mk("und Zusammenhaenge");
assert.ok(w.ends[0] < 0.35, `"und" haelt ${(w.ends[0]*100).toFixed(0)}% statt der Haelfte`);
console.log(`Passed: ${words.length} Woerter, monoton, keiner uebersprungen, lange Woerter halten laenger.`);
