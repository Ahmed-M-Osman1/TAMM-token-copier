// Card Auto-Fill Functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeCardTab();
});

function initializeCardTab() {
    loadCardData();
    setupCardEventListeners();
    updateCardPreview();
}

function setupCardEventListeners() {
    // Card number formatting and validation
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;

            if (formattedValue !== e.target.value) {
                e.target.value = formattedValue;
            }

            saveCardField('cardNumber', value);
            updateStatusIndicators();
            updateCardPreview();
        });
    }

    // CVV numeric only
    const cardCvvInput = document.getElementById('cardCvv');
    if (cardCvvInput) {
        cardCvvInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            saveCardField('cardCvv', e.target.value);
            updateStatusIndicators();
        });
    }

    // Save other card fields
    ['cardholderName', 'expMonth', 'expYear'].forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            element.addEventListener('change', function(e) {
                saveCardField(field, e.target.value);
                updateStatusIndicators();
                updateCardPreview();
            });
        }
    });

    // Keyboard shortcut for filling form
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab && activeTab.id === 'cards') {
                fillPaymentForm();
            }
        }
    });
}

function loadCardData() {
    chrome.storage.local.get([
        'cardholderName', 'cardNumber', 'cardCvv', 'expMonth', 'expYear'
    ], (result) => {
        Object.entries(result).forEach(([field, value]) => {
            const element = document.getElementById(field);
            if (element && value) {
                element.value = value;

                // Format card number if it's the card number field
                if (field === 'cardNumber') {
                    const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
                    element.value = formattedValue;
                }
            }
        });

        updateStatusIndicators();
        updateCardPreview();
    });
}

function saveCardField(fieldId, value) {
    const saveData = {};
    saveData[fieldId] = value;
    chrome.storage.local.set(saveData);
}

function updateCardPreview() {
    const nameElement = document.getElementById('previewName');
    const numberElement = document.getElementById('previewNumber');
    const expiryElement = document.getElementById('previewExpiry');
    const previewElement = document.getElementById('cardPreview');

    if (!nameElement || !numberElement || !expiryElement || !previewElement) return;

    const name = document.getElementById('cardholderName')?.value || 'CARDHOLDER NAME';
    const number = document.getElementById('cardNumber')?.value || '**** **** **** ****';
    const month = document.getElementById('expMonth')?.value;
    const year = document.getElementById('expYear')?.value;

    nameElement.textContent = name.toUpperCase();
    numberElement.textContent = number;

    if (month && year) {
        expiryElement.textContent = `${month.padStart(2, '0')}/${year.slice(-2)}`;
    } else {
        expiryElement.textContent = 'MM/YY';
    }

    // Show preview if any field is filled
    const hasData = name !== 'CARDHOLDER NAME' ||
        number !== '**** **** **** ****' ||
        month || year;
    previewElement.style.display = hasData ? 'block' : 'none';
}

