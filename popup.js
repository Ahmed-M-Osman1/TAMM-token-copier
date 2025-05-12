
document.getElementById("copy-third-party").addEventListener("click", () => {
  getToken("ThirdPartyToken");
});

document.getElementById("copy-smart-pass").addEventListener("click", () => {
  getToken("SmartPassToken");
});

document.getElementById("add-info").addEventListener("click", () => {
  const licenseNumber = document.getElementById("licenseNumber").value.trim();
  const emirate = document.getElementById("emirateSelect").value.trim();

  if (!licenseNumber || !emirate) {
    showNotification("Please fill both fields!", true);
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
        } catch (error) {
          console.error('Error inserting values:', error);
        }
      },
      args: [licenseNumber, emirate],
    });
  });

  localStorage.setItem("drivingLicenseNumber", licenseNumber);
  localStorage.setItem("drivingLicenseEmirate", emirate);

  showNotification("Data inserted into page!");
});

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
            showNotification(`${tokenKey} copied!`);
          }).catch(err => {
            showNotification("Clipboard Error: " + err.message, true);
          });
        }
      }
    });
  });
}

function showNotification(message, isError = false) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.backgroundColor = isError ? "#dc3545" : "#28a745";
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

window.onload = () => {
  const storedLicense = localStorage.getItem("drivingLicenseNumber");
  const storedEmirate = localStorage.getItem("drivingLicenseEmirate");
  if (storedLicense) document.getElementById("licenseNumber").value = storedLicense;
  if (storedEmirate) document.getElementById("emirateSelect").value = storedEmirate;
};
