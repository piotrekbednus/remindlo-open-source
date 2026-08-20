import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_DESCRIPTION_BYTES,
  SkillValidationError,
  buildIndex,
  buildSkillEntry,
  listSkillDirs,
  parseFrontmatter,
  serialiseIndex,
} from '../src/index.js';
import { parseArgs, main } from '../src/cli.js';

let root;

function writeSkill(name, contents) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, 'SKILL.md'), contents);
}

function skillMd(name, description, body = 'Body.') {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'agent-skills-'));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('parseFrontmatter', () => {
  test('reads plain scalars', () => {
    const fm = parseFrontmatter('---\nname: demo\ndescription: A demo skill.\n---\n\nBody\n');
    assert.equal(fm.name, 'demo');
    assert.equal(fm.description, 'A demo skill.');
  });

  test('strips surrounding quotes', () => {
    const fm = parseFrontmatter('---\ndescription: "Quoted: with a colon."\n---\n');
    assert.equal(fm.description, 'Quoted: with a colon.');
  });

  test('tolerates CRLF line endings and a BOM', () => {
    const fm = parseFrontmatter('﻿---\r\nname: demo\r\ndescription: Windows.\r\n---\r\n');
    assert.equal(fm.name, 'demo');
    assert.equal(fm.description, 'Windows.');
  });

  test('reads literal block scalars', () => {
    const fm = parseFrontmatter('---\ndescription: |\n  Line one.\n  Line two.\nname: demo\n---\n');
    assert.equal(fm.description, 'Line one.\nLine two.');
    assert.equal(fm.name, 'demo');
  });

  test('folds folded block scalars onto one line', () => {
    const fm = parseFrontmatter('---\ndescription: >-\n  A long description\n  wrapped across lines.\n---\n');
    assert.equal(fm.description, 'A long description wrapped across lines.');
  });

  test('ignores comments and blank lines', () => {
    const fm = parseFrontmatter('---\n# a comment\n\nname: demo\n---\n');
    assert.deepEqual(fm, { name: 'demo' });
  });

  test('returns {} when there is no frontmatter', () => {
    assert.deepEqual(parseFrontmatter('# Just a heading\n'), {});
  });

  test('returns {} when the block is never closed', () => {
    assert.deepEqual(parseFrontmatter('---\nname: demo\nno closing delimiter\n'), {});
  });

  test('does not treat a --- inside the body as the delimiter of a later block', () => {
    const fm = parseFrontmatter('---\nname: demo\n---\n\nIntro\n\n---\n\nname: not-a-field\n');
    assert.deepEqual(fm, { name: 'demo' });
  });
});

describe('buildSkillEntry', () => {
  test('digests the raw file bytes', () => {
    writeSkill('digest-demo', skillMd('digest-demo', 'Demo.'));
    const entry = buildSkillEntry(root, 'digest-demo');
    assert.match(entry.digest, /^sha256:[0-9a-f]{64}$/);

    // Same bytes in, same digest out.
    assert.equal(buildSkillEntry(root, 'digest-demo').digest, entry.digest);

    writeSkill('digest-demo', skillMd('digest-demo', 'Demo.', 'Changed body.'));
    assert.notEqual(buildSkillEntry(root, 'digest-demo').digest, entry.digest);
  });

  test('emits a root-relative URL by default', () => {
    writeSkill('url-demo', skillMd('url-demo', 'Demo.'));
    assert.equal(
      buildSkillEntry(root, 'url-demo').url,
      '/.well-known/agent-skills/url-demo/SKILL.md',
    );
  });

  test('emits an absolute URL when given a base URL', () => {
    writeSkill('abs-demo', skillMd('abs-demo', 'Demo.'));
    assert.equal(
      buildSkillEntry(root, 'abs-demo', { baseUrl: 'https://example.com' }).url,
      'https://example.com/.well-known/agent-skills/abs-demo/SKILL.md',
    );
  });

  test('honours a custom url prefix and trims its trailing slash', () => {
    writeSkill('prefix-demo', skillMd('prefix-demo', 'Demo.'));
    assert.equal(
      buildSkillEntry(root, 'prefix-demo', { urlPrefix: '/skills/' }).url,
      '/skills/prefix-demo/SKILL.md',
    );
  });

  test('falls back to the directory name when frontmatter omits name', () => {
    writeSkill('implicit-name', '---\ndescription: No name field.\n---\n');
    assert.equal(buildSkillEntry(root, 'implicit-name').name, 'implicit-name');
  });

  test('rejects a name that disagrees with the directory', () => {
    writeSkill('mismatch', skillMd('something-else', 'Demo.'));
    assert.throws(() => buildSkillEntry(root, 'mismatch'), SkillValidationError);
  });

  test('rejects an invalid directory name', () => {
    writeSkill('Not_Valid', skillMd('Not_Valid', 'Demo.'));
    assert.throws(() => buildSkillEntry(root, 'Not_Valid'), /not a valid skill name/);
  });

  test('rejects a missing description', () => {
    writeSkill('no-description', '---\nname: no-description\n---\n');
    assert.throws(() => buildSkillEntry(root, 'no-description'), /no "description"/);
  });

  test('rejects an over-long description', () => {
    writeSkill('too-long', skillMd('too-long', 'x'.repeat(MAX_DESCRIPTION_BYTES + 1)));
    assert.throws(() => buildSkillEntry(root, 'too-long'), /over the 1024-byte limit/);
  });

  test('measures the description limit in bytes, not characters', () => {
    // 400 four-byte emoji = 1600 bytes but only 400 code points.
    writeSkill('multibyte', skillMd('multibyte', '🙂'.repeat(400)));
    assert.throws(() => buildSkillEntry(root, 'multibyte'), /1600 bytes/);
  });

  test('reports a directory with no SKILL.md', () => {
    mkdirSync(join(root, 'empty-dir'), { recursive: true });
    assert.throws(() => buildSkillEntry(root, 'empty-dir'), /has no SKILL.md/);
  });
});

