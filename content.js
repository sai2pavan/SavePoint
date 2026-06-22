console.log("Savepoint extension loaded on this page!");

function getVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

const videoId = getVideoId();
console.log("Video ID is:", videoId);

const video = document.querySelector("video");

if (video) {
  console.log("Found the video element!", video);

  chrome.storage.local.get([videoId], (result) => {
    const savedTime = result[videoId];

    if (savedTime) {
      console.log("Found a saved timestamp:", savedTime, "- resuming there.");
      video.currentTime = savedTime;
    } else {
      console.log("No saved timestamp for this video, starting fresh.");
    }
  });

  setInterval(() => {
    const currentTime = video.currentTime;
    console.log("Current time:", currentTime);

    chrome.storage.local.set({ [videoId]: currentTime }, () => {
      if (chrome.runtime.lastError) {
        console.error("SET failed:", chrome.runtime.lastError);
      } else {
        console.log("SET succeeded for", videoId, currentTime);
      }
    });

    chrome.storage.local.get(null, (everything) => {
      if (chrome.runtime.lastError) {
        console.error("GET failed:", chrome.runtime.lastError);
      } else {
        console.log("Everything in storage:", everything);
      }
    });
  }, 3000);
} else {
  console.log("No video element found yet.");
}