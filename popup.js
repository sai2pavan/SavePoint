const countNumber = document.getElementById("countNumber");
const countLabel  = document.getElementById("countLabel");
const clearBtn    = document.getElementById("clearBtn");
const confirmRow  = document.getElementById("confirmRow");
const confirmYes  = document.getElementById("confirmYes");
const confirmNo   = document.getElementById("confirmNo");

// --- Get the current account ID from the active YouTube tab ---
// The popup has no DOM of its own to read, so we inject a tiny
// script into the active YouTube tab to grab the avatar src,
// which is our per-account identifier (same as content.js uses).

function getAccountIdFromTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];

      // If we're not on a YouTube tab, we can't determine the account
      if (!tab || !tab.url || !tab.url.includes("youtube.com")) {
        resolve(null);
        return;
      }

      // Inject a tiny function into the YouTube tab that reads the avatar
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const avatarImg = document.querySelector("#avatar-btn img");
          return avatarImg ? avatarImg.src : null;
        }
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          resolve(null);
          return;
        }
        resolve(results[0].result);
      });
    });
  });
}

// --- Load count for the current account only ---

async function loadCount() {
  const accountId = await getAccountIdFromTab();

  if (!accountId) {
    // Not on YouTube or not logged in — show helpful message
    countNumber.textContent = "—";
    countLabel.textContent  = "Sign in to YouTube to use Savepoint";
    clearBtn.disabled = true;
    return;
  }

  chrome.storage.local.get(null, (everything) => {
    const MIN_RESUME_THRESHOLD = 5;

    const inProgress = Object.entries(everything).filter(([key, value]) => {
      if (!key.includes("__")) return false;
      if (typeof value !== "number" || value <= MIN_RESUME_THRESHOLD) return false;
      if (accountId && !key.startsWith(accountId)) return false;
      return true;
    });

    const count = inProgress.length;
    countNumber.textContent = count;
    countLabel.textContent  = count === 1
      ? "video in progress"
      : "videos in progress";

    clearBtn.disabled = count === 0;
  });
}

loadCount();

// --- Clear all: show confirmation first, then act ---

clearBtn.addEventListener("click", () => {
  clearBtn.style.display = "none";
  confirmRow.classList.add("visible");
});

confirmNo.addEventListener("click", () => {
  confirmRow.classList.remove("visible");
  clearBtn.style.display = "block";
});

confirmYes.addEventListener("click", async () => {
  const accountId = await getAccountIdFromTab();

  chrome.storage.local.get(null, (everything) => {
    const keysToRemove = Object.keys(everything).filter((key) => {
      if (!key.includes("__")) return false;
      // If we know the account, only remove entries for THIS account
      if (accountId && !key.startsWith(accountId)) return false;
      return true;
    });

    chrome.storage.local.remove(keysToRemove, () => {
      countNumber.textContent = "0";
      countLabel.textContent  = "videos in progress";
      confirmRow.classList.remove("visible");
      clearBtn.style.display  = "block";
      clearBtn.disabled       = true;
    });
  });
});