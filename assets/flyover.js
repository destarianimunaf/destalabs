// Native decoding avoids compositing a 6,000px CSS 3D page on visitors' devices.
// Playback and sound both wait for an explicit user gesture.
const studio = document.querySelector(".studio");
const video = studio.querySelector("video");
const start = studio.querySelector(".film-start");
const play = document.querySelector(".playback");
const playLabel = play.querySelector("span");
const sound = document.querySelector(".film-sound");
const progress = document.querySelector(".film-controls progress");
const clock = document.querySelector(".film-clock");
const status = document.querySelector(".film-status");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const narrow = matchMedia("(max-width: 700px)");
let intentToPlay = false;
let pending = false;
let failed = false;
let started = false;
let attempt = 0;

function chooseFilm() {
  if (started) return;
  const variant = narrow.matches ? "mobile" : "desktop";
  video.src = "assets/flyover-" + variant + ".mp4";
  video.poster = "assets/flyover-" + variant + "-poster.webp";
}

function visible() {
  const box = studio.getBoundingClientRect();
  const width = Math.max(0, Math.min(box.right, innerWidth) - Math.max(box.left, 0));
  const height = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
  return box.width > 0 && box.height > 0 && width * height >= .15 * box.width * box.height;
}

function update() {
  const active = intentToPlay && (pending || !video.paused);
  const label = active ? "Pause" : failed ? "Retry" : video.ended ? "Replay" : "Play";
  playLabel.textContent = label;
  play.setAttribute("aria-label", label + " fly-over");
  play.dataset.playing = String(active);
  sound.textContent = video.muted ? "Sound off" : "Sound on";
  sound.setAttribute("aria-pressed", String(!video.muted));
  sound.setAttribute("aria-label", video.muted ? "Unmute fly-over" : "Mute fly-over");
  start.hidden = started && !failed;
  start.textContent = failed ? "Retry tour" : video.muted ? "Play tour" : "Play with sound";
  progress.max = Number.isFinite(video.duration) ? video.duration : 14.5;
  progress.value = video.currentTime || 0;
  clock.textContent = String(Math.floor(video.currentTime || 0)).padStart(2, "0") + " / 14.5s";
}

function pause() {
  attempt++;
  pending = false;
  video.pause();
  update();
}

function unavailable() {
  intentToPlay = false;
  pending = false;
  failed = true;
  pause();
  video.hidden = true;
  status.textContent = "The tour could not load. Try again, or explore the project previews below.";
  update();
}

function begin() {
  if (pending) return;
  if (video.ended) video.currentTime = 0;
  if (failed) {
    failed = false;
    video.hidden = false;
    video.load();
  }
  pending = true;
  const currentAttempt = ++attempt;
  status.textContent = "Loading the tour.";
  // Preserve mobile audio permission by calling play inside the click handler.
  const result = video.play();
  update();
  if (result) result.catch(() => {
    if (currentAttempt !== attempt) return;
    intentToPlay = false;
    pending = false;
    status.textContent = "Playback did not start. Press Play to try again.";
    update();
  });
}

function toggle() {
  if (intentToPlay && (pending || !video.paused)) {
    intentToPlay = false;
    pause();
    status.textContent = "Fly-over paused.";
    return;
  }
  intentToPlay = true;
  if (!visible()) studio.scrollIntoView({ block: "center", behavior: motion.matches ? "instant" : "smooth" });
  begin();
}

function syncVisibility() {
  if (document.hidden || !visible()) pause();
  else if (intentToPlay && video.paused && !video.ended) begin();
}

chooseFilm();
video.controls = false;
video.volume = .65;
start.hidden = false;
document.querySelector(".film-controls").hidden = false;
start.addEventListener("click", toggle);
play.addEventListener("click", toggle);
video.addEventListener("click", toggle);
sound.addEventListener("click", () => { video.muted = !video.muted; update(); });
video.addEventListener("playing", () => {
  pending = false;
  started = true;
  status.textContent = "Fly-over playing.";
  update();
});
video.addEventListener("pause", update);
video.addEventListener("timeupdate", update);
video.addEventListener("volumechange", update);
video.addEventListener("ended", () => {
  intentToPlay = false;
  status.textContent = "Fly-over complete. Explore the projects below.";
  update();
});
video.addEventListener("error", unavailable);
document.querySelectorAll('a[href="#karya"]').forEach(link => link.addEventListener("click", () => {
  intentToPlay = false;
  pause();
}));
document.addEventListener("visibilitychange", syncVisibility);
new IntersectionObserver(syncVisibility, { threshold: .15 }).observe(studio);
motion.addEventListener("change", () => {
  intentToPlay = false;
  pause();
  updateNote();
});
function updateNote() {
  document.querySelector(".motion-note").textContent = motion.matches ? "Static preview · press Play for the tour" : "A short tour · sound starts with Play";
}
narrow.addEventListener("change", chooseFilm);
updateNote();
update();