function setPreset(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.value = value;

    // Trigger appropriate events
    if (fieldId === 'cardNumber') {
        field.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const fieldName = fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    showNotification(`${fieldName} set! ✅`);
}

function fillPaymentForm() {
    showNotification("Please!!", true);
    const cardholderName = document.getElementById('cardholderName')?.value.trim();
    const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g, '');
    const cardCvv = document.getElementById('cardCvv')?.value.trim();
    const expMonth = document.getElementById('expMonth')?.value;
    const expYear = document.getElementById('expYear')?.value;
    console.log("cardholderName::::", cardholderName);

    // Validation
    if (!cardholderName || !cardNumber || !cardCvv || !expMonth || !expYear) {
        showNotification('Please fill in all fields! ⚠️', true);
        return;
    }

    if (cardNumber.length < 13 || cardNumber.length > 16) {
        showNotification('Invalid card number length! ⚠️', true);
        return;
    }

    if (cardCvv.length < 3 || cardCvv.length > 4) {
        showNotification('Invalid CVC length! ⚠️', true);
        return;
    }

    showNotification('Attempting to fill form... 🔄');

    // Execute on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            showNotification('No active tab found! ⚠️', true);
            return;
        }

        // First, try the simple approach that matches your original HTML structure
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (name, number, cvv, month, year) => {
                try {
                    let results = [];
                    let filledCount = 0;

                    // Try the exact IDs from your original form first
                    const fields = [
                        { id: 'cardholderName', value: name, name: 'Card Holder Name' },
                        { id: 'cardNumber', value: number, name: 'Card Number' },
                        { id: 'cardCvv', value: cvv, name: 'CVV' },
                        { id: 'ExpMonthSelect', value: parseInt(month), name: 'Month' },
                        { id: 'ExpYearSelect', value: parseInt(year), name: 'Year' }
                    ];

                    fields.forEach(field => {
                        const element = document.getElementById(field.id);
                        if (element) {
                            try {
                                // For input elements, set value directly
                                if (element.tagName === 'INPUT') {
                                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                    nativeInputValueSetter.call(element, field.value);
                                } else if (element.tagName === 'SELECT') {
                                    element.value = field.value;
                                }

                                // Trigger multiple events to ensure the form recognizes the change
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                element.dispatchEvent(new Event('blur', { bubbles: true }));
                                element.dispatchEvent(new Event('keyup', { bubbles: true }));

                                // Special handling for the card number field based on your original HTML
                                if (field.id === 'cardNumber') {
                                    // Trigger the validation functions mentioned in your HTML
                                    if (typeof validateInputCard === 'function') {
                                        validateInputCard(element);
                                    }
                                    if (typeof Numfield === 'function') {
                                        Numfield(field.value, field.id);
                                    }
                                    if (typeof performBrandCheck === 'function' && field.value.length >= 16) {
                                        performBrandCheck(field.value);
                                    }
                                }

                                filledCount++;
                                results.push(`✅ ${field.name}: Filled successfully`);
                            } catch (err) {
                                results.push(`⚠️ ${field.name}: Found element but failed to fill - ${err.message}`);
                            }
                        } else {
                            results.push(`❌ ${field.name}: Element not found (ID: ${field.id})`);
                        }
                    });

                    // Also try alternative selectors if the main ones didn't work
                    if (filledCount === 0) {
                        const alternativeSelectors = [
                            { selector: 'input[name="cardholderName"]', value: name, name: 'Card Holder Name (by name)' },
                            { selector: 'input[name="cardNumber"]', value: number, name: 'Card Number (by name)' },
                            { selector: 'input[name="cardCvv"]', value: cvv, name: 'CVV (by name)' },
                            { selector: 'select[name="ExpMonthSelect"]', value: parseInt(month), name: 'Month (by name)' },
                            { selector: 'select[name="ExpYearSelect"]', value: parseInt(year), name: 'Year (by name)' }
                        ];

                        alternativeSelectors.forEach(field => {
                            const element = document.querySelector(field.selector);
                            if (element) {
                                try {
                                    element.value = field.value;
                                    element.dispatchEvent(new Event('input', { bubbles: true }));
                                    element.dispatchEvent(new Event('change', { bubbles: true }));
                                    filledCount++;
                                    results.push(`✅ ${field.name}: Filled successfully`);
                                } catch (err) {
                                    results.push(`⚠️ ${field.name}: Found but failed to fill - ${err.message}`);
                                }
                            }
                        });
                    }

                    return {
                        success: filledCount > 0,
                        filledCount: filledCount,
                        totalFields: 5,
                        results: results,
                        pageUrl: window.location.href
                    };

                } catch (error) {
                    return {
                        success: false,
                        filledCount: 0,
                        totalFields: 5,
                        results: [`❌ Script Error: ${error.message}`],
                        pageUrl: window.location.href,
                        error: error.toString()
                    };
                }
            },
            args: [cardholderName, cardNumber, cardCvv, expMonth, expYear],
        }).then((results) => {
            if (!results || !results[0]) {
                showNotification('No response from page script! ⚠️', true);
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
                return;
            }

            const result = results[0].result;

            if (result.success) {
                showNotification(`Success! Filled ${result.filledCount}/${result.totalFields} fields! 🎉`);
                console.log('✅ Fill Results:', result.results);
            } else {
                showNotification(`Failed to fill form. Copying fallback script... 📋`, true);
                console.log('❌ Fill Results:', result.results);
                console.log('Page URL:', result.pageUrl);

                // Copy fallback script to clipboard
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
            }

        }).catch((error) => {
            showNotification('Chrome extension error: ' + error.message, true);
            console.error('Chrome scripting error:', error);
            copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
        });
    });
}