describe('listSkillDirs', () => {
  test('returns [] for a missing root rather than throwing', () => {
    assert.deepEqual(listSkillDirs(join(root, 'does-not-exist')), []);
  });

  test('skips dotfiles and plain files', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-list-'));
    mkdirSync(join(scoped, '.hidden'));
    mkdirSync(join(scoped, 'real-skill'));
    writeFileSync(join(scoped, 'index.json'), '{}');
    assert.deepEqual(listSkillDirs(scoped), ['real-skill']);
    rmSync(scoped, { recursive: true, force: true });
  });
});

describe('buildIndex', () => {
  test('sorts skills by name and declares the schema', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-sort-'));
    for (const name of ['zebra', 'alpha', 'middle']) {
      mkdirSync(join(scoped, name));
      writeFileSync(join(scoped, name, 'SKILL.md'), skillMd(name, `The ${name} skill.`));
    }
    const manifest = buildIndex(scoped);
    assert.equal(manifest.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json');
    assert.deepEqual(manifest.skills.map((s) => s.name), ['alpha', 'middle', 'zebra']);
    assert.ok(manifest.skills.every((s) => s.type === 'skill-md'));
    rmSync(scoped, { recursive: true, force: true });
  });

  test('produces an empty skill list for a missing root', () => {
    assert.deepEqual(buildIndex(join(root, 'nope')), {
      $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
      skills: [],
    });
  });
});

describe('serialiseIndex', () => {
  test('writes 2-space JSON with a trailing newline', () => {
    const out = serialiseIndex({ $schema: 'x', skills: [] });
    assert.ok(out.endsWith('}\n'));
    assert.ok(out.includes('\n  "skills"'));
  });
});

describe('cli', () => {
  test('parses flags and their aliases', () => {
    const options = parseArgs(['build/skills', '-o', 'out.json', '-b', 'https://x.test', '--check']);
    assert.equal(options.root, 'build/skills');
    assert.equal(options.out, 'out.json');
    assert.equal(options.baseUrl, 'https://x.test');
    assert.equal(options.check, true);
    assert.equal(options.quiet, false);
  });

  test('--check passes when the manifest matches and fails once it drifts', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-check-'));
    mkdirSync(join(scoped, 'demo'));
    writeFileSync(join(scoped, 'demo', 'SKILL.md'), skillMd('demo', 'A demo.'));

    assert.equal(main([scoped, '--quiet']), 0);
    assert.equal(main([scoped, '--check', '--quiet']), 0);

    writeFileSync(join(scoped, 'demo', 'SKILL.md'), skillMd('demo', 'A different demo.'));
    assert.equal(main([scoped, '--check', '--quiet']), 1);

    rmSync(scoped, { recursive: true, force: true });
  });

  test('--check fails when the manifest has never been generated', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-missing-'));
    mkdirSync(join(scoped, 'demo'));
    writeFileSync(join(scoped, 'demo', 'SKILL.md'), skillMd('demo', 'A demo.'));
    assert.equal(main([scoped, '--check', '--quiet']), 1);
    rmSync(scoped, { recursive: true, force: true });
  });

  test('exits 1 on a validation error instead of throwing', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-invalid-'));
    mkdirSync(join(scoped, 'broken'));
    writeFileSync(join(scoped, 'broken', 'SKILL.md'), '---\nname: broken\n---\n');
    assert.equal(main([scoped, '--quiet']), 1);
    rmSync(scoped, { recursive: true, force: true });
  });

  test('refuses an empty directory unless --allow-empty is given', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-empty-'));
    assert.equal(main([scoped, '--quiet']), 1);
    assert.equal(main([scoped, '--allow-empty', '--quiet']), 0);
    const written = JSON.parse(readFileSync(join(scoped, 'index.json'), 'utf-8'));
    assert.deepEqual(written.skills, []);
    rmSync(scoped, { recursive: true, force: true });
  });

  test('writes to --out, creating parent directories', () => {
    const scoped = mkdtempSync(join(tmpdir(), 'agent-skills-out-'));
    mkdirSync(join(scoped, 'demo'));
    writeFileSync(join(scoped, 'demo', 'SKILL.md'), skillMd('demo', 'A demo.'));

    const out = join(scoped, 'nested', 'deeper', 'index.json');
    assert.equal(main([scoped, '--out', out, '--quiet']), 0);
    assert.equal(JSON.parse(readFileSync(out, 'utf-8')).skills.length, 1);

    rmSync(scoped, { recursive: true, force: true });
  });
});

describe('the published example', () => {
  test('the bundled Remindlo skill produces a valid entry', () => {
    // fileURLToPath, not URL.pathname — the latter is percent-encoded and
    // breaks on any checkout path containing a space.
    const examples = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');
    const manifest = buildIndex(examples);
    assert.equal(manifest.skills.length, 1);
    const [skill] = manifest.skills;
    assert.equal(skill.name, 'remindlo-sms-reminders');
    assert.equal(skill.type, 'skill-md');
    assert.match(skill.digest, /^sha256:[0-9a-f]{64}$/);
    assert.ok(Buffer.byteLength(skill.description, 'utf-8') <= MAX_DESCRIPTION_BYTES);
  });
});
