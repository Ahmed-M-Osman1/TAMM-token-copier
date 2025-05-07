
document.getElementById("copy-third-party").addEventListener("click", () => {
  getToken("ThirdPartyToken");
});

document.getElementById("copy-smart-pass").addEventListener("click", () => {
  getToken("SmartPassToken");
});

function getToken(tokenKey) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
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
