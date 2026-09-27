import fs from "node:fs";
import { configs as subConfigs, evaluate as evalSub, fillConfigs, evaluateFill } from "./golden-configs.js";
const configs = [...subConfigs.map((c) => ({ ...c, run: evalSub })), ...fillConfigs.map((c) => ({ ...c, run: evaluateFill }))];
const out = {};
for (const c of configs) out[c.name] = c.run(c);
fs.writeFileSync(new URL("./golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${configs.length} configs`);
