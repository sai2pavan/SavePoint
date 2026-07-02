console.log("Savepoint: extension loaded");

let saveIntervalId = null;
let activeVideoElement = null;
let activeListener = null;

function getVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

// The avatar image's src is unique per logged-in Google account, so we use
// it to keep each account's saved timestamps separate and private from
// other accounts using the same browser.
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

  if (!videoId || !video) {
    return;
  }

  const accountId = getAccountId();

  if (!accountId) {
    // Avatar hasn't loaded yet - try again shortly rather than tracking
    // under a missing/shared key.
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

      if (video.readyState >= 1) {
        seekToSavedTime();
      }

      video.addEventListener("loadedmetadata", seekToSavedTime);
      activeVideoElement = video;
      activeListener = seekToSavedTime;
    }
  });

  // --- SAVE LOGIC ---
  saveIntervalId = setInterval(() => {
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
    // href is like "/watch?v=tavcHl_6wbs&pp=..."
    // We prepend the origin to make it a full URL the URL parser can handle
    const url = new URL(href, window.location.origin);
    return url.searchParams.get("v");
  } catch (e) {
    return null;
  }
}

function scanThumbnails() {
  const thumbnailLinks = document.querySelectorAll("a#thumbnail");
  console.log("Savepoint: found", thumbnailLinks.length, "thumbnails on this page");

  thumbnailLinks.forEach((link) => {
    const href = link.getAttribute("href");
    console.log("Savepoint: raw href →", href);

    // Log every attribute on this element so we can see what's actually there
    console.log("Savepoint: all attributes →", 
      Array.from(link.attributes).map(a => `${a.name}="${a.value}"`).join(", ")
    );

    // Also log the full outerHTML trimmed, to see the real structure
    console.log("Savepoint: outerHTML →", link.outerHTML.slice(0, 300));

    const videoId = extractVideoIdFromHref(href);
    if (videoId) {
      console.log("Savepoint: thumbnail video ID →", videoId);
    }
  });
}

// Run after a short delay to let YouTube's dynamic content populate
setTimeout(scanThumbnails, 5000);