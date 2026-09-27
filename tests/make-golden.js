import fs from "node:fs";
import { configs, evaluate } from "./golden-configs.js";
const out = {};
for (const c of configs) out[c.name] = evaluate(c);
fs.writeFileSync(new URL("./golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${configs.length} configs`);
