console.log("Savepoint extension loaded on this page!");

const video = document.querySelector("video");

if (video) {
  console.log("Found the video element!", video);

  setInterval(() => {
    console.log("Current time:", video.currentTime);
  }, 3000);
} else {
  console.log("No video element found yet.");
}