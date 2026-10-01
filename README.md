# Token Copier & Card Auto-Fill

A Chrome Manifest V3 popup for copying Smart Pass and Third Party tokens from a page's `staticData`, filling TAMM driving license fields, and filling supported payment forms. Smart Pass is the first action; Third Party is second.

## Install or reload

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Choose **Load unpacked** and select this folder. If already installed, use its **Reload** button after updating these files.
3. Pin **Token Copier & Card Auto-Fill** from Chrome's Extensions menu.
4. Open the relevant signed-in TAMM page or payment form, then click the extension icon.

The popup must be opened as an installed extension. Opening `popup.html` as a normal file does not provide Chrome extension APIs. Chrome 95 or later is required.

## When something fails

| Symptom | Explanation and next step |
| --- | --- |
| Popup opens, but copying fails | The page may lack `staticData`, lack the requested token, still be loading, or have an expired session. The extension now waits briefly and distinguishes missing data from successful copying. |
| Popup opens, but filling fails | The expected fields may be absent, read-only, ambiguous, changed by TAMM, or inside an iframe. Open the actual form and use **Check Payment Fields** for payment diagnostics. Partial fills now show a field count instead of full success. |
| Chrome blocks the action | Internal Chrome pages and the Chrome Web Store do not permit these actions. On a normal web page, reopen the extension there and check its site access settings. |
| Popup closes after clicking elsewhere | This is normal Chrome popup behavior. Keep it open until the action reports a result. |
| Clicking the icon shows no popup at all | Verify that this extension is enabled in the current Chrome profile, reload it at `chrome://extensions`, and inspect its **Errors** entry if present. If it happens only in Incognito, check **Allow in Incognito**. Record whether an empty popup appears or no popup appears; page injection failures alone do not explain a missing popup. |

The manifest always declares `popup.html`; this repository has no code that disables the popup or closes its window. Intermittent failure to open has **not been reproduced**. Checking the installed instance and Chrome's extension errors is still necessary before assigning a cause.

## Review and changes

- Guard active-tab access, injection failures, missing results, empty tokens and clipboard errors. Use `textContent` for embedded JSON, including hidden script elements, and retry briefly while the page loads.
- Keep the existing multi-step license-fill approach, add field readiness checks, reject ambiguous dropdowns, and verify the selected emirate.
- Verify payment field values after dispatching native input/change events. Do not report partial fills as complete. Diagnostics only inspect fields; they do not fill them.
- Improve button contrast, visible keyboard focus, tab roles and arrow/Home/End navigation. Status messages stay in the layout and are announced through a live region. Decorative indicators no longer convey state by color alone. Controls have a minimum height of 44 pixels; expiry years are generated from the current year.
- Stop saving or restoring CVV, remove legacy saved CVV when the popup initializes, mask CVV entry and card preview, remove sensitive console logging, and remove the automatic payment-script clipboard fallback.
- Remove blanket `<all_urls>` access and unnecessary web-accessible resources. Actions use `activeTab` when the user opens the extension on a page. There is no background automation.

The original primary button's white text had approximately **2.89:1** contrast at its darker endpoint and **1.41:1** at its lighter endpoint. The replacement is approximately **7.94:1**. These changes address specific accessibility issues; they do not establish full WCAG conformance. Manual Chrome, screen-reader, zoom and live TAMM checks remain necessary.

Name, card number and expiry still save locally, without encryption by this extension, to preserve the existing convenience feature. The UI discloses this and offers **Clear Saved Card**. This is not a payment-security compliance certification. License information saves when Fill is used. Tokens are copied only on request and are not stored by the extension.

## Can it automate TAMM work?

Yes, as an **assisted form-filling tool**: it can repeat supported license/card entry and expose missing fields before the user continues. It never submits forms or pays automatically. Token copying is separate from form filling; UI automation does not require copying a token.

It is not currently a general TAMM workflow engine. A specific multi-step service would need a page-by-page adapter, validation, navigation handling, progress recovery, and testing against that service. A persistent side panel could keep workflow controls available while the user interacts with the page; the current popup disappears when focus leaves it. Any API-based integration would need a documented, authorized interface rather than assuming a copied session token is a supported integration contract. Login, OTP and final submission/payment steps remain user-driven in this version.

Current limits: only the top document is targeted; embedded payment frames, shadow DOM, arbitrary forms and all Arabic label variants are not supported. Layout or selector changes on TAMM can require updates. No live signed-in TAMM workflow was exercised during this review.

## Verification

Run the dependency-free regression tests with Node.js:

```sh
node --test tests/extension.test.cjs
```

The tests use mocked Chrome APIs and DOM fixtures, including serialized page functions. They cover token readiness/failure cases, inaccessible tabs, clipboard failures, action locking, keyboard tabs, CVV storage behavior, payment verification and license dropdown ambiguity. They are not a substitute for loading the extension in Chrome.

After reloading, manually check Smart Pass/Third Party order, copying on a signed-in page, a missing-token page, license filling, partial payment forms, keyboard navigation, and closing/reopening the popup. Use test payment data in a test environment. For an intermittent opening failure, inspect Chrome's extension errors before dismissing them; redact tokens and personal/payment data if sharing diagnostics.

References: [Chrome popup behavior](https://developer.chrome.com/docs/extensions/develop/ui/add-popup), [activeTab permissions](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [script injection and frame targeting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), and [WCAG text contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).
