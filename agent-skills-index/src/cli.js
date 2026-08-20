#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_URL_PREFIX,
  SkillValidationError,
  buildIndex,
  serialiseIndex,
} from './index.js';

const DEFAULT_ROOT = join('dist', '.well-known', 'agent-skills');

const USAGE = `agent-skills-index — build a .well-known/agent-skills/index.json discovery manifest

Usage
  agent-skills-index [root] [options]

Arguments
  root                  Directory containing <skill-name>/SKILL.md subdirectories.
                        Default: ${DEFAULT_ROOT}

Options
  -o, --out <path>      Where to write the manifest.
                        Default: <root>/index.json
  -b, --base-url <url>  Emit absolute skill URLs against this origin instead of
                        root-relative paths.
  -p, --url-prefix <p>  Path prefix the skills are served under.
                        Default: ${DEFAULT_URL_PREFIX}
      --check           Do not write. Exit 1 if the manifest on disk is missing
                        or out of date. Use this in CI.
      --allow-empty     Succeed (writing an empty manifest) when no skills are
                        found, instead of failing.
  -q, --quiet           Only print errors.
  -h, --help            Show this help.
  -v, --version         Print the version.

Exit codes
  0  manifest written, or up to date under --check
  1  validation failed, or manifest stale under --check
  2  bad usage
`;

function fail(message, code = 2) {
  process.stderr.write(`agent-skills-index: ${message}\n`);
  process.exit(code);
}

function readVersion() {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8')).version;
  } catch {
    return '0.0.0';
  }
}

export function parseArgs(argv) {
  const options = {
    root: null,
    out: null,
    baseUrl: undefined,
    urlPrefix: DEFAULT_URL_PREFIX,
    check: false,
    allowEmpty: false,
    quiet: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value.`);
      return value;
    };

    switch (arg) {
      case '-h':
      case '--help': options.help = true; break;
      case '-v':
      case '--version': options.version = true; break;
      case '-q':
      case '--quiet': options.quiet = true; break;
      case '--check': options.check = true; break;
      case '--allow-empty': options.allowEmpty = true; break;
      case '-o':
      case '--out': options.out = next(); break;
      case '-b':
      case '--base-url': options.baseUrl = next(); break;
      case '-p':
      case '--url-prefix': options.urlPrefix = next(); break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option "${arg}". Try --help.`);
        if (options.root !== null) fail(`Unexpected extra argument "${arg}".`);
        options.root = arg;
    }
  }

  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (options.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  if (options.baseUrl !== undefined) {
    try {
      new URL(options.baseUrl);
    } catch {
      fail(`--base-url "${options.baseUrl}" is not a valid absolute URL.`);
    }
  }

  const root = resolve(options.root ?? DEFAULT_ROOT);
  const outPath = options.out ? resolve(options.out) : join(root, 'index.json');
  const log = (message) => {
    if (!options.quiet) process.stdout.write(`${message}\n`);
  };

  let manifest;
  try {
    manifest = buildIndex(root, { baseUrl: options.baseUrl, urlPrefix: options.urlPrefix });
  } catch (err) {
    if (err instanceof SkillValidationError) {
      process.stderr.write(`agent-skills-index: ${err.message}\n`);
      return 1;
    }
    throw err;
  }

  if (manifest.skills.length === 0 && !options.allowEmpty) {
    process.stderr.write(
      `agent-skills-index: no skills found under ${root}. ` +
        `Expected <skill-name>/SKILL.md subdirectories. Pass --allow-empty to write an empty manifest anyway.\n`,
    );
    return 1;
  }

  const serialised = serialiseIndex(manifest);

  if (options.check) {
    let current;
    try {
      current = readFileSync(outPath, 'utf-8');
    } catch {
      process.stderr.write(`agent-skills-index: ${outPath} is missing. Run without --check to generate it.\n`);
      return 1;
    }
    if (current !== serialised) {
      process.stderr.write(
        `agent-skills-index: ${outPath} is out of date. Run without --check and commit the result.\n`,
      );
      return 1;
    }
    log(`✓ ${outPath} is up to date (${manifest.skills.length} skill${manifest.skills.length === 1 ? '' : 's'})`);
    return 0;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serialised);

  log(`✓ wrote ${outPath} (${manifest.skills.length} skill${manifest.skills.length === 1 ? '' : 's'})`);
  for (const skill of manifest.skills) {
    log(`  • ${skill.name} → ${skill.digest.slice(0, 18)}…`);
  }
  return 0;
}

// Only run when invoked as a binary, so tests can import parseArgs/main.
// npm installs `bin` entries as symlinks, so compare real paths — argv[1] is
// the symlink while import.meta.url is already resolved.
function realOrSelf(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

if (process.argv[1] && realOrSelf(process.argv[1]) === realOrSelf(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
