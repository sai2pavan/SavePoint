console.log("Savepoint: extension loaded");

let saveIntervalId = null;
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
    setTimeout(startTrackingVideo, 500);
    return;
  }

  const storageKey = `${accountId}__${videoId}`;

  // --- RESUME LOGIC ---
  chrome.storage.local.get([storageKey], (result) => {
    const savedTime = result[storageKey];

    if (savedTime) {
      const seekToSavedTime = () => {
        if (video.duration && savedTime < video.duration) {
          console.log("Savepoint: resuming at", savedTime);
          video.currentTime = savedTime;
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
    // Don't save if the video is essentially finished (within 10 seconds of end)
    // — treat it as done and remove it from storage instead.
    if (video.duration && video.currentTime >= video.duration - 10) {
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

const INDICATOR_COLOR = "#126CE3";
const INDICATOR_SIZE = "28px";
// Mark thumbnails we've already processed so we don't add duplicate badges
const PROCESSED_ATTR = "data-savepoint-processed";

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
  // The thumbnail link needs relative positioning so our badge sits on top of it correctly
  thumbnailLink.style.position = "relative";
  thumbnailLink.appendChild(badge);
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
      if (result[storageKey]) {
        // This video has saved in-progress time — add the blue badge
        addIndicator(link);
      }
    });
  });
}

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