const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

function element(value = '') {
  return {
    value, disabled: false, hidden: false, dataset: {}, attributes: {}, listeners: {},
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    focus() { this.focused = true; },
    add() {}
  };
}
function popup(overrides = {}) {
  const elements = {};
  for (const id of source('popup.html').matchAll(/id="([^"]+)"/g)) elements[id[1]] = element();
  elements['tab-tokens'].dataset.tab = 'tokens';
  elements['tab-cards'].dataset.tab = 'cards';
  const buttons = ['copy-smart-pass', 'copy-third-party', 'add-info', 'fill-form', 'test-extension'].map(id => elements[id]);
  const writes = [], removed = [], stored = [];
  const context = vm.createContext({
    URL, Date, Option: function() {},
    setTimeout: callback => { callback(); return 1; },
    document: {
      addEventListener() {}, getElementById: id => elements[id],
      querySelectorAll: selector => selector === '.tab-btn' ? [elements['tab-tokens'], elements['tab-cards']] : buttons
    },
    chrome: {
      tabs: { query: async () => [{ id: 12, url: 'https://www.tamm.abudhabi/' }] },
      scripting: { executeScript: async () => [{ result: { token: 'fake-token' } }] },
      storage: { local: {
        get: async () => ({}), set: async data => stored.push(data), remove: async keys => removed.push(keys)
      } }
    },
    navigator: { clipboard: { writeText: async value => writes.push(value) } },
    ...overrides
  });
  for (const file of ['extension.js', 'content-script.js', 'popup.js', 'card.js']) vm.runInContext(source(file), context);
  return { context, elements, buttons, writes, removed, stored };
}

test('popup assets exist and all JavaScript parses', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  const html = source(manifest.action.default_popup);
  for (const [, file] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    if (file.endsWith('.js')) new vm.Script(source(file), { filename: file });
  }
  assert.ok(html.indexOf('id="copy-smart-pass"') < html.indexOf('id="copy-third-party"'));
});

test('missing active tabs, restricted pages, and missing APIs produce actionable errors', async () => {
  const { context } = popup();
  context.chrome.tabs.query = async () => [];
  await assert.rejects(context.getActivePage(), /No active page/);
  for (const url of ['chrome://extensions', 'file:///tmp/test.html', 'https://chromewebstore.google.com/detail/test']) {
    context.chrome.tabs.query = async () => [{ id: 1, url }];
    await assert.rejects(context.getActivePage(), /does not allow/);
  }
  context.chrome = undefined;
  await assert.rejects(context.getActivePage(), /Load this folder/);
});

test('execution errors and empty responses are handled', async () => {
  const { context } = popup();
  context.chrome.scripting.executeScript = async () => [];
  await assert.rejects(context.executePage(() => {}), /no result/);
  context.chrome.scripting.executeScript = async () => { throw new Error('Cannot access contents'); };
  await assert.rejects(context.executePage(() => {}), /Chrome blocked/);
});

test('token reader uses hidden script text and waits for delayed page data', async () => {
  let attempts = 0;
  const { context } = popup();
  context.document.getElementById = () => ++attempts < 3 ? null : {
    innerText: '', textContent: JSON.stringify({ smartpassData: { SmartPassToken: ' sample ' } })
  };
  assert.equal((await context.readPageToken('SmartPassToken')).token, 'sample');
  assert.equal(attempts, 3);
});

test('missing, malformed and empty token data never count as success', async () => {
  const { context } = popup();
  for (const data of [null, '{broken', '{}', '{"smartpassData":{"SmartPassToken":42}}', '{"smartpassData":{"SmartPassToken":" "}}']) {
    context.document.getElementById = () => data === null ? null : { textContent: data };
    const result = await context.readPageToken('SmartPassToken');
    assert.ok(result.error);
    assert.equal(result.token, undefined);
  }
});

