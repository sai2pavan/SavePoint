console.log("Savepoint: extension loaded");

function getVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

const videoId = getVideoId();
const video = document.querySelector("video");

if (video) {
  // --- RESUME LOGIC ---
  chrome.storage.local.get([videoId], (result) => {
    const savedTime = result[videoId];

    if (savedTime) {
      const seekToSavedTime = () => {
        // Skip ads: their duration is almost always far shorter than
        // a real saved timestamp, so only seek once durations line up.
        if (video.duration && savedTime < video.duration) {
          console.log("Savepoint: resuming at", savedTime);
          video.currentTime = savedTime;
        }
      };

      if (video.readyState >= 1) {
        seekToSavedTime();
      }

      // Fires every time YouTube loads new content into this <video> tag
      // (ad finishing, real video starting, etc.)
      video.addEventListener("loadedmetadata", seekToSavedTime);
    }
  });

  // --- SAVE LOGIC ---
  setInterval(() => {
    chrome.storage.local.set({ [videoId]: video.currentTime }, () => {
      if (chrome.runtime.lastError) {
        console.error("Savepoint: failed to save progress", chrome.runtime.lastError);
      }
    });
  }, 3000);
}