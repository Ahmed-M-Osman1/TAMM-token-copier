// Tab Management
document.addEventListener('DOMContentLoaded', function() {
  initializeTabs();
  initializeTokensTab();
  updateStatusIndicators();
});

function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Remove active class from all tabs and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked tab and corresponding pane
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      // Update status indicators when switching to cards tab
      if (targetTab === 'cards') {
        setTimeout(updateStatusIndicators, 100);
      }
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
  document.getElementById("add-info").addEventListener("click", () => {
    const licenseNumber = document.getElementById("licenseNumber").value.trim();
    const emirate = document.getElementById("emirateSelect").value.trim();

    if (!licenseNumber || !emirate) {
      showNotification("Please fill both license fields!", true);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (license, emirate) => {
          try {
            // Insert Driving License Number
            const licenseInput = document.querySelector('input[name="DrivingLicenseNumber"]');
            if (licenseInput) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeInputValueSetter.call(licenseInput, license);

              licenseInput.dispatchEvent(new Event('input', { bubbles: true }));
              licenseInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Open Emirate dropdown
            const openDropdown = document.querySelector('div[role="button"][aria-label="select-control"]');
            if (openDropdown) {
              openDropdown.click();
            }

            // Wait and select the correct emirate option
            setTimeout(() => {
              const allOptions = document.querySelectorAll('.ui-lib-select__options-item');
              for (let option of allOptions) {
                if (option.textContent.trim() === emirate) {
                  option.click();
                  break;
                }
              }
            }, 300);

            return "License info inserted successfully!";
          } catch (error) {
            return "Error: " + error.message;
          }
        },
        args: [licenseNumber, emirate],
      }, (results) => {
        if (chrome.runtime.lastError) {
          showNotification("Script error: " + chrome.runtime.lastError.message, true);
        } else {
          const result = results[0].result;
          showNotification(result, result.includes("Error"));
        }
      });
    });

    // Save to storage
    chrome.storage.local.set({
      "drivingLicenseNumber": licenseNumber,
      "drivingLicenseEmirate": emirate
    });

    updateStatusIndicators();
  });

  // Load saved license data
  loadLicenseData();

  // Add event listeners for license fields to update status
  document.getElementById("licenseNumber").addEventListener('input', updateStatusIndicators);
  document.getElementById("emirateSelect").addEventListener('change', updateStatusIndicators);
}

function getToken(tokenKey) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (key) => {
        try {
          const data = JSON.parse(document.getElementById('staticData').innerText).smartpassData;
          return data[key] || '';
        } catch (e) {
          return "ERROR: " + e.message;
        }
      },
      args: [tokenKey],
    }, (results) => {
      if (chrome.runtime.lastError) {
        showNotification("Script error: " + chrome.runtime.lastError.message, true);
      } else {
        const token = results[0].result;
        if (token.startsWith("ERROR:")) {
          showNotification(token, true);
        } else {
          navigator.clipboard.writeText(token).then(() => {
            showNotification(`${tokenKey.replace(/([A-Z])/g, ' $1').trim()} copied! 🎉`);
          }).catch(err => {
            showNotification("Clipboard Error: " + err.message, true);
          });
        }
      }
    });
  });
}

function loadLicenseData() {
  chrome.storage.local.get(["drivingLicenseNumber", "drivingLicenseEmirate"], (result) => {
    if (result.drivingLicenseNumber) {
      document.getElementById("licenseNumber").value = result.drivingLicenseNumber;
    }
    if (result.drivingLicenseEmirate) {
      document.getElementById("emirateSelect").value = result.drivingLicenseEmirate;
    }
    updateStatusIndicators();
  });
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

  if (isError) {
    notification.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
  } else {
    notification.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
  }

  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}
