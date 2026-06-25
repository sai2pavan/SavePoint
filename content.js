console.log("Savepoint: extension loaded");

// TEMP DEBUG - remove after checking storage contents
chrome.storage.local.get(["hlGoQC332VM", "_cESW8BwGoU"], (result) => {
  console.log("Savepoint DEBUG - current storage:", result);
});

let saveIntervalId = null;
let activeVideoElement = null;
let activeListener = null;

function getVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

function startTrackingVideo() {
  // Stop any previous interval before starting a new one,
  // otherwise every navigation stacks up another timer forever.
  if (saveIntervalId) {
    clearInterval(saveIntervalId);
    saveIntervalId = null;
  }

  // Remove the previous video's leftover loadedmetadata listener,
  // since YouTube reuses the same <video> tag across navigations.
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

  // --- RESUME LOGIC ---
  chrome.storage.local.get([videoId], (result) => {
    const savedTime = result[videoId];

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

      // Remember this listener + element so the *next* navigation can remove it.
      activeVideoElement = video;
      activeListener = seekToSavedTime;
    }
  });

  // --- SAVE LOGIC ---
  saveIntervalId = setInterval(() => {
    chrome.storage.local.set({ [videoId]: video.currentTime }, () => {
      if (chrome.runtime.lastError) {
        console.error("Savepoint: failed to save progress", chrome.runtime.lastError);
      }
    });
  }, 3000);
}

// Run once for the page's initial load.
startTrackingVideo();

// Run again every time YouTube swaps in a new video without a full reload.
window.addEventListener("yt-navigate-finish", startTrackingVideo);