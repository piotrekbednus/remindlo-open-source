// Exercises the HTTP wrapper against a stubbed global fetch — no network.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { RemindloClient } from '../dist/api-client.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Capture the calls the client makes and reply with a canned JSON body. */
function stubFetch(body, { status = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { status, json: async () => body };
  };
  return calls;
}

const textOf = (result) => result.content.map((part) => part.text).join('\n');

describe('request plumbing', () => {
  test('authenticates with x-api-key against the public API base', async () => {
    const calls = stubFetch({ success: true, campaigns: [] });
    await new RemindloClient('sk_live_test').listCampaigns();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.remindlo.co.uk/v1/campaigns');
    assert.equal(calls[0].options.headers['x-api-key'], 'sk_live_test');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  });

  test('turns a transport failure into a NETWORK_ERROR message', async () => {
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const result = await new RemindloClient('k').listCampaigns();
    assert.match(textOf(result), /Network error: ECONNREFUSED/);
  });

  test('turns a non-JSON response into an actionable message with the status', async () => {
    globalThis.fetch = async () => ({
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    const result = await new RemindloClient('k').listCampaigns();
    assert.match(textOf(result), /non-JSON response \(HTTP 502\)/);
  });

  test('surfaces an API error message instead of a generic failure', async () => {
    stubFetch({ success: false, error: { code: 'INVALID_PHONE_FORMAT', message: 'Phone must be E.164' } });
    const result = await new RemindloClient('k').upsertContact({ phone: '07912345678' });
    assert.match(textOf(result), /Phone must be E\.164/);
  });
});

describe('listCampaigns', () => {
  test('formats campaigns with their ids so the agent can enrol contacts', async () => {
    stubFetch({
      success: true,
      campaigns: [
        { id: 'camp-1', name: 'Dental 6-month', type: 'recurring', status: 'running' },
        { id: 'camp-2', name: 'Post-visit thanks', type: 'recurring', status: 'paused' },
      ],
    });
    const text = textOf(await new RemindloClient('k').listCampaigns());

    assert.match(text, /Found 2 campaign\(s\)/);
    assert.match(text, /Dental 6-month/);
    assert.match(text, /camp-1/);
    assert.match(text, /paused/);
  });

  test('points the user at the dashboard when there are no campaigns', async () => {
    stubFetch({ success: true, campaigns: [] });
    assert.match(textOf(await new RemindloClient('k').listCampaigns()), /No campaigns found/);
  });
});

describe('getContact endpoint selection', () => {
  test('looks up by id on the path', async () => {
    const calls = stubFetch({ success: true, contact: { id: 'c1' } });
    await new RemindloClient('k').getContact({ contact_id: 'c1' });
    assert.equal(calls[0].url, 'https://api.remindlo.co.uk/v1/contacts/c1');
  });

  test('looks up by phone on the query string, URL-encoded', async () => {
    const calls = stubFetch({ success: true, contact: { id: 'c1' } });
    await new RemindloClient('k').getContact({ phone: '+447912345678' });
    // The leading + must survive as %2B or the API reads it as a space.
    assert.equal(calls[0].url, 'https://api.remindlo.co.uk/v1/contacts?phone=%2B447912345678');
  });

  test('looks up by email on the query string', async () => {
    const calls = stubFetch({ success: true, contact: { id: 'c1' } });
    await new RemindloClient('k').getContact({ email: 'a+b@example.com' });
    assert.equal(calls[0].url, 'https://api.remindlo.co.uk/v1/contacts?email=a%2Bb%40example.com');
  });
});

describe('upsertContact', () => {
  test('sends the input as a JSON body on POST', async () => {
    const calls = stubFetch({
      success: true,
      contact_id: 'c1',
      action: 'created',
      contact: { id: 'c1', first_name: 'Sarah' },
    });
    await new RemindloClient('k').upsertContact({ phone: '+447912345678', first_name: 'Sarah' });

    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      phone: '+447912345678',
      first_name: 'Sarah',
    });
  });
});
