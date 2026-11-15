// Validates data/categories/*.json. Runs as `npm run validate-words` and before every build.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "data", "categories");
const DIFFICULTIES = ["easy", "medium", "spicy"];
const MIN_PER_CATEGORY = 250;
const MIN_TOTAL = 4000;
// Too vague to clue around: the playability rule ("Espresso", not "Liquid").
const BANNED = new Set(["thing", "object", "stuff", "item", "food", "drink", "liquid", "animal", "place", "building", "person", "people", "vehicle", "plant", "game", "sport", "job"]);

const norm = (w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const errors = [];
const seen = new Map(); // normalized word -> "category/subCategory"
let total = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  let cat;
  try {
    cat = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  if (cat.id !== file.replace(/\.json$/, "")) errors.push(`${file}: id "${cat.id}" must match file name`);
  if (typeof cat.name !== "string" || !cat.name.trim()) errors.push(`${file}: missing name`);
  if (!cat.words || typeof cat.words !== "object") {
    errors.push(`${file}: missing words`);
    continue;
  }

  const inCategory = new Set();
  for (const [sub, byDiff] of Object.entries(cat.words)) {
    for (const key of Object.keys(byDiff)) {
      if (!DIFFICULTIES.includes(key)) errors.push(`${file}/${sub}: unknown difficulty "${key}"`);
    }
    for (const diff of DIFFICULTIES) {
      for (const word of byDiff[diff] ?? []) {
        const where = `${cat.id}/${sub}`;
        if (typeof word !== "string" || word !== word.trim() || !word) {
          errors.push(`${where}: bad entry ${JSON.stringify(word)}`);
          continue;
        }
        const n = norm(word);
        if (BANNED.has(n)) errors.push(`${where}: "${word}" is too generic`);
        if (word.length > 40) errors.push(`${where}: "${word}" is too long`);
        if (seen.has(n)) errors.push(`duplicate "${word}" in ${where} and ${seen.get(n)}`);
        else seen.set(n, where);
        inCategory.add(n);
        total++;
      }
    }
  }

  const count = inCategory.size;
  if (count < MIN_PER_CATEGORY) errors.push(`${cat.id}: ${count} words, needs at least ${MIN_PER_CATEGORY}`);
  console.log(`${cat.id.padEnd(22)} ${count}`);

  // Optional notes: { "Okapi": "Forest giraffe relative with zebra-striped legs" } — shown to crew.
  for (const [word, note] of Object.entries(cat.notes ?? {})) {
    if (!inCategory.has(norm(word))) errors.push(`${cat.id}: note key "${word}" is not a word in this category`);
    if (typeof note !== "string" || !note.trim() || note.length > 160) errors.push(`${cat.id}: note for "${word}" must be 1-160 characters`);
  }

}

console.log(`${"TOTAL".padEnd(22)} ${total}`);
if (total < MIN_TOTAL) errors.push(`total ${total} words, needs at least ${MIN_TOTAL}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll words valid.");
