// Shared popup helpers. Page functions passed to executePage must be self-contained.
async function getActivePage() {
  if (!globalThis.chrome?.tabs || !chrome.scripting) {
    throw new Error('Load this folder as an extension in Chrome, then open it from the toolbar.');
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!Number.isInteger(tab?.id)) {
    throw new Error('No active page found. Select the TAMM tab and reopen the extension.');
  }
  if (tab.url) {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol) ||
        url.hostname === 'chromewebstore.google.com' ||
        (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) {
      throw new Error('This Chrome page does not allow extension actions. Open the TAMM or payment page first.');
    }
  }
  return tab;
}

async function executePage(func, args = []) {
  const tab = await getActivePage();
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  } catch (error) {
    if (/cannot access|permission|extensions gallery/i.test(error.message)) {
      throw new Error('Chrome blocked access. Open the target page, click the extension icon again, and check its site access settings.');
    }
    throw new Error('The page could not be reached. Wait for it to finish loading, then reopen the extension and retry.');
  }
  if (!results?.[0] || results[0].result === undefined) {
    throw new Error('The page returned no result. It may have navigated; reopen the extension and retry.');
  }
  return results[0].result;
}

let actionRunning = false;
async function runAction(buttonId, pendingMessage, action) {
  if (actionRunning) return;
  actionRunning = true;
  const button = document.getElementById(buttonId);
  const buttons = document.querySelectorAll('[data-page-action]');
  buttons.forEach(item => { item.disabled = true; });
  button?.setAttribute('aria-busy', 'true');
  showNotification(pendingMessage);
  try {
    await action();
  } catch (error) {
    showNotification(error.message || 'The action failed. Please try again.', true);
  } finally {
    actionRunning = false;
    buttons.forEach(item => { item.disabled = false; });
    button?.removeAttribute('aria-busy');
  }
}

// Script elements can have empty innerText; textContent also works for hidden JSON.
async function readPageToken(key) {
  let state = 'missing';
  for (let attempt = 0; attempt < 15; attempt++) {
    const element = document.getElementById('staticData');
    if (element) {
      try {
        const token = JSON.parse(element.textContent).smartpassData?.[key];
        if (typeof token === 'string' && token.trim()) return { token: token.trim() };
        state = 'empty';
      } catch {
        state = 'invalid';
      }
    }
    if (attempt < 14) await new Promise(resolve => setTimeout(resolve, 150));
  }
  const errors = {
    missing: 'No TAMM token data found. Open a signed-in TAMM page and try again.',
    empty: 'This token is unavailable on the current page. Check your TAMM sign-in and retry.',
    invalid: 'The page token data could not be read. Let the page finish loading or refresh it.'
  };
  return { error: errors[state] };
}
