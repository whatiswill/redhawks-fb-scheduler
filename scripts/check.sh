#!/usr/bin/env bash
# Fast checks run by CI and before every push. Needs Node 18+.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
cp src/Code.gs "$tmp/Code.js"
node --check "$tmp/Code.js"
# Pull the <script> blocks out of App.html and syntax-check them too.
node -e '
const fs=require("fs");
const html=fs.readFileSync("src/App.html","utf8");
const blocks=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
blocks.forEach((b,i)=>{ try { new Function(b.replace(/<\?[\s\S]*?\?>/g,"null")); } catch(e){ console.error("App.html script block "+(i+1)+": "+e.message); process.exit(1);} });
console.log("App.html: "+blocks.length+" script block(s) OK");
'
node -e 'JSON.parse(require("fs").readFileSync("src/appsscript.json","utf8")); console.log("appsscript.json OK")'
echo "Code.gs OK"
node tests/cells.test.js
