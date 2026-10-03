// Compact ESLint summary: one line per problem. Usage: node scripts/lint-summary.mjs
import { ESLint } from "eslint";
const eslint = new ESLint();
const results = await eslint.lintFiles(["."]);
let n = 0;
for (const f of results)
  for (const m of f.messages) {
    n++;
    console.log(`${f.filePath.replace(process.cwd() + "\\", "")}:${m.line} ${m.ruleId} | ${m.message.split("\n")[0].slice(0, 120)}`);
  }
console.log(`${n} problem(s)`);
process.exitCode = n ? 1 : 0;