function copyFallbackScript(name, number, cvv, month, year) {
    const jsCode = `
// === CARD AUTO-FILL SCRIPT ===
// Paste this in browser console (F12 -> Console tab)

(function() {
  console.log('🚀 Starting card auto-fill...');
  
  const data = {
    cardholderName: "${name}",
    cardNumber: "${number}",
    cardCvv: "${cvv}",
    expMonth: ${month},
    expYear: ${year}
  };

  let filled = 0;
  const results = [];

  // Primary selectors (exact match from your form)
  const primarySelectors = {
    cardholderName: '#cardholderName',
    cardNumber: '#cardNumber', 
    cardCvv: '#cardCvv',
    expMonth: '#ExpMonthSelect',
    expYear: '#ExpYearSelect'
  };

  // Secondary selectors (by name attribute)
  const secondarySelectors = {
    cardholderName: 'input[name="cardholderName"]',
    cardNumber: 'input[name="cardNumber"]',
    cardCvv: 'input[name="cardCvv"]',
    expMonth: 'select[name="ExpMonthSelect"]',
    expYear: 'select[name="ExpYearSelect"]'
  };

  // Function to fill an element
  function fillElement(element, value, fieldName) {
    if (!element) return false;
    
    try {
      // Set value using native setter to bypass any restrictions
      if (element.tagName === 'INPUT') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(element, value);
      } else {
        element.value = value;
      }
      
      // Trigger all possible events
      const events = ['input', 'change', 'blur', 'keyup', 'keydown'];
      events.forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      // Special handling for card number validation (from your original form)
      if (fieldName === 'cardNumber') {
        try {
          if (typeof validateInputCard === 'function') validateInputCard(element);
          if (typeof Numfield === 'function') Numfield(value, 'cardNumber');
          if (typeof performBrandCheck === 'function' && value.length >= 16) performBrandCheck(value);
          if (typeof DCCcheck === 'function') DCCcheck(value, 'cardNumber');
        } catch (e) {
          console.log('Note: Some validation functions not available:', e.message);
        }
      }
      
      return true;
    } catch (error) {
      console.error(\`Error filling \${fieldName}:\`, error);
      return false;
    }
  }

  // Try primary selectors first
  Object.entries(primarySelectors).forEach(([field, selector]) => {
    const element = document.querySelector(selector);
    if (fillElement(element, data[field], field)) {
      filled++;
      results.push(\`✅ \${field}: Filled successfully (primary)\`);
    } else if (element) {
      results.push(\`⚠️ \${field}: Found but failed to fill (primary)\`);
    }
  });

  // If primary selectors didn't work, try secondary
  if (filled === 0) {
    console.log('Primary selectors failed, trying secondary...');
    Object.entries(secondarySelectors).forEach(([field, selector]) => {
      const element = document.querySelector(selector);
      if (fillElement(element, data[field], field)) {
        filled++;
        results.push(\`✅ \${field}: Filled successfully (secondary)\`);
      }
    });
  }

  // Try generic selectors as last resort
  if (filled === 0) {
    console.log('Secondary selectors failed, trying generic...');
    const genericAttempts = [
      { selector: 'input[placeholder*="name" i]', value: data.cardholderName, field: 'cardholderName' },
      { selector: 'input[placeholder*="card" i][placeholder*="number" i]', value: data.cardNumber, field: 'cardNumber' },
      { selector: 'input[placeholder*="cvv" i], input[placeholder*="cvc" i]', value: data.cardCvv, field: 'cardCvv' }
    ];
    
    genericAttempts.forEach(attempt => {
      const element = document.querySelector(attempt.selector);
      if (fillElement(element, attempt.value, attempt.field)) {
        filled++;
        results.push(\`✅ \${attempt.field}: Filled successfully (generic)\`);
      }
    });
  }

  // Output results
  console.log('\\n=== FILL RESULTS ===');
  results.forEach(result => console.log(result));
  console.log(\`\\n📊 Summary: Filled \${filled}/5 fields\`);
  
  if (filled > 0) {
    console.log('🎉 Success! Some fields were filled.');
  } else {
    console.log('❌ No fields could be filled. The form structure might be different.');
    console.log('\\n🔍 Available form elements:');
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach((el, i) => {
      console.log(\`\${i + 1}. \${el.tagName} - ID: "\${el.id}" - Name: "\${el.name}" - Placeholder: "\${el.placeholder}"\`);
    });
  }
  
  return { filled, total: 5, results };
})();`;

    navigator.clipboard.writeText(jsCode).then(() => {
        showNotification('📋 Fallback script copied! Open Console (F12) and paste to fill form.');
        console.log('=== FALLBACK SCRIPT COPIED TO CLIPBOARD ===');
        console.log('1. Press F12 to open Developer Tools');
        console.log('2. Go to Console tab');
        console.log('3. Paste the script and press Enter');
        console.log('============================================');
    }).catch(() => {
        showNotification('Could not copy to clipboard. Check console for manual script.', true);
        console.log('=== COPY THIS SCRIPT TO BROWSER CONSOLE ===');
        console.log(jsCode);
        console.log('=== END SCRIPT ===');
    });
}// Card Auto-Fill Functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeCardTab();
});

