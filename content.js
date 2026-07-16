console.log("Savepoint: extension loaded");

let saveIntervalId = null;
let accountIdRetries = 0;
const MAX_ACCOUNT_RETRIES = 10;
let activeVideoElement = null;
let activeListener = null;

const INDICATOR_COLOR    = "#FF0000";
const INDICATOR_SIZE     = "28px";
const PROCESSED_ATTR     = "data-savepoint-processed";
const MIN_RESUME_THRESHOLD = 5;
const BADGE_TOGGLE_KEY   = "savepoint_badges_enabled";

// Whether badges are currently enabled — read from storage on load
let badgesEnabled = true;

// Read the toggle state from storage immediately on load
chrome.storage.local.get([BADGE_TOGGLE_KEY], (result) => {
  badgesEnabled = result[BADGE_TOGGLE_KEY] !== false;
});

function getVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

function getAccountId() {
  const avatarImg = document.querySelector("#avatar-btn img");
  if (!avatarImg) return null;
  const match = avatarImg.src.match(/\/ytc\/([\w-]+)/);
  return match ? match[1] : avatarImg.src;
}

function startTrackingVideo() {
  if (saveIntervalId) {
    clearInterval(saveIntervalId);
    saveIntervalId = null;
  }

  if (activeVideoElement && activeListener) {
    activeVideoElement.removeEventListener("loadedmetadata", activeListener);
    activeVideoElement = null;
    activeListener = null;
  }

  const videoId = getVideoId();
  const video = document.querySelector("video");

  if (!videoId || !video) return;

  const accountId = getAccountId();
  if (!accountId) {
    if (accountIdRetries < MAX_ACCOUNT_RETRIES) {
      accountIdRetries++;
      setTimeout(startTrackingVideo, 500);
    } else {
      console.log("Savepoint: no account detected, tracking disabled for this page.");
    }
    return;
  }

  accountIdRetries = 0;
  const storageKey = `${accountId}__${videoId}`;

  // --- RESUME LOGIC ---
  chrome.storage.local.get([storageKey], (result) => {
    const savedTime = result[storageKey];

    if (savedTime && savedTime > MIN_RESUME_THRESHOLD) {
      const seekToSavedTime = () => {
        if (!video.duration) return;

        if (savedTime < video.duration) {
          console.log("Savepoint: resuming at", savedTime);
          video.currentTime = savedTime;
        } else {
          const finishThreshold = Math.min(10, video.duration * 0.05);
          console.log("Savepoint: saved time exceeds duration, clamping to near end");
          video.currentTime = video.duration - finishThreshold;
        }
      };

      if (video.readyState >= 1) seekToSavedTime();
      video.addEventListener("loadedmetadata", seekToSavedTime);
      activeVideoElement = video;
      activeListener = seekToSavedTime;
    }
  });

  // --- SAVE LOGIC ---
  saveIntervalId = setInterval(() => {
    const finishThreshold = Math.min(10, video.duration * 0.05);
    if (video.duration && video.currentTime >= video.duration - finishThreshold) {
      chrome.storage.local.remove(storageKey);
      return;
    }
    if (video.currentTime === 0) return;

    chrome.storage.local.set({ [storageKey]: video.currentTime }, () => {
      if (chrome.runtime.lastError) {
        console.error("Savepoint: failed to save progress", chrome.runtime.lastError);
      }
    });
  }, 3000);
}

startTrackingVideo();
window.addEventListener("yt-navigate-finish", startTrackingVideo);

// --- THUMBNAIL INDICATOR LOGIC ---

function extractVideoIdFromHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.origin);
    return url.searchParams.get("v");
  } catch (e) {
    return null;
  }
}

function addIndicator(container) {
  if (container.querySelector("[data-savepoint-badge]")) return;

  container.style.position = "relative";
  container.style.overflow = "hidden";

  const badge = document.createElement("div");
  badge.setAttribute("data-savepoint-badge", "true");
  badge.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: ${INDICATOR_SIZE} ${INDICATOR_SIZE} 0 0;
    border-color: ${INDICATOR_COLOR} transparent transparent transparent;
    z-index: 10;
    pointer-events: none;
  `;
  container.appendChild(badge);
}

function removeAllBadges() {
  document.querySelectorAll("[data-savepoint-badge]").forEach((badge) => badge.remove());
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => el.removeAttribute(PROCESSED_ATTR));
}

function processThumbnails() {
  // Skip if badges are disabled
  if (!badgesEnabled) return;

  const accountId = getAccountId();
  if (!accountId) return;

  const candidates = [];

  // System 1: old renderer — a#thumbnail (search, subscriptions, feed)
  document.querySelectorAll(`a#thumbnail:not([${PROCESSED_ATTR}])`).forEach((link) => {
    const videoId = extractVideoIdFromHref(link.getAttribute("href"));
    if (!videoId) return;
    link.setAttribute(PROCESSED_ATTR, "true");
    const container = link.closest("ytd-thumbnail") || link;
    candidates.push({ container, storageKey: `${accountId}__${videoId}` });
  });

  // System 2: new lockup renderer — a.ytLockupViewModelContentImage (channel pages, sidebar)
  document.querySelectorAll(`a.ytLockupViewModelContentImage:not([${PROCESSED_ATTR}])`).forEach((link) => {
    const videoId = extractVideoIdFromHref(link.getAttribute("href"));
    if (!videoId) return;
    link.setAttribute(PROCESSED_ATTR, "true");
    const container = link.closest("yt-thumbnail-view-model") || link;
    candidates.push({ container, storageKey: `${accountId}__${videoId}` });
  });

  if (candidates.length === 0) return;

  const keys = candidates.map((c) => c.storageKey);
  chrome.storage.local.get(keys, (result) => {
    candidates.forEach(({ container, storageKey }) => {
      const savedTime = result[storageKey];
      if (savedTime && savedTime > MIN_RESUME_THRESHOLD) {
        addIndicator(container);
      }
    });
  });
}

// --- STORAGE CHANGE LISTENER ---
// Handles two cases:
// 1. Progress cleared from popup → remove badges
// 2. Badge toggle changed from popup → show or hide badges
chrome.storage.onChanged.addListener((changes) => {
  // Handle badge toggle change
  if (changes[BADGE_TOGGLE_KEY] !== undefined) {
    badgesEnabled = changes[BADGE_TOGGLE_KEY].newValue !== false;

    if (!badgesEnabled) {
      // Toggle turned off — remove all badges immediately
      removeAllBadges();
    } else {
      // Toggle turned on — re-scan page to show badges
      setTimeout(processThumbnails, 100);
    }
    return;
  }

  // Handle progress cleared
  const anyRemoved = Object.values(changes).some(
    (change) => change.oldValue !== undefined && change.newValue === undefined
  );

  if (anyRemoved) {
    removeAllBadges();
  }
});

// MutationObserver watches for new thumbnails
const observer = new MutationObserver(() => {
  processThumbnails();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

setTimeout(processThumbnails, 3000);

window.addEventListener("yt-navigate-finish", () => {
  document.querySelectorAll(`a#thumbnail[${PROCESSED_ATTR}], a.ytLockupViewModelContentImage[${PROCESSED_ATTR}]`).forEach((el) => {
    el.removeAttribute(PROCESSED_ATTR);
  });
  setTimeout(processThumbnails, 2000);
});