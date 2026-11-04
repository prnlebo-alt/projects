// Next's standalone output omits .next/static (and public/). Copy them in so `npm start` serves CSS and JS,
// matching what the Dockerfile does.
import fs from "node:fs";

const standalone = ".next/standalone";
if (!fs.existsSync(standalone)) {
  console.error("copy-static: .next/standalone is missing; run `npm run build` first.");
  process.exit(1);
}
fs.cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (fs.existsSync("public")) fs.cpSync("public", `${standalone}/public`, { recursive: true });
console.log("copy-static: copied .next/static into the standalone server.");