function initializeCardTab() {
    loadCardData();
    setupCardEventListeners();
    updateCardPreview();
}

function setupCardEventListeners() {
    // Card number formatting and validation
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;

            if (formattedValue !== e.target.value) {
                e.target.value = formattedValue;
            }

            saveCardField('cardNumber', value);
            updateStatusIndicators();
            updateCardPreview();
        });
    }

    // CVV numeric only
    const cardCvvInput = document.getElementById('cardCvv');
    if (cardCvvInput) {
        cardCvvInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            saveCardField('cardCvv', e.target.value);
            updateStatusIndicators();
        });
    }

    // Save other card fields
    ['cardholderName', 'expMonth', 'expYear'].forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            element.addEventListener('change', function(e) {
                saveCardField(field, e.target.value);
                updateStatusIndicators();
                updateCardPreview();
            });
        }
    });

    // Keyboard shortcut for filling form
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab && activeTab.id === 'cards') {
                fillPaymentForm();
            }
        }
    });
}

function loadCardData() {
    chrome.storage.local.get([
        'cardholderName', 'cardNumber', 'cardCvv', 'expMonth', 'expYear'
    ], (result) => {
        Object.entries(result).forEach(([field, value]) => {
            const element = document.getElementById(field);
            if (element && value) {
                element.value = value;

                // Format card number if it's the card number field
                if (field === 'cardNumber') {
                    const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
                    element.value = formattedValue;
                }
            }
        });

        updateStatusIndicators();
        updateCardPreview();
    });
}

function saveCardField(fieldId, value) {
    const saveData = {};
    saveData[fieldId] = value;
    chrome.storage.local.set(saveData);
}

