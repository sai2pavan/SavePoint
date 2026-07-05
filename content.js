console.log("Savepoint: extension loaded");

let saveIntervalId = null;
let accountIdRetries = 0;
const MAX_ACCOUNT_RETRIES = 10; // 5 seconds total (10 x 500ms)
let activeVideoElement = null;
let activeListener = null;

function getVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

function getAccountId() {
  const avatarImg = document.querySelector("#avatar-btn img");
  return avatarImg ? avatarImg.src : null;
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

  // Reset retry counter once we successfully find an account
  accountIdRetries = 0;

  const storageKey = `${accountId}__${videoId}`;

  // --- RESUME LOGIC ---
  chrome.storage.local.get([storageKey], (result) => {
    const savedTime = result[storageKey];

    if (savedTime && savedTime > MIN_RESUME_THRESHOLD) {
      const seekToSavedTime = () => {
        if (!video.duration) return;

        if (savedTime < video.duration) {
          // Normal case — seek to saved position
          console.log("Savepoint: resuming at", savedTime);
          video.currentTime = savedTime;
        } else {
          // savedTime exceeds this version's duration (re-upload, region cut, etc.)
          // Clamp to near the end so "finished" detection cleans it up naturally
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
    // Consider a video "finished" when within the last 10 seconds
    // OR the last 5% of its duration — whichever is smaller.
    // This prevents short videos from being marked done too early.
    const finishThreshold = Math.min(10, video.duration * 0.05);
    if (video.duration && video.currentTime >= video.duration - finishThreshold) {
      chrome.storage.local.remove(storageKey);
      return;
    }
    // Don't save if currentTime is 0 (ad playing or video not started)
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

const INDICATOR_COLOR = "#FF0000";
const INDICATOR_SIZE  = "28px";
const PROCESSED_ATTR  = "data-savepoint-processed";
const MIN_RESUME_THRESHOLD = 5; // seconds — don't resume or badge if barely started

function extractVideoIdFromHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.origin);
    return url.searchParams.get("v");
  } catch (e) {
    return null;
  }
}

function addIndicator(thumbnailLink) {
  // Don't add a second badge if one already exists
  if (thumbnailLink.querySelector("[data-savepoint-badge]")) return;

  // Attach to ytd-thumbnail (the parent), not the a#thumbnail link itself.
  // Setting position:relative on the link disrupts YouTube's flex layout;
  // the parent container is the safe anchor for our absolute-positioned badge.
  const container = thumbnailLink.closest("ytd-thumbnail") || thumbnailLink;
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

function processThumbnails() {
  const accountId = getAccountId();
  if (!accountId) return; // Not logged in or avatar not loaded yet

  const thumbnailLinks = document.querySelectorAll(`a#thumbnail:not([${PROCESSED_ATTR}])`);
  if (thumbnailLinks.length === 0) return;

  // Collect all video IDs and their storage keys in one pass
  const entries = [];
  thumbnailLinks.forEach((link) => {
    const videoId = extractVideoIdFromHref(link.getAttribute("href"));
    if (!videoId) return;

    // Mark as processed immediately so future scans skip it
    link.setAttribute(PROCESSED_ATTR, "true");
    entries.push({ link, storageKey: `${accountId}__${videoId}` });
  });

  if (entries.length === 0) return;

  // Check storage for all these videos in one single batch call
  const keys = entries.map((e) => e.storageKey);
  chrome.storage.local.get(keys, (result) => {
    entries.forEach(({ link, storageKey }) => {
      const savedTime = result[storageKey];
      // Only show badge if savedTime is above the same threshold
      // used for resuming — badge should only promise what we'll deliver
      if (savedTime && savedTime > MIN_RESUME_THRESHOLD) {
        addIndicator(link);
      }
    });
  });
}

// --- STORAGE CHANGE LISTENER ---
// When the popup clears progress, storage changes but the content script
// has no idea. This listener detects removals and strips badges immediately,
// so the UI stays in sync without needing a page reload.
chrome.storage.onChanged.addListener((changes) => {
  const anyRemoved = Object.values(changes).some(
    (change) => change.oldValue !== undefined && change.newValue === undefined
  );

  if (anyRemoved) {
    // Remove all badges currently visible on the page
    document.querySelectorAll("[data-savepoint-badge]").forEach((badge) => {
      badge.remove();
    });

    // Also clear processed stamps so thumbnails get re-checked
    // if new progress is saved later
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => {
      el.removeAttribute(PROCESSED_ATTR);
    });
  }
});
// MutationObserver watches for new thumbnails being added to the page
// (e.g. as you scroll, or when YouTube loads new content dynamically)
// and processes them as soon as they appear.
const observer = new MutationObserver(() => {
  processThumbnails();
});

observer.observe(document.body, {
  childList: true,  // Watch for elements being added/removed
  subtree: true     // Watch the entire page tree, not just direct children
});

// Also run once after a short delay for thumbnails already on the page at load time
setTimeout(processThumbnails, 3000);

// Re-scan on YouTube's internal navigation events
window.addEventListener("yt-navigate-finish", () => {
  // Clear all processed stamps so thumbnails get re-checked
  // against storage which may have updated since last scan.
  document.querySelectorAll(`a#thumbnail[${PROCESSED_ATTR}]`).forEach((el) => {
    el.removeAttribute(PROCESSED_ATTR);
  });
  setTimeout(processThumbnails, 2000);
});