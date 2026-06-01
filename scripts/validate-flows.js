#!/usr/bin/env node
/*
 * validate-flows.js — lightweight YAML parse check on all flow files.
 *
 * Runs in CI to catch flow-file drift (e.g., if an SDK release changes
 * a sub-flow's signature in a way that makes our example flows
 * structurally invalid). Does NOT execute Maestro itself — that's not
 * feasible in a GitHub Actions Linux runner without an emulator setup,
 * and the value/cost ratio doesn't justify it for an example repo.
 *
 * Pass: every YAML file under flows/ (excluding the vendored flows/percy/
 * subflows) parses without throwing.
 * Fail: any YAML parse error → process.exitCode = 1.
 *
 * Why no external YAML dep? Maestro YAML files use the document-separator
 * (`---`) idiom — we just need to confirm files are syntactically
 * well-formed enough that the YAML loader doesn't blow up. Node's built-in
 * features can't parse YAML, but we can shell out to `python3 -c "import yaml; yaml.safe_load_all(open(p))"`.
 * That trades a JS dep for a system dep (python3) which is universally
 * available on macOS dev hosts and GHA runners. If python3 ever becomes
 * an issue, swap to `js-yaml` as a devDep.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FLOWS_DIR = path.join(ROOT, 'flows');

function findYamlFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the vendored SDK subflows — those are validated upstream
      // in the SDK repo, not here.
      if (entry.name === 'percy') continue;
      findYamlFiles(full, acc);
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = findYamlFiles(FLOWS_DIR);
if (files.length === 0) {
  console.error('No YAML files found under flows/. Nothing to validate.');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file);
  try {
    execFileSync(
      'python3',
      [
        '-c',
        'import yaml,sys; list(yaml.safe_load_all(open(sys.argv[1])))',
        file
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    console.log(`  ok    ${rel}`);
  } catch (err) {
    const stderr = (err.stderr && err.stderr.toString()) || err.message;
    console.error(`  FAIL  ${rel}`);
    console.error(stderr.split('\n').map(l => `        ${l}`).join('\n'));
    failed++;
  }
}

console.log('');
if (failed > 0) {
  console.error(`${failed} of ${files.length} flow file(s) failed validation.`);
  process.exit(1);
}
console.log(`All ${files.length} flow file(s) validated.`);
