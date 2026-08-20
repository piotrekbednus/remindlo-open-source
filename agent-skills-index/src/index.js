/**
 * agent-skills-index — build a `.well-known/agent-skills/index.json` discovery
 * manifest from a directory of `<skill-name>/SKILL.md` files.
 *
 * The manifest lets any AI agent find the Skills a domain publishes, and the
 * per-skill SHA-256 digest lets it verify it loaded the bytes the publisher
 * intended.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Schema the emitted manifest declares. */
export const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

/** Default path prefix under which skills are served. */
export const DEFAULT_URL_PREFIX = '/.well-known/agent-skills';

/** Skill names are lowercase alphanumeric plus hyphens, 1–64 characters. */
export const NAME_PATTERN = /^[a-z0-9-]{1,64}$/;

/** Descriptions are capped so an agent can hold every skill's summary at once. */
export const MAX_DESCRIPTION_BYTES = 1024;

/** Thrown for anything a publisher can fix by editing their SKILL.md. */
export class SkillValidationError extends Error {
  constructor(message, { skill } = {}) {
    super(message);
    this.name = 'SkillValidationError';
    this.skill = skill;
  }
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function stripQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse the YAML frontmatter block at the top of a SKILL.md.
 *
 * Deliberately not a full YAML parser — SKILL.md frontmatter is a flat map of
 * scalars. Beyond plain `key: value` this understands the two forms that show
 * up in practice for long descriptions: block scalars (`key: |` / `key: >`)
 * and quoted values. Returns `{}` when there is no frontmatter block.
 */
export function parseFrontmatter(source) {
  const text = String(source).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return {};

  const lines = text.split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (line === '---' || line === '...') {
      end = i;
      break;
    }
  }
  if (end === -1) return {};

  const out = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const match = line.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2].trim();

    // Block scalar: `key: |`, `key: >-`, `key: |+2` … the value is the
    // indented lines that follow.
    const blockMatch = rawValue.match(/^([|>])([-+]?)(\d*)$/);
    if (blockMatch) {
      const folded = blockMatch[1] === '>';
      const chomp = blockMatch[2];
      const body = [];
      let j = i + 1;
      let indent = null;
      for (; j < end; j++) {
        const candidate = lines[j];
        if (!candidate.trim()) {
          body.push('');
          continue;
        }
        const leading = candidate.length - candidate.trimStart().length;
        if (indent === null) {
          indent = leading;
        } else if (leading < indent) {
          break;
        }
        body.push(candidate.slice(indent));
      }
      i = j - 1;

      // Chomping: `+` keeps trailing blank lines, `-` and the default strip
      // them. A description ending in newlines helps nobody, so the default
      // strips rather than YAML's "clip to one newline".
      let value = folded ? foldBlock(body) : body.join('\n');
      if (chomp !== '+') value = value.replace(/\n+$/, '');
      out[key] = value;
      continue;
    }

    out[key] = stripQuotes(rawValue);
  }
  return out;
}

/** YAML folded-scalar semantics: single newlines become spaces, blanks stay. */
function foldBlock(lines) {
  const parts = [];
  let current = [];
  for (const line of lines) {
    if (line === '') {
      parts.push(current.join(' '));
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  parts.push(current.join(' '));
  return parts.join('\n').replace(/\n+$/, '');
}

/** List immediate subdirectories of `root`, or `[]` when it does not exist. */
export function listSkillDirs(root) {
  let entries;
  try {
    entries = readdirSync(root);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((name) => {
      if (name.startsWith('.')) return false;
      try {
        return statSync(join(root, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Build one manifest entry from `<root>/<dirName>/SKILL.md`.
 *
 * The digest covers the raw file bytes, so it stays stable regardless of how
 * the frontmatter is parsed.
 */
export function buildSkillEntry(root, dirName, { baseUrl, urlPrefix = DEFAULT_URL_PREFIX } = {}) {
  if (!NAME_PATTERN.test(dirName)) {
    throw new SkillValidationError(
      `Directory "${dirName}" is not a valid skill name (lowercase letters, digits and hyphens, 1–64 characters).`,
      { skill: dirName },
    );
  }

  const skillMdPath = join(root, dirName, 'SKILL.md');
  let raw;
  try {
    raw = readFileSync(skillMdPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new SkillValidationError(`"${dirName}" has no SKILL.md.`, { skill: dirName });
    }
    throw err;
  }

  const frontmatter = parseFrontmatter(raw.toString('utf-8'));
  const name = frontmatter.name || dirName;

  if (!NAME_PATTERN.test(name)) {
    throw new SkillValidationError(
      `SKILL.md "name" field "${name}" is not a valid skill name (lowercase letters, digits and hyphens, 1–64 characters).`,
      { skill: dirName },
    );
  }
  if (frontmatter.name && frontmatter.name !== dirName) {
    throw new SkillValidationError(
      `SKILL.md "name" is "${frontmatter.name}" but the directory is "${dirName}". Agents resolve a skill by its URL, so the two must match.`,
      { skill: dirName },
    );
  }

  const description = frontmatter.description || '';
  if (!description) {
    throw new SkillValidationError(
      `"${dirName}" has no "description" in its SKILL.md frontmatter. Agents use it to decide whether to load the skill at all.`,
      { skill: dirName },
    );
  }

  const descriptionBytes = Buffer.byteLength(description, 'utf-8');
  if (descriptionBytes > MAX_DESCRIPTION_BYTES) {
    throw new SkillValidationError(
      `"${dirName}" description is ${descriptionBytes} bytes, over the ${MAX_DESCRIPTION_BYTES}-byte limit.`,
      { skill: dirName },
    );
  }

  const path = `${urlPrefix.replace(/\/$/, '')}/${dirName}/SKILL.md`;
  const url = baseUrl ? new URL(path, baseUrl).toString() : path;

  return {
    name,
    type: 'skill-md',
    description,
    url,
    digest: `sha256:${sha256Hex(raw)}`,
  };
}

/**
 * Build the full manifest for every skill under `root`.
 *
 * @param {string} root Directory holding `<skill-name>/SKILL.md` subdirectories.
 * @param {object} [options]
 * @param {string} [options.baseUrl] Emit absolute URLs against this origin.
 * @param {string} [options.urlPrefix] Path prefix skills are served under.
 * @returns {{ $schema: string, skills: object[] }}
 */
export function buildIndex(root, options = {}) {
  const skills = listSkillDirs(root)
    .map((dirName) => buildSkillEntry(root, dirName, options))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  return { $schema: SCHEMA_URL, skills };
}

/** Serialise a manifest the way the CLI writes it: 2-space indent, trailing newline. */
export function serialiseIndex(manifest) {
  return JSON.stringify(manifest, null, 2) + '\n';
}
