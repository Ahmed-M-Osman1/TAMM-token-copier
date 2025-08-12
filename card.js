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

    // Add event listener to the test button
    const testButton = document.getElementById('test-extension');
    if (testButton) {
        testButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Test button clicked!');
            
            // Simple test to verify extension basic functionality
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || !tabs[0]) {
                    showNotification('No active tab found! ⚠️', true);
                    return;
                }
                
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        console.log('Test script executed successfully!');
                        const cardNumber = document.getElementById('cardNumber');
                        const cardCvv = document.getElementById('cardCvv');
                        const cardholderName = document.getElementById('cardholderName');
                        
                        return {
                            url: window.location.href,
                            cardNumber: cardNumber ? 'Found' : 'Not found',
                            cardCvv: cardCvv ? 'Found' : 'Not found', 
                            cardholderName: cardholderName ? 'Found' : 'Not found',
                            totalInputs: document.querySelectorAll('input').length,
                            totalSelects: document.querySelectorAll('select').length
                        };
                    }
                }).then((results) => {
                    console.log('Test results:', results);
                    if (results && results[0]) {
                        const result = results[0].result;
                        showNotification(`Test OK! Found fields: ${result.cardNumber}, ${result.cardCvv}, ${result.cardholderName}`, false);
                        console.log('Page analysis:', result);
                    } else {
                        showNotification('Test failed - no results', true);
                    }
                }).catch((error) => {
                    console.error('Test error:', error);
                    showNotification('Test failed: ' + error.message, true);
                });
            });
        });
    }
    
    // Add event listener to the fill form button
    const fillFormButton = document.getElementById('fill-form');
    if (fillFormButton) {
        fillFormButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Fill form button clicked!'); // Debug log
            fillPaymentForm();
        });
    }

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
    
    if (hasData) {
        previewElement.classList.remove('hidden');
    } else {
        previewElement.classList.add('hidden');
    }
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
    console.log('fillPaymentForm called!'); // Debug log

    const cardholderName = document.getElementById('cardholderName')?.value.trim();
    const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g, '');
    const cardCvv = document.getElementById('cardCvv')?.value.trim();
    const expMonth = document.getElementById('expMonth')?.value;
    const expYear = document.getElementById('expYear')?.value;

    console.log('Card data:', { cardholderName, cardNumber, cardCvv, expMonth, expYear }); // Debug log

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
    
    // Add some debug logging
    console.log('About to execute script with data:', { cardholderName, cardNumber, cardCvv, expMonth, expYear });

    // Check if chrome APIs are available
    if (!chrome || !chrome.tabs) {
        showNotification('Chrome extension API not available! ⚠️', true);
        console.error('Chrome extension API not available');
        return;
    }

    if (!chrome.scripting) {
        showNotification('Chrome scripting API not available! ⚠️', true);
        console.error('Chrome scripting API not available');
        return;
    }

    // Execute on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
            showNotification('No active tab found! ⚠️', true);
            return;
        }

        console.log('Active tab found:', tabs[0].url); // Debug log

        // Try a simple direct approach first (like your console test)
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (cardData) => {
                console.log('Simple script execution started with:', cardData);
                let results = [];
                let filled = 0;
                
                // Handle both regular inputs and custom dropdowns
                const fields = [
                    { id: 'cardNumber', value: cardData.number, name: 'Card Number', type: 'input' },
                    { id: 'cardCvv', value: cardData.cvv, name: 'CVV', type: 'input' },
                    { id: 'cardholderName', value: cardData.name, name: 'Card Holder Name', type: 'input' },
                    { id: 'ExpMonthSelect', value: cardData.month, name: 'Expiry Month', type: 'custom-select' },
                    { id: 'ExpYearSelect', value: cardData.year, name: 'Expiry Year', type: 'custom-select' }
                ];
                
                fields.forEach(field => {
                    const element = document.getElementById(field.id);
                    console.log('Checking element:', field.id, element);
                    
                    if (element) {
                        try {
                            if (field.type === 'custom-select') {
                                // Handle custom dropdown
                                element.value = field.value;
                                
                                // Find and update the custom UI elements
                                const customSelect = element.closest('.custom-select');
                                if (customSelect) {
                                    const selectSelected = customSelect.querySelector('.select-selected');
                                    const selectItems = customSelect.querySelector('.select-items');
                                    
                                    // Find the option text for the selected value
                                    const selectedOption = element.querySelector('option[value="' + field.value + '"]');
                                    if (selectedOption && selectSelected) {
                                        selectSelected.textContent = selectedOption.textContent.trim();
                                        console.log('Updated custom dropdown display for', field.name, 'to', selectedOption.textContent.trim());
                                    }
                                    
                                    // Click the appropriate custom option to trigger any custom events
                                    if (selectItems) {
                                        const customOptions = selectItems.querySelectorAll('div');
                                        const targetOption = Array.from(customOptions).find(opt => 
                                            opt.textContent.trim() === selectedOption.textContent.trim()
                                        );
                                        if (targetOption) {
                                            targetOption.click();
                                            console.log('Clicked custom option for', field.name);
                                        }
                                    }
                                }
                                
                                // Trigger events on the select element
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                
                            } else {
                                // Handle regular input
                                element.value = field.value;
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            
                            filled++;
                            results.push('✅ ' + field.name + ': Filled successfully');
                            console.log('Successfully filled:', field.name, 'with value:', field.value);
                            
                        } catch (err) {
                            results.push('⚠️ ' + field.name + ': Error - ' + err.message);
                            console.error('Fill error:', field.name, err);
                        }
                    } else {
                        results.push('❌ ' + field.name + ': Element not found');
                    }
                });
                
                return {
                    success: filled > 0,
                    filledCount: filled,
                    totalFields: 5,
                    results: results,
                    pageUrl: window.location.href
                };
            },
            args: [{
                name: cardholderName,
                number: cardNumber,
                cvv: cardCvv,
                month: expMonth,
                year: expYear
            }]
        }).then((results) => {
            console.log('Script execution results:', results);
            
            if (!results || !results[0]) {
                showNotification('No response from page script! ⚠️', true);
                console.error('No results returned from executeScript');
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
                return;
            }

            const result = results[0].result;
            console.log('Fill result:', result);

            if (result && result.success) {
                showNotification(`Success! Filled ${result.filledCount}/${result.totalFields} fields! 🎉`);
                console.log('✅ Fill Results:', result.results);
            } else if (result) {
                showNotification(`Failed to fill form. Copying fallback script... 📋`, true);
                console.log('❌ Fill Results:', result.results);
                console.log('Page URL:', result.pageUrl);
                if (result.error) {
                    console.error('Script error:', result.error);
                }
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
            } else {
                showNotification('Unexpected response from script! ⚠️', true);
                console.error('Unexpected result format:', result);
                copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
            }
        }).catch((error) => {
            console.error('Chrome scripting error:', error);
            showNotification('Extension error: ' + (error.message || 'Unknown error'), true);
            
            // Check for specific permission errors
            if (error.message && error.message.includes('Cannot access')) {
                showNotification('Permission denied - try refreshing the page! ⚠️', true);
            } else if (error.message && error.message.includes('activeTab')) {
                showNotification('No active tab found! ⚠️', true);
            }
            
            copyFallbackScript(cardholderName, cardNumber, cardCvv, expMonth, expYear);
        });
    });
}