function updateCardPreview() {
    const nameElement = document.getElementById('previewName');
    const numberElement = document.getElementById('previewNumber');
    const expiryElement = document.getElementById('previewExpiry');
    const previewElement = document.getElementById('cardPreview');

    if (!nameElement || !numberElement || !expiryElement || !previewElement) return;

    const name = document.getElementById('cardholderName')?.value || 'CARDHOLDER NAME';
    const number = document.getElementById('cardNumber')?.value || '**** **** **** ****';
    const month = document.getElementById('expMonth')?.value;
    const year = document.getElementById('expYear')?.value;

    nameElement.textContent = name.toUpperCase();
    numberElement.textContent = number;

    if (month && year) {
        expiryElement.textContent = `${month.padStart(2, '0')}/${year.slice(-2)}`;
    } else {
        expiryElement.textContent = 'MM/YY';
    }

    // Show preview if any field is filled
    const hasData = name !== 'CARDHOLDER NAME' ||
        number !== '**** **** **** ****' ||
        month || year;
    previewElement.style.display = hasData ? 'block' : 'none';
}

function setPreset(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.value = value;

    // Trigger appropriate events
    if (fieldId === 'cardNumber') {
        field.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const fieldName = fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    showNotification(`${fieldName} set! ✅`);
}

function fillPaymentForm() {
    const cardholderName = document.getElementById('cardholderName')?.value.trim();
    const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g, '');
    const cardCvv = document.getElementById('cardCvv')?.value.trim();
    const expMonth = document.getElementById('expMonth')?.value;
    const expYear = document.getElementById('expYear')?.value;

    // Validation
    if (!cardholderName || !cardNumber || !cardCvv || !expMonth || !expYear) {
        showNotification('Please fill in all fields! ⚠️', true);
        return;
    }

    if (cardNumber.length < 13 || cardNumber.length > 16) {
        showNotification('Invalid card number length! ⚠️', true);
        return;
    }

    if (cardCvv.length < 3 || cardCvv.length > 4) {
        showNotification('Invalid CVC length! ⚠️', true);
        return;
    }

    showNotification('Attempting to fill form... 🔄');

    // Execute on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            showNotification('No active tab found! ⚠️', true);
            return;
        }

        // First, try the simple approach that matches your original HTML structure
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (name, number, cvv, month, year) => {
                try {
                    let results = [];
                    let filledCount = 0;

                    // Try the exact IDs from your original form first
                    const fields = [
                        { id: 'cardholderName', value: name, name: 'Card Holder Name' },
                        { id: 'cardNumber', value: number, name: 'Card Number' },
                        { id: 'cardCvv', value: cvv, name: 'CVV' },
                        { id: 'ExpMonthSelect', value: parseInt(month), name: 'Month' },
                        { id: 'ExpYearSelect', value: parseInt(year), name: 'Year' }
                    ];

                    fields.forEach(field => {
                        const element = document.getElementById(field.id);
                        if (element) {
                            try {
                                // For input elements, set value directly
                                if (element.tagName === 'INPUT') {
                                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                                    nativeInputValueSetter.call(element, field.value);
                                } else if (element.tagName === 'SELECT') {
                                    element.value = field.value;
                                }

                                // Trigger multiple events to ensure the form recognizes the change
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                element.dispatchEvent(new Event('blur', { bubbles: true }));
                                element.dispatchEvent(new Event('keyup', { bubbles: true }));

                                // Special handling for the card number field based on your original HTML
                                if (field.id === 'cardNumber') {
                                    // Trigger the validation functions mentioned in your HTML
                                    if (typeof validateInputCard === 'function') {
                                        validateInputCard(element);
                                    }
                                    if (typeof Numfield === 'function') {
                                        Numfield(field.value, field.id);
                                    }
                                    if (typeof performBrandCheck === 'function' && field.value.length >= 16) {
                                        performBrandCheck(field.value);
                                    }
                                }

                                filledCount++;
                                results.push(`✅ ${field.name}: Filled successfully`);
                            } catch (err) {
                                results.push(`⚠️ ${field.name}: Found element but failed to fill - ${err.message}`);
                            }
                        } else {
                            results.push(`❌ ${field.name}: Element not found (ID: ${field.id})`);
                        }
                    });

                    // Also try alternative selectors if the main ones didn't work
                    if (filledCount === 0) {
                        const alternativeSelectors = [
                            { selector: 'input[name="cardholderName"]', value: name, name: 'Card Holder Name (by name)' },
                            { selector: 'input[name="cardNumber"]', value: number, name: 'Card Number (by name)' },
                            { selector: 'input[name="cardCvv"]', value: cvv, name: 'CVV (by name)' },
                            { selector: 'select[name="ExpMonthSelect"]', value: parseInt(month), name: 'Month (by name)' },
                            { selector: 'select[name="ExpYearSelect"]', value: parseInt(year), name: 'Year (by name)' }
                        ];

                        alternativeSelectors.forEach(field => {
                            const element = document.querySelector(field.selector);
                            if (element) {
                                try {
                                    element.value = field.value;
                                    element.dispatchEvent(new Event('input', { bubbles: true }));
                                    element.dispatchEvent(new Event('change', { bubbles: true }));
                                    filledCount++;
                                    results.push(`✅ ${field.name}: Filled successfully`);
                                } catch (err) {
                                    results.push(`⚠️ ${field.name}: Found but failed to fill - ${err.message}`);
                                }
                            }
                        });
                    }

                    return {
                        success: filledCount > 0,
                        filledCount: filledCount,
                        totalFields: 5,
                        results: results,
                        pageUrl: window.location.href
                    };

                } catch (error) {
                    return {
                        success: false,
                        filledCount: 0,
                        totalFields: 5,
                        results: [`❌ Script Error: ${error.message}`],
                        pageUrl: window.location.href,
                        error: error.toString()
                    };
                }
            },
            args: [cardholderName, cardNumber, cardCvv, expMonth, expYear],
        }).then((results) => {
            if (!results || !results[0]) {
                showNotification('No response from page script! ⚠️', true);
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
                return;
            }

            const result = results[0].result;

            if (result.success) {
                showNotification(`Success! Filled ${result.filledCount}/${result.totalFields} fields! 🎉`);
                console.log('✅ Fill Results:', result.results);
            } else {
                showNotification(`Failed to fill form. Copying fallback script... 📋`, true);
                console.log('❌ Fill Results:', result.results);
                console.log('Page URL:', result.pageUrl);

                // Copy fallback script to clipboard
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
            }

        }).catch((error) => {
            showNotification('Chrome extension error: ' + error.message, true);
            console.error('Chrome scripting error:', error);
            copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
        });
    });
}

