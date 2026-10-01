// Loaded by the popup and serialized by executeScript. Keep this self-contained.
async function fillCardForm(cardData) {
  const fields = [
    { selector: '#cardholderName, input[name="cardholderName"], input[autocomplete="cc-name"]', key: 'name', label: 'cardholder name' },
    { selector: '#cardNumber, input[name="cardNumber"], input[autocomplete="cc-number"]', key: 'number', label: 'card number' },
    { selector: '#cardCvv, input[name="cardCvv"], input[name="cvv"], input[name="cvc"], input[autocomplete="cc-csc"]', key: 'cvv', label: 'CVV' },
    { selector: '#ExpMonthSelect, select[name="expMonth"], select[autocomplete="cc-exp-month"]', key: 'month', label: 'expiry month' },
    { selector: '#ExpYearSelect, select[name="expYear"], select[autocomplete="cc-exp-year"]', key: 'year', label: 'expiry year' }
  ];
  const find = field => {
    const matches = Array.from(document.querySelectorAll(field.selector))
      .filter(element => !element.disabled && !element.readOnly &&
        (element.getClientRects().length || (element.tagName === 'SELECT' && element.closest('.custom-select')?.getClientRects().length)));
    return matches.length === 1 ? matches[0] : null;
  };
  const foundCount = () => fields.filter(find).length;
  if (!cardData) return { foundCount: foundCount() };
  for (let attempt = 0; attempt < 15 && foundCount() < fields.length; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  const normalize = (field, value) => ['month', 'year'].includes(field.key) ? String(Number(value)) :
    field.key === 'number' ? String(value).replace(/\s/g, '') : String(value).trim();
  const attempted = new Set();
  for (const field of fields) {
    const element = find(field);
    if (!element) continue;
    try {
      let value = cardData[field.key];
      if (element.tagName === 'SELECT') {
        const option = Array.from(element.options).find(item => !item.disabled && normalize(field, item.value) === normalize(field, value));
        if (!option) continue;
        value = option.value;
        const custom = element.closest('.custom-select');
        const customOption = Array.from(custom?.querySelectorAll('.select-items div') || [])
          .find(item => item.textContent.trim() === option.textContent.trim());
        if (customOption) customOption.click();
      }
      const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      attempted.add(field.key);
    } catch {
      // Report the field name only, never its value.
    }
  }
  await new Promise(resolve => setTimeout(resolve, 150));
  const missing = fields.filter(field => {
    const element = find(field);
    if (!attempted.has(field.key) || !element || normalize(field, element.value) !== normalize(field, cardData[field.key])) return true;
    if (element.tagName === 'SELECT') {
      const display = element.closest('.custom-select')?.querySelector('.select-selected');
      const option = Array.from(element.options).find(item => item.value === element.value);
      if (display && display.textContent.trim() !== option?.textContent.trim()) return true;
    }
    return false;
  }).map(field => field.label);
  return { success: missing.length === 0, filledCount: fields.length - missing.length, missing };
}
