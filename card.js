// Card data never goes to logs or to a fallback clipboard script.
document.addEventListener('DOMContentLoaded', () => {
  initializeCardTab().catch(() => showNotification('Saved card information could not be loaded.', true));
});

async function initializeCardTab() {
  const year = document.getElementById('expYear');
  const currentYear = new Date().getFullYear();
  for (let value = currentYear; value < currentYear + 15; value++) {
    year.add(new Option(String(value), String(value)));
  }
  const fields = ['cardholderName', 'cardNumber', 'expMonth', 'expYear'];
  for (const field of [...fields, 'cardCvv']) {
    document.getElementById(field).addEventListener('input', event => {
      if (field === 'cardNumber') {
        const digits = event.target.value.replace(/\D/g, '').slice(0, 19);
        event.target.value = digits.match(/.{1,4}/g)?.join(' ') || '';
      }
      if (field === 'cardCvv') event.target.value = event.target.value.replace(/\D/g, '');
      updateStatusIndicators();
      updateCardPreview();
      if (field !== 'cardCvv' && globalThis.chrome?.storage) {
        chrome.storage.local.set({ [field]: event.target.value })
          .catch(() => showNotification('Your changes could not be saved on this device.', true));
      }
    });
  }
  document.getElementById('fill-form').addEventListener('click', fillPaymentForm);
  document.getElementById('test-extension').addEventListener('click', () =>
    runAction('test-extension', 'Checking payment fields…', async () => {
      const result = await executePage(fillCardForm, [null]);
      showNotification(result.foundCount === 5 ? 'All 5 payment fields are available.' :
        `Found ${result.foundCount}/5 payment fields. Open the payment form. Embedded payment frames are not supported.`, result.foundCount !== 5);
    }));
  document.getElementById('clear-card').addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove([...fields, 'cardCvv']);
      for (const field of [...fields, 'cardCvv']) document.getElementById(field).value = '';
      updateStatusIndicators();
      updateCardPreview();
      showNotification('Saved card information cleared.');
    } catch {
      showNotification('Saved card information could not be cleared.', true);
    }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !document.getElementById('cards').hidden) {
      event.preventDefault();
      fillPaymentForm();
    }
  });
  if (!globalThis.chrome?.storage) return;
  // Remove CVVs persisted by previous versions; never restore or save them.
  await chrome.storage.local.remove('cardCvv');
  const data = await chrome.storage.local.get(fields);
  for (const field of fields) {
    const element = document.getElementById(field);
    if (!element.value && data[field]) element.value = data[field];
  }
  updateStatusIndicators();
  updateCardPreview();
}

function updateCardPreview() {
  const name = document.getElementById('cardholderName').value;
  const number = document.getElementById('cardNumber').value.replace(/\D/g, '');
  const month = document.getElementById('expMonth').value;
  const year = document.getElementById('expYear').value;
  document.getElementById('previewName').textContent = name || 'CARDHOLDER NAME';
  document.getElementById('previewNumber').textContent = number.length >= 4 ? `•••• •••• •••• ${number.slice(-4)}` : '•••• •••• •••• ••••';
  document.getElementById('previewExpiry').textContent = month && year ? `${month.padStart(2, '0')}/${year.slice(-2)}` : 'MM/YY';
  document.getElementById('cardPreview').classList.toggle('hidden', !(name || number || month || year));
}

function fillPaymentForm() {
  return runAction('fill-form', 'Filling payment fields…', async () => {
    const data = {
      name: document.getElementById('cardholderName').value.trim(),
      number: document.getElementById('cardNumber').value.replace(/\s/g, ''),
      cvv: document.getElementById('cardCvv').value.trim(),
      month: document.getElementById('expMonth').value,
      year: document.getElementById('expYear').value
    };
    if (!data.name || !data.month || !data.year || !/^\d{13,19}$/.test(data.number) || !/^\d{3,4}$/.test(data.cvv)) {
      throw new Error('Complete all card fields, using a 13–19 digit card number and a 3–4 digit CVV.');
    }
    const now = new Date();
    if (Number(data.year) < now.getFullYear() ||
        (Number(data.year) === now.getFullYear() && Number(data.month) < now.getMonth() + 1)) {
      throw new Error('The expiry date is in the past. Check the month and year.');
    }
    const result = await executePage(fillCardForm, [data]);
    showNotification(result.success ? 'All 5 payment fields filled. Review the page before paying.' :
      `Filled ${result.filledCount}/5 fields. Check: ${result.missing.join(', ')}. Embedded payment frames are not supported.`, !result.success);
  });
}