function copyFallbackScript(name, number, cvv, month, year) {
    const jsCode = `
// === CARD AUTO-FILL SCRIPT ===
// Paste this in browser console (F12 -> Console tab)

(function() {
  console.log('🚀 Starting card auto-fill...');
  
  const data = {
    cardholderName: "${name}",
    cardNumber: "${number}",
    cardCvv: "${cvv}",
    expMonth: ${month},
    expYear: ${year}
  };

  let filled = 0;
  const results = [];

  // Primary selectors (exact match from your form)
  const primarySelectors = {
    cardholderName: '#cardholderName',
    cardNumber: '#cardNumber', 
    cardCvv: '#cardCvv',
    expMonth: '#ExpMonthSelect',
    expYear: '#ExpYearSelect'
  };

  // Secondary selectors (by name attribute)
  const secondarySelectors = {
    cardholderName: 'input[name="cardholderName"]',
    cardNumber: 'input[name="cardNumber"]',
    cardCvv: 'input[name="cardCvv"]',
    expMonth: 'select[name="ExpMonthSelect"]',
    expYear: 'select[name="ExpYearSelect"]'
  };

  // Function to fill an element
  function fillElement(element, value, fieldName) {
    if (!element) return false;
    
    try {
      // Set value using native setter to bypass any restrictions
      if (element.tagName === 'INPUT') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(element, value);
      } else {
        element.value = value;
      }
      
      // Trigger all possible events
      const events = ['input', 'change', 'blur', 'keyup', 'keydown'];
      events.forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      // Special handling for card number validation (from your original form)
      if (fieldName === 'cardNumber') {
        try {
          if (typeof validateInputCard === 'function') validateInputCard(element);
          if (typeof Numfield === 'function') Numfield(value, 'cardNumber');
          if (typeof performBrandCheck === 'function' && value.length >= 16) performBrandCheck(value);
          if (typeof DCCcheck === 'function') DCCcheck(value, 'cardNumber');
        } catch (e) {
          console.log('Note: Some validation functions not available:', e.message);
        }
      }
      
      return true;
    } catch (error) {
      console.error(\`Error filling \${fieldName}:\`, error);
      return false;
    }
  }

  // Try primary selectors first
  Object.entries(primarySelectors).forEach(([field, selector]) => {
    const element = document.querySelector(selector);
    if (fillElement(element, data[field], field)) {
      filled++;
      results.push(\`✅ \${field}: Filled successfully (primary)\`);
    } else if (element) {
      results.push(\`⚠️ \${field}: Found but failed to fill (primary)\`);
    }
  });

  // If primary selectors didn't work, try secondary
  if (filled === 0) {
    console.log('Primary selectors failed, trying secondary...');
    Object.entries(secondarySelectors).forEach(([field, selector]) => {
      const element = document.querySelector(selector);
      if (fillElement(element, data[field], field)) {
        filled++;
        results.push(\`✅ \${field}: Filled successfully (secondary)\`);
      }
    });
  }

  // Try generic selectors as last resort
  if (filled === 0) {
    console.log('Secondary selectors failed, trying generic...');
    const genericAttempts = [
      { selector: 'input[placeholder*="name" i]', value: data.cardholderName, field: 'cardholderName' },
      { selector: 'input[placeholder*="card" i][placeholder*="number" i]', value: data.cardNumber, field: 'cardNumber' },
      { selector: 'input[placeholder*="cvv" i], input[placeholder*="cvc" i]', value: data.cardCvv, field: 'cardCvv' }
    ];
    
    genericAttempts.forEach(attempt => {
      const element = document.querySelector(attempt.selector);
      if (fillElement(element, attempt.value, attempt.field)) {
        filled++;
        results.push(\`✅ \${attempt.field}: Filled successfully (generic)\`);
      }
    });
  }

  // Output results
  console.log('\\n=== FILL RESULTS ===');
  results.forEach(result => console.log(result));
  console.log(\`\\n📊 Summary: Filled \${filled}/5 fields\`);
  
  if (filled > 0) {
    console.log('🎉 Success! Some fields were filled.');
  } else {
    console.log('❌ No fields could be filled. The form structure might be different.');
    console.log('\\n🔍 Available form elements:');
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach((el, i) => {
      console.log(\`\${i + 1}. \${el.tagName} - ID: "\${el.id}" - Name: "\${el.name}" - Placeholder: "\${el.placeholder}"\`);
    });
  }
  
  return { filled, total: 5, results };
})();`;

    navigator.clipboard.writeText(jsCode).then(() => {
        showNotification('📋 Fallback script copied! Open Console (F12) and paste to fill form.');
        console.log('=== FALLBACK SCRIPT COPIED TO CLIPBOARD ===');
        console.log('1. Press F12 to open Developer Tools');
        console.log('2. Go to Console tab');
        console.log('3. Paste the script and press Enter');
        console.log('============================================');
    }).catch(() => {
        showNotification('Could not copy to clipboard. Check console for manual script.', true);
        console.log('=== COPY THIS SCRIPT TO BROWSER CONSOLE ===');
        console.log(jsCode);
        console.log('=== END SCRIPT ===');
    });
}