test('copying never overwrites clipboard for an empty token and recovers from clipboard errors', async () => {
  const { context, elements, writes, buttons } = popup();
  context.chrome.scripting.executeScript = async () => [{ result: { token: '' } }];
  await context.getToken('SmartPassToken');
  assert.equal(writes.length, 0);
  assert.match(elements.notification.textContent, /No token/);
  context.chrome.scripting.executeScript = async () => [{ result: { token: 'sample' } }];
  context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await context.getToken('SmartPassToken');
  assert.match(elements.notification.textContent, /Clipboard access failed/);
  assert.ok(buttons.every(button => !button.disabled));
});

test('copy actions retain their distinct token keys', async () => {
  const { context, writes } = popup();
  context.chrome.scripting.executeScript = async ({ args }) => [{ result: { token: args[0] } }];
  await context.getToken('SmartPassToken');
  await context.getToken('ThirdPartyToken');
  assert.deepEqual(writes, ['SmartPassToken', 'ThirdPartyToken']);
});

test('concurrent actions are blocked and controls recover after failure', async () => {
  const { context, buttons } = popup();
  let finish, calls = 0;
  const running = context.runAction('fill-form', 'Working', () => new Promise(resolve => { finish = resolve; }));
  assert.ok(buttons.every(button => button.disabled));
  await context.runAction('fill-form', 'Working', async () => calls++);
  assert.equal(calls, 0);
  finish();
  await running;
  await context.runAction('fill-form', 'Working', async () => { throw new Error('Failed'); });
  assert.ok(buttons.every(button => !button.disabled));
});

test('tabs support arrows, Home/End, focus, and synchronized ARIA states', () => {
  const { context, elements } = popup();
  context.initializeTabs();
  elements['tab-tokens'].listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
  assert.equal(elements['tab-cards'].attributes['aria-selected'], 'true');
  assert.equal(elements['tab-tokens'].tabIndex, -1);
  assert.equal(elements.tokens.hidden, true);
  assert.equal(elements.cards.hidden, false);
  assert.equal(elements['tab-cards'].focused, true);
  elements['tab-cards'].listeners.keydown({ key: 'Home', preventDefault() {} });
  assert.equal(elements.tokens.hidden, false);
});

test('card initialization removes legacy CVV and does not save CVV edits', async () => {
  const { context, elements, removed, stored } = popup();
  await context.initializeCardTab();
  assert.ok(removed.includes('cardCvv'));
  elements.cardCvv.value = '123';
  elements.cardCvv.listeners.input({ target: elements.cardCvv });
  assert.equal(stored.length, 0);
  elements.cardholderName.value = 'Test User';
  elements.cardholderName.listeners.input({ target: elements.cardholderName });
  assert.equal(stored[0].cardholderName, 'Test User');
});