function copyFallbackScript(name, number, cvv, month, year) {
    // Generate fallback script using safe string concatenation
    const escapedName = name.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    const escapedNumber = number.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    const escapedCvv = cvv.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    
    const jsCode = 
        '// === CARD AUTO-FILL SCRIPT ===\n' +
        '// Paste this in browser console (F12 -> Console tab)\n\n' +
        '(function() {\n' +
        '  console.log("Starting card auto-fill...");\n' +
        '  \n' +
        '  const data = {\n' +
        '    cardholderName: "' + escapedName + '",\n' +
        '    cardNumber: "' + escapedNumber + '",\n' +
        '    cardCvv: "' + escapedCvv + '",\n' +
        '    expMonth: ' + month + ',\n' +
        '    expYear: ' + year + '\n' +
        '  };\n\n' +
        '  let filled = 0;\n' +
        '  const results = [];\n\n' +
        '  // Try to fill form fields\n' +
        '  const fields = [\n' +
        '    { id: "cardholderName", value: data.cardholderName, name: "Card Holder Name", type: "input" },\n' +
        '    { id: "cardNumber", value: data.cardNumber, name: "Card Number", type: "input" },\n' +
        '    { id: "cardCvv", value: data.cardCvv, name: "CVV", type: "input" },\n' +
        '    { id: "ExpMonthSelect", value: data.expMonth, name: "Month", type: "select" },\n' +
        '    { id: "ExpYearSelect", value: data.expYear, name: "Year", type: "select" }\n' +
        '  ];\n\n' +
        '  fields.forEach(field => {\n' +
        '    const element = document.getElementById(field.id);\n' +
        '    if (element) {\n' +
        '      try {\n' +
        '        element.value = field.value;\n' +
        '        \n' +
        '        // Handle custom dropdowns\n' +
        '        if (field.type === "select") {\n' +
        '          const customSelect = element.closest(".custom-select");\n' +
        '          if (customSelect) {\n' +
        '            const selectSelected = customSelect.querySelector(".select-selected");\n' +
        '            const selectedOption = element.querySelector("option[value=\\"" + field.value + "\\"]");\n' +
        '            if (selectedOption && selectSelected) {\n' +
        '              selectSelected.textContent = selectedOption.textContent.trim();\n' +
        '            }\n' +
        '          }\n' +
        '        }\n' +
        '        \n' +
        '        element.dispatchEvent(new Event("input", { bubbles: true }));\n' +
        '        element.dispatchEvent(new Event("change", { bubbles: true }));\n' +
        '        filled++;\n' +
        '        results.push("✅ " + field.name + ": Filled successfully");\n' +
        '      } catch (err) {\n' +
        '        results.push("⚠️ " + field.name + ": Error - " + err.message);\n' +
        '      }\n' +
        '    } else {\n' +
        '      results.push("❌ " + field.name + ": Element not found");\n' +
        '    }\n' +
        '  });\n\n' +
        '  console.log("=== FILL RESULTS ===");\n' +
        '  results.forEach(result => console.log(result));\n' +
        '  console.log("Summary: Filled " + filled + "/5 fields");\n' +
        '  \n' +
        '  if (filled === 0) {\n' +
        '    console.log("Available form elements:");\n' +
        '    const inputs = document.querySelectorAll("input, select");\n' +
        '    inputs.forEach((el, i) => {\n' +
        '      console.log((i + 1) + ". " + el.tagName + " - ID: \\"" + el.id + "\\" - Name: \\"" + el.name + "\\"");\n' +
        '    });\n' +
        '  }\n' +
        '  \n' +
        '  return { filled, total: 5, results };\n' +
        '})();';

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
