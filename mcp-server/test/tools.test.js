// Runs against the compiled output in dist/, which is what npm actually ships.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { tools, handleToolCall } from '../dist/tools.js';

const TOOL_NAMES = ['list_campaigns', 'upsert_contact', 'get_contact', 'send_message', 'list_contacts'];

/**
 * Run `fn` with a fetch that refuses to work, so a call that reaches the
 * network is unmistakable. Must await inside the try — restoring fetch
 * synchronously would hand the real one back before the awaited call uses it,
 * and the test would quietly hit the live API.
 */
async function withForbiddenFetch(fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('FORBIDDEN_FETCH');
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const textOf = (result) => result.content.map((part) => part.text).join('\n');

describe('tool definitions', () => {
  test('exposes exactly the documented tools', () => {
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOL_NAMES].sort());
  });

  test('every tool has a description and an object input schema', () => {
    for (const tool of tools) {
      assert.ok(tool.description, `${tool.name} has no description`);
      assert.equal(tool.inputSchema.type, 'object', `${tool.name} schema is not an object`);
      assert.ok(tool.inputSchema.properties, `${tool.name} has no properties`);
    }
  });

  test('every declared required field exists in properties', () => {
    for (const tool of tools) {
      for (const field of tool.inputSchema.required ?? []) {
        assert.ok(
          Object.hasOwn(tool.inputSchema.properties, field),
          `${tool.name} requires "${field}" but never declares it`,
        );
      }
    }
  });

  test('send_message requires both a contact and a body', () => {
    const sendMessage = tools.find((t) => t.name === 'send_message');
    assert.deepEqual([...sendMessage.inputSchema.required].sort(), ['body', 'contact_id']);
  });

  test('upsert_contact documents E.164 for the phone field', () => {
    const upsert = tools.find((t) => t.name === 'upsert_contact');
    assert.match(upsert.inputSchema.properties.phone.description, /E\.164/);
  });
});

describe('safety annotations', () => {
  const byName = (name) => tools.find((t) => t.name === name);

  test('every tool is annotated', () => {
    for (const tool of tools) {
      assert.ok(tool.annotations, `${tool.name} has no annotations`);
      assert.equal(typeof tool.annotations.title, 'string');
      assert.equal(typeof tool.annotations.readOnlyHint, 'boolean');
    }
  });

  test('the read-only tools are marked read-only', () => {
    for (const name of ['list_campaigns', 'get_contact', 'list_contacts']) {
      assert.equal(byName(name).annotations.readOnlyHint, true, `${name} should be read-only`);
    }
  });

  test('the writing tools are not marked read-only', () => {
    for (const name of ['upsert_contact', 'send_message']) {
      assert.equal(byName(name).annotations.readOnlyHint, false, `${name} writes`);
    }
  });

  test('neither writing tool destroys data', () => {
    for (const name of ['upsert_contact', 'send_message']) {
      assert.equal(byName(name).annotations.destructiveHint, false);
    }
  });

  test('upsert_contact is idempotent, send_message is not', () => {
    // The distinction that costs money: a retried upsert converges on the same
    // contact, a retried send bills another SMS segment.
    assert.equal(byName('upsert_contact').annotations.idempotentHint, true);
    assert.equal(byName('send_message').annotations.idempotentHint, false);
  });

  test('only send_message reaches outside the account', () => {
    assert.equal(byName('send_message').annotations.openWorldHint, true);
    for (const name of ['list_campaigns', 'get_contact', 'list_contacts', 'upsert_contact']) {
      assert.equal(byName(name).annotations.openWorldHint, false, `${name} stays within the account`);
    }
  });

  test('read-only tools do not carry write-only hints', () => {
    // destructiveHint and idempotentHint are meaningful only when
    // readOnlyHint is false; setting them elsewhere just misleads a reader.
    for (const name of ['list_campaigns', 'get_contact', 'list_contacts']) {
      const { annotations } = byName(name);
      assert.equal(annotations.destructiveHint, undefined, `${name} should not set destructiveHint`);
      assert.equal(annotations.idempotentHint, undefined, `${name} should not set idempotentHint`);
    }
  });
});

describe('handleToolCall validation', () => {
  test('upsert_contact needs a phone or an email', async () => {
    const result = await withForbiddenFetch(() => handleToolCall('upsert_contact', { first_name: 'Sarah' }, 'k'));
    assert.match(textOf(result), /At least one of phone or email is required/);
  });

  test('upsert_contact accepts an email alone', async () => {
    // Past validation the client tries to call the API, and turns the refused
    // fetch into a network error — which is how we know validation let it through.
    const result = await withForbiddenFetch(() =>
      handleToolCall('upsert_contact', { email: 'a@b.test' }, 'k'),
    );
    assert.match(textOf(result), /Network error: FORBIDDEN_FETCH/);
  });

  test('get_contact needs at least one identifier', async () => {
    const result = await withForbiddenFetch(() => handleToolCall('get_contact', {}, 'k'));
    assert.match(textOf(result), /At least one of contact_id, phone, or email is required/);
  });

  test('send_message reports a missing contact_id', async () => {
    const result = await withForbiddenFetch(() => handleToolCall('send_message', { body: 'hi' }, 'k'));
    assert.match(textOf(result), /contact_id is required/);
  });

  test('send_message reports a missing body', async () => {
    const result = await withForbiddenFetch(() => handleToolCall('send_message', { contact_id: 'c1' }, 'k'));
    assert.match(textOf(result), /body is required/);
  });

  test('an unknown tool name is reported rather than thrown', async () => {
    const result = await withForbiddenFetch(() => handleToolCall('delete_everything', {}, 'k'));
    assert.match(textOf(result), /Unknown tool: delete_everything/);
  });

  test('validation errors are returned as content, never as a rejection', async () => {
    const result = await withForbiddenFetch(() => handleToolCall('get_contact', {}, 'k'));
    assert.ok(Array.isArray(result.content));
    assert.equal(result.content[0].type, 'text');
  });
});
