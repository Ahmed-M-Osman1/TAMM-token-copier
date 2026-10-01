// Tab Management
document.addEventListener('DOMContentLoaded', function() {
  initializeTabs();
  initializeTokensTab();
  updateStatusIndicators();
});

function initializeTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const activate = button => {
    buttons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.dataset.tab);
      panel.classList.toggle('active', selected);
      panel.hidden = !selected;
    });
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activate(button));
    button.addEventListener('keydown', event => {
      const offsets = { ArrowRight: 1, ArrowLeft: -1 };
      let next;
      if (event.key in offsets) next = (index + offsets[event.key] + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      activate(buttons[next]);
      buttons[next].focus();
    });
  });
}

// Tokens Tab Functionality
function initializeTokensTab() {
  // Token copy buttons
  document.getElementById("copy-third-party").addEventListener("click", () => {
    getToken("ThirdPartyToken");
  });

  document.getElementById("copy-smart-pass").addEventListener("click", () => {
    getToken("SmartPassToken");
  });

  // Add driving license info
  document.getElementById("add-info").addEventListener("click", () => runAction("add-info", "Filling license information…", async () => {
    const licenseNumber = document.getElementById("licenseNumber").value.trim();
    const emirate = document.getElementById("emirateSelect").value.trim();

    if (!licenseNumber || !emirate) {
      showNotification("Please fill both license fields!", true);
      return;
    }

    const result = await executePage(async (license, emirate) => {

      try {
        let results = [];

        // Step 1: Insert Driving License Number
        let licenseInput;
        for (let attempt = 0; attempt < 15; attempt++) {
          licenseInput = document.querySelector('input[name="DrivingLicenseNumber"]');
          if (licenseInput) break;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        if (!licenseInput || licenseInput.disabled || licenseInput.readOnly) {
          return { success: false, summary: 'Open the editable driving license form in TAMM, then try again.' };
        }
        if (licenseInput) {

          // Try multiple approaches to fill the license number
          let success = false;

          // Approach 1: Focus, clear, type simulation
          try {
            licenseInput.focus();
            licenseInput.click(); // Some fields need to be clicked

            // Clear existing value completely
            licenseInput.select();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(licenseInput, '');

            // Simulate typing each character
            for (let i = 0; i < license.length; i++) {
              nativeSetter.call(licenseInput, licenseInput.value + license[i]);
              licenseInput.dispatchEvent(new KeyboardEvent('keydown', { key: license[i], bubbles: true }));
              licenseInput.dispatchEvent(new KeyboardEvent('keypress', { key: license[i], bubbles: true }));
              licenseInput.dispatchEvent(new Event('input', { bubbles: true }));
              licenseInput.dispatchEvent(new KeyboardEvent('keyup', { key: license[i], bubbles: true }));
            }

            // Final events
            licenseInput.dispatchEvent(new Event('change', { bubbles: true }));
            licenseInput.dispatchEvent(new Event('blur', { bubbles: true }));

            await new Promise(resolve => setTimeout(resolve, 200));

            if (licenseInput.value === license) {
              success = true;
              results.push(`✅ License number filled (typing simulation): ${license}`);
            }
          } catch {
            // Continue with the next existing compatibility strategy.
          }

          // Approach 2: Native setter if typing failed
          if (!success) {
            try {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              licenseInput.focus();
              nativeInputValueSetter.call(licenseInput, license);

              // Trigger events
              licenseInput.dispatchEvent(new Event('input', { bubbles: true, inputType: 'insertText' }));
              licenseInput.dispatchEvent(new Event('change', { bubbles: true }));
              licenseInput.dispatchEvent(new Event('blur', { bubbles: true }));

              await new Promise(resolve => setTimeout(resolve, 200));

              if (licenseInput.value === license) {
                success = true;
                results.push(`✅ License number filled (native setter): ${license}`);
              }
            } catch {
              // Final verification below reports whether this field accepted the value.
            }
          }

          // Approach 3: React/Vue compatibility
          if (!success) {
            try {
              licenseInput.focus();

              // Try to trigger React's onChange if it's a React component
              const reactInternalInstance = licenseInput._valueTracker ||
                Object.keys(licenseInput).find(key => key.startsWith('__reactInternalInstance')) ||
                Object.keys(licenseInput).find(key => key.startsWith('__reactInternalFiber'));

              if (reactInternalInstance) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(licenseInput, license);

                // Trigger React's synthetic event
                const event = new Event('input', { bubbles: true });
                event.simulated = true;
                licenseInput.dispatchEvent(event);

                await new Promise(resolve => setTimeout(resolve, 200));

                if (licenseInput.value === license) {
                  success = true;
                  results.push(`✅ License number filled (React mode): ${license}`);
                }
              }
            } catch {
              // Final verification below reports whether this field accepted the value.
            }
          }

          if (!success) {
            results.push(`❌ License number failed all attempts. Final value: "${licenseInput.value}"`);
          }
        } else {
          results.push('❌ License input not found');
        }

        // Step 2: Handle Emirate dropdown
        const dropdowns = Array.from(document.querySelectorAll('div[role="button"][aria-label="select-control"]'))
          .filter(element => element.getClientRects().length && element.getAttribute('aria-disabled') !== 'true');
        const labeledDropdowns = dropdowns.filter(element => /driving licen[cs]e emirate/i.test(element.textContent));
        const openDropdown = labeledDropdowns.length === 1 ? labeledDropdowns[0] :
          dropdowns.length === 1 ? dropdowns[0] : null;
        if (openDropdown) {
          openDropdown.click();
          results.push('✅ Dropdown opened');

          // Wait for dropdown to open and options to be available
          let attempts = 0;
          const maxAttempts = 10;

          const waitForOptions = () => {
            return new Promise((resolve, reject) => {
              const checkOptions = () => {
                attempts++;
                const allOptions = document.querySelectorAll('.ui-lib-select__options-item');

                if (allOptions.length > 0) {
                  resolve(allOptions);
                } else if (attempts < maxAttempts) {
                  setTimeout(checkOptions, 100);
                } else {
                  reject(new Error('Dropdown options not found after ' + maxAttempts + ' attempts'));
                }
              };
              checkOptions();
            });
          };

          try {
            const allOptions = await waitForOptions();
            let optionFound = false;

            for (let option of allOptions) {
              const optionText = option.textContent.trim();
              if (optionText === emirate) {
                option.click();
                optionFound = true;
                results.push('✅ Emirate selected: ' + emirate);
                break;
              }
            }

            if (!optionFound) {
              results.push('❌ Emirate option not found: ' + emirate);
            }

          } catch (waitError) {
            results.push('❌ Dropdown options error: ' + waitError.message);
          }

        } else {
          results.push('❌ Dropdown button not found');
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Final verification step
        const finalLicenseValue = document.querySelector('input[name="DrivingLicenseNumber"]')?.value;
        const finalDropdownText = (openDropdown?.isConnected ? openDropdown : null)?.textContent?.trim();

        // Also check if there's a hidden select or input for the emirate
        const emirateSelect = document.querySelector('select[name*="emirate" i], select[name*="Emirate"], input[name*="emirate" i], input[name*="Emirate"]');
        const emirateValue = emirateSelect?.value;

        const successCount = results.filter(r => r.startsWith('✅')).length;

        // Verify the specific dropdown we interacted with, not a possibly unrelated hidden field.
        const licenseMatch = finalLicenseValue === license;
        const emirateMatch = finalDropdownText === emirate;

        const isFullyComplete = licenseMatch && emirateMatch;

        return {
          success: successCount >= 2 && isFullyComplete,
          results: results,
          summary: isFullyComplete ?
            'License and emirate filled. Review the page before continuing.' :
            `Could not verify: ${[!licenseMatch && 'license number', !emirateMatch && 'emirate'].filter(Boolean).join(', ')}. Check the form and retry.`,
          verification: {
            licenseMatch: licenseMatch,
            emirateMatch: emirateMatch,
            licenseActual: finalLicenseValue,
            emirateActual: finalDropdownText,
            emirateHidden: emirateValue
          }
        };

      } catch (error) {
        return {
          success: false,
          results: ['❌ Script error: ' + error.message],
          summary: 'The license form could not be filled. Check that it is open and editable.'
        };
      }
    }, [licenseNumber, emirate]);
    showNotification(result.summary || 'Could not fill the license form.', !result.success);

    // Save to storage
    await chrome.storage.local.set({
      "drivingLicenseNumber": licenseNumber,
      "drivingLicenseEmirate": emirate
    }).catch(() => showNotification('The fill action finished, but license information could not be saved.', true));

    updateStatusIndicators();
  }));

  // Load saved license data
  loadLicenseData();

  // Add event listeners for license fields to update status
  document.getElementById("licenseNumber").addEventListener('input', updateStatusIndicators);
  document.getElementById("emirateSelect").addEventListener('change', updateStatusIndicators);
}

function getToken(tokenKey) {
  const smartPass = tokenKey === 'SmartPassToken';
  return runAction(smartPass ? 'copy-smart-pass' : 'copy-third-party', 'Looking for token…', async () => {
    const result = await executePage(readPageToken, [tokenKey]);
    if (result.error) throw new Error(result.error);
    if (typeof result.token !== 'string' || !result.token.trim()) throw new Error('No token was returned.');
    try {
      await navigator.clipboard.writeText(result.token);
    } catch {
      throw new Error('Clipboard access failed. Keep the popup open and try again.');
    }
    showNotification(`${smartPass ? 'Smart Pass' : 'Third Party'} token copied.`);
  });
}

function loadLicenseData() {
  if (!globalThis.chrome?.storage) return;
  chrome.storage.local.get(["drivingLicenseNumber", "drivingLicenseEmirate"]).then(result => {
    if (result.drivingLicenseNumber) {
      document.getElementById("licenseNumber").value = result.drivingLicenseNumber;
    }
    if (result.drivingLicenseEmirate) {
      document.getElementById("emirateSelect").value = result.drivingLicenseEmirate;
    }
    updateStatusIndicators();
  }).catch(() => showNotification("Saved license information could not be loaded.", true));
}

function updateStatusIndicators() {
  // License status indicators
  const licenseNumber = document.getElementById("licenseNumber")?.value.trim();
  const emirate = document.getElementById("emirateSelect")?.value.trim();

  const licenseStatus = document.getElementById("licenseStatus");
  const emirateStatus = document.getElementById("emirateStatus");

  if (licenseStatus) {
    licenseStatus.classList.toggle('filled', !!licenseNumber);
  }
  if (emirateStatus) {
    emirateStatus.classList.toggle('filled', !!emirate);
  }

  // Card status indicators (if on cards tab)
  const cardFields = {
    nameStatus: 'cardholderName',
    numberStatus: 'cardNumber',
    cvvStatus: 'cardCvv',
    monthStatus: 'expMonth',
    yearStatus: 'expYear'
  };

  Object.entries(cardFields).forEach(([statusId, fieldId]) => {
    const field = document.getElementById(fieldId);
    const status = document.getElementById(statusId);

    if (field && status) {
      const hasValue = field.value.trim() !== '';
      status.classList.toggle('filled', hasValue);
    }
  });
}

function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.classList.toggle('error', isError);
}
