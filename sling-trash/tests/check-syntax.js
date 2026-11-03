'use strict';
/* node .dream-loop/check-syntax.js : extracts index.html's inline <script> and
 * node --check's it (node --check can't run directly on .html). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
const inline = matches.map(m => m[1]).filter(s => s.trim().length > 200).pop();
if (!inline) { console.error('inline <script> not found'); process.exit(1); }
try {
  new vm.Script(inline, {filename: 'index.html-inline.js'});
  console.log('OK: inline script parses cleanly (' + inline.split('\n').length + ' lines)');
} catch (e) {
  console.error('SYNTAX ERROR:', e.message);
  process.exit(1);
}
