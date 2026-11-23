import { DURATION, PAGE_HEIGHT, FOCAL_LENGTH, clamp, mix, smooth, cameraAt, layerAt } from "./motion.js";

const studio = document.querySelector(".studio");
const frame = studio.querySelector(".film-frame");
const camera = studio.querySelector(".film-camera");
const world = studio.querySelector(".film-world");
const floor = studio.querySelector(".sheet-floor");
const paper = studio.querySelector(".sheet-paper");
const sections = studio.querySelector(".sheet-sections");
const play = document.querySelector(".playback");
const playLabel = play.querySelector("span");
const progress = document.querySelector(".film-controls progress");
const clock = document.querySelector(".film-clock");
const status = document.querySelector(".film-status");
const controls = document.querySelector(".film-controls");
const title = studio.querySelector(".end-title");
const layers = [...world.querySelectorAll("[data-layer]")];
const tiles = [...world.querySelectorAll(".logo-tile")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let time = 0;
let playing = false;
let visible = false;
let manuallyPaused = false;
let ready = false;
let request = 0;
let last = null;
let width = 1440;
let height = 920;
let reduced = reducedMotion.matches;

function render() {
  const pose = cameraAt(time, width, height);
  world.style.transform = "translateX(-50%) translateZ(" + pose.z + "px) rotateX(" + pose.tilt + "deg) translateY(" + -pose.focus + "px)";
  const dive = smooth((time - 9.47) / .5);
  const cardHeight = mix(PAGE_HEIGHT, 900, dive);
  floor.style.height = cardHeight + "px";
  floor.style.borderRadius = mix(24, 38, dive) + "px";
  paper.style.clipPath = time < 9.47 ? "none" : "inset(0 0 " + (PAGE_HEIGHT - cardHeight) + "px round " + mix(24, 38, dive) + "px)";
  sections.style.opacity = 1 - smooth((time - 9.47) / .28);
  for (const layer of layers) {
    const center = Number(layer.dataset.layer);
    const poseLayer = layerAt(time, center, pose);
    layer.style.transform = "translateZ(" + poseLayer.z + "px) rotateX(" + poseLayer.rotation + "deg)";
    layer.style.filter = "blur(" + poseLayer.blur + "px)";
    layer.style.opacity = poseLayer.opacity;
  }
  tiles.forEach((tile, index) => {
    const lift = smooth((time - .1) / 1.25);
    const startX = [155, 940, 90, 1020][index];
    const endX = [-70, 1080, -100, 1120][index];
    let y = [380, 300, 700, 780][index] + Math.min(300, Math.max(0, pose.focus - 330));
    if (index === 2) y = mix(y, pose.focus + 380, smooth((time - 5.1) / .3)) - 1700 * smooth((time - 5.5) / .8);
    y = mix(y, [10, 50, 730, 780][index], smooth((time - 8.2) / 1.77));
    tile.style.left = mix(startX, endX, lift) + "px";
    tile.style.top = y + "px";
    tile.style.transform = "translateZ(" + mix(10, [150, 110, 210, 170][index], lift) + "px) rotateX(" + (-30 * lift * (1 - dive)) + "deg) scale(" + mix(.25, 1, lift) + ")";
    tile.style.filter = "blur(" + ([0, 0, 8, 11][index] * dive) + "px)";
  });
  title.style.opacity = smooth((time - 10.02) / .35);
  for (const [index, line] of [...title.querySelectorAll(".end-line")].entries()) {
    const p = smooth((time - 10.12 - index * .24) / .34);
    line.style.opacity = p;
    line.style.transform = "translateY(" + (16 * (1 - p)) + "px)";
    line.style.filter = "blur(" + 12 * (1 - p) + "px)";
  }
  progress.value = time;
  clock.textContent = String(Math.floor(time)).padStart(2, "0") + " / 14s";
}

function updateControl() {
  playLabel.textContent = playing ? "Pause" : time >= DURATION ? "Replay" : "Play";
  play.setAttribute("aria-label", playing ? "Pause fly-over" : time >= DURATION ? "Replay fly-over" : "Play fly-over");
  play.dataset.playing = String(playing);
}

function tick(now) {
  request = 0;
  if (!playing) return;
  if (last !== null) time = Math.min(DURATION, time + (now - last) / 1000);
  last = now;
  render();
  if (time >= DURATION) {
    playing = false;
    last = null;
    status.textContent = "Fly-over complete. Explore the projects below.";
    updateControl();
  } else request = requestAnimationFrame(tick);
}

function syncPlayback() {
  const shouldPlay = ready && !reduced && !manuallyPaused && visible && !document.hidden && time < DURATION;
  if (shouldPlay === playing) return;
  playing = shouldPlay;
  last = null;
  if (request) cancelAnimationFrame(request);
  request = playing ? requestAnimationFrame(tick) : 0;
  status.textContent = playing ? "Fly-over playing." : "Fly-over paused.";
  updateControl();
}

function resize() {
  const bounds = studio.getBoundingClientRect();
  width = bounds.width < 700 ? 900 : 1440;
  const scale = bounds.width / width;
  height = bounds.height / scale;
  frame.style.width = width + "px";
  frame.style.height = height + "px";
  frame.style.transform = "scale(" + scale + ")";
  camera.style.perspective = FOCAL_LENGTH + "px";
  render();
}

function applyPreference() {
  reduced = reducedMotion.matches;
  studio.classList.toggle("film-ready", ready && !reduced);
  controls.hidden = reduced || !ready;
  document.querySelector(".motion-note").textContent = reduced ? "Static previews · reduced motion" : "A short tour of the projects";
  time = 0;
  manuallyPaused = false;
  syncPlayback();
  render();
}

play.addEventListener("click", () => {
  if (time >= DURATION) time = 0;
  manuallyPaused = playing;
  if (!manuallyPaused && !visible) {
    status.textContent = "Moving to the fly-over.";
    studio.scrollIntoView({ block: "center", behavior: "smooth" });
  } else if (manuallyPaused) status.textContent = "Fly-over paused.";
  syncPlayback();
  render();
});
document.querySelectorAll('a[href="#karya"]').forEach(link => link.addEventListener("click", () => {
  manuallyPaused = true;
  syncPlayback();
}));
document.addEventListener("visibilitychange", syncPlayback);
reducedMotion.addEventListener("change", applyPreference);
new ResizeObserver(resize).observe(studio);
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
  syncPlayback();
}, { threshold: .15 }).observe(studio);

// Never autoplay a half-loaded scene. Static previews stay visible if setup fails.
Promise.all([
  document.fonts.ready,
  ...[...studio.querySelectorAll("img")].map(img => img.decode().catch(() => {}))
]).then(() => {
  ready = true;
  resize();
  applyPreference();
}).catch(() => {});