function paymentPage({ absent = [], reject = [], duplicates = [] } = {}) {
  class Input {
    constructor(value = '') { this._value = value; this.tagName = 'INPUT'; this.events = []; }
    get value() { return this._value; }
    set value(value) { this._value = value; }
    getClientRects() { return [1]; }
    closest() { return null; }
    dispatchEvent(event) { this.events.push(event.type); if (this.reject) this._value = ''; }
  }
  class Select extends Input {
    constructor(value) { super(); this.tagName = 'SELECT'; this.options = [{ value, textContent: value }]; }
    get value() { return this._value; }
    set value(value) { this._value = this.options.some(option => option.value === value) ? value : ''; }
  }
  const ids = ['cardholderName', 'cardNumber', 'cardCvv', 'ExpMonthSelect', 'ExpYearSelect'];
  const elements = Object.fromEntries(ids.map(id => [id, id === 'ExpMonthSelect' ? new Select('01') : id === 'ExpYearSelect' ? new Select('2030') : new Input()]));
  for (const id of absent) delete elements[id];
  for (const id of reject) elements[id].reject = true;
  const context = vm.createContext({
    HTMLInputElement: Input, HTMLSelectElement: Select, Event: class { constructor(type) { this.type = type; } },
    setTimeout: callback => callback(),
    document: { querySelectorAll(selector) {
      const id = selector.match(/^#([^,]+)/)[1];
      return elements[id] ? duplicates.includes(id) ? [elements[id], new Input()] : [elements[id]] : [];
    } }
  });
  vm.runInContext(source('content-script.js'), context);
  return { context, elements };
}
const card = { name: 'Test User', number: '4111111111111111', cvv: '123', month: '1', year: '2030' };

test('payment filler verifies five fields, normalizes padded months and dispatches input events', async () => {
  const { context, elements } = paymentPage();
  const result = await context.fillCardForm(card);
  assert.equal(result.success, true);
  assert.equal(result.filledCount, 5);
  assert.equal(elements.ExpMonthSelect.value, '01');
  assert.deepEqual(elements.cardNumber.events, ['input', 'change', 'blur']);
});

test('payment checks are read-only and partial, rejected or ambiguous fills are not success', async () => {
  for (const options of [{ absent: ['cardCvv'] }, { reject: ['cardCvv'] }, { duplicates: ['cardCvv'] }]) {
    const { context, elements } = paymentPage(options);
    const check = await context.fillCardForm(null);
    assert.ok(check.foundCount >= 4);
    assert.equal(elements.cardNumber.value, '');
    const result = await context.fillCardForm(card);
    assert.equal(result.success, false);
    assert.equal(result.filledCount, 4);
    assert.equal(result.missing[0], 'CVV');
    assert.ok(!JSON.stringify(result).includes(card.number));
    assert.ok(!JSON.stringify(result).includes(card.cvv));
  }
});

test('license action waits for fields and verifies actual emirate selection without clicking ambiguous dropdowns', async () => {
  for (const mode of ['success', 'rejected', 'ambiguous', 'disabled']) {
    const { context, elements } = popup();
    context.initializeTokensTab();
    elements.licenseNumber.value = '12345';
    elements.emirateSelect.value = 'Dubai';
    let checks = 0, clicks = 0;
    class Input {
      constructor() { this._value = ''; this.disabled = mode === 'disabled'; }
      get value() { return this._value; }
      set value(value) { this._value = value; }
      focus() {} click() {} select() {} dispatchEvent() {}
    }
    const input = new Input();
    const dropdown = { textContent: 'Select driving licence emirate', isConnected: true,
      getClientRects: () => [1], getAttribute: () => null, click() { clicks++; } };
    const option = { textContent: 'Dubai', click() { if (mode !== 'rejected') dropdown.textContent = 'Dubai'; } };
    if (mode === 'ambiguous') dropdown.textContent = 'Select';
    const page = vm.createContext({
      window: { HTMLInputElement: Input },
      Event: class {}, KeyboardEvent: class {},
      setTimeout: callback => callback(),
      document: {
        querySelector: selector => selector.includes('DrivingLicenseNumber') ? ++checks < 3 ? null : input : null,
        querySelectorAll: selector => selector.includes('options-item') ? [option] : mode === 'ambiguous' ? [dropdown, { ...dropdown }] : [dropdown]
      }
    });
    context.chrome.scripting.executeScript = async ({ func, args }) => {
      const injected = vm.runInContext(`(${func.toString()})`, page);
      return [{ result: await injected(...args) }];
    };
    await elements['add-info'].listeners.click();
    if (mode === 'success') {
      assert.match(elements.notification.textContent, /License and emirate filled/);
      assert.equal(input.value, '12345');
    } else {
      assert.doesNotMatch(elements.notification.textContent, /License and emirate filled/);
    }
    if (mode === 'ambiguous' || mode === 'disabled') assert.equal(clicks, 0);
    if (mode === 'disabled') assert.equal(input.value, '');
  }
});

test('a stale custom dropdown display is reported as an incomplete payment fill', async () => {
  const { context, elements } = paymentPage();
  const display = { textContent: 'Select month' };
  elements.ExpMonthSelect.closest = () => ({ querySelectorAll: () => [], querySelector: () => display });
  const result = await context.fillCardForm(card);
  assert.equal(result.success, false);
  assert.equal(result.filledCount, 4);
  assert.equal(result.missing[0], 'expiry month');
});
