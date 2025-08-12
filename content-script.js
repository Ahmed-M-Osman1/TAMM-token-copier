// Content script for filling payment forms
function fillCardForm(cardData) {
    console.log('Content script injected with data:', cardData);
    
    try {
        let results = [];
        let filledCount = 0;

        // Use the same simple approach that you confirmed works in console
        const simpleFields = [
            { id: 'cardNumber', value: cardData.number, name: 'Card Number' },
            { id: 'cardCvv', value: cardData.cvv, name: 'CVV' },
            { id: 'cardholderName', value: cardData.name, name: 'Card Holder Name' },
            { id: 'ExpMonthSelect', value: parseInt(cardData.month), name: 'Month' },
            { id: 'ExpYearSelect', value: parseInt(cardData.year), name: 'Year' }
        ];

        simpleFields.forEach(field => {
            const element = document.getElementById(field.id);
            console.log(`Looking for element with ID: ${field.id}`, element);

            if (element) {
                try {
                    // Use the exact same approach that works in console
                    element.value = field.value;
                    
                    // Trigger basic events
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));

                    filledCount++;
                    results.push(`✅ ${field.name}: Filled successfully`);
                    console.log(`Successfully filled ${field.name} with: ${field.value}`);
                } catch (err) {
                    results.push(`⚠️ ${field.name}: Found element but failed to fill - ${err.message}`);
                    console.error(`Error filling ${field.name}:`, err);
                }
            } else {
                results.push(`❌ ${field.name}: Element not found (ID: ${field.id})`);
                console.warn(`Element not found: ${field.id}`);
            }
        });

        // Try alternative selectors if the main ones didn't work
        if (filledCount === 0) {
            console.log('Primary selectors failed, trying alternatives...');

            const alternativeSelectors = [
                { selector: 'input[name="cardholderName"], input[placeholder*="name" i], input[placeholder*="holder" i]', value: cardData.name, name: 'Card Holder Name (alternative)' },
                { selector: 'input[name="cardNumber"], input[placeholder*="card" i][placeholder*="number" i], input[type="text"][maxlength="19"], input[type="text"][maxlength="16"]', value: cardData.number, name: 'Card Number (alternative)' },
                { selector: 'input[name="cardCvv"], input[name="cvv"], input[name="cvc"], input[placeholder*="cvv" i], input[placeholder*="cvc" i]', value: cardData.cvv, name: 'CVV (alternative)' },
                { selector: 'select[name="ExpMonthSelect"], select[name="expMonth"], select[name="month"]', value: parseInt(cardData.month), name: 'Month (alternative)' },
                { selector: 'select[name="ExpYearSelect"], select[name="expYear"], select[name="year"]', value: parseInt(cardData.year), name: 'Year (alternative)' }
            ];

            alternativeSelectors.forEach(field => {
                const element = document.querySelector(field.selector);
                console.log(`Alternative selector: ${field.selector}`, element);

                if (element) {
                    try {
                        if (element.tagName === 'INPUT') {
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                            nativeInputValueSetter.call(element, field.value);
                        } else {
                            element.value = field.value;
                        }

                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        element.dispatchEvent(new Event('blur', { bubbles: true }));

                        filledCount++;
                        results.push(`✅ ${field.name}: Filled successfully`);
                    } catch (err) {
                        results.push(`⚠️ ${field.name}: Found but failed to fill - ${err.message}`);
                    }
                }
            });
        }

        // Log all form elements for debugging
        if (filledCount === 0) {
            console.log('No fields filled. Available form elements:');
            const allInputs = document.querySelectorAll('input, select');
            allInputs.forEach((el, i) => {
                console.log(`${i + 1}. ${el.tagName} - ID: "${el.id}" - Name: "${el.name}" - Placeholder: "${el.placeholder}" - Type: "${el.type}"`);
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
        console.error('Script execution error:', error);
        return {
            success: false,
            filledCount: 0,
            totalFields: 5,
            results: [`❌ Script Error: ${error.message}`],
            pageUrl: window.location.href,
            error: error.toString()
        };
    }
}