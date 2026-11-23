import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/flyover.js", import.meta.url), "utf8");

function player() {
  class Element extends EventTarget {
    hidden = false;
    textContent = "";
    dataset = {};
    attributes = {};
    setAttribute(key, value) { this.attributes[key] = value; }
    querySelector() { return this.label; }
  }
  class Video extends Element {
    paused = true;
    muted = false;
    ended = false;
    currentTime = 0;
    duration = 14.5;
    calls = 0;
    loads = 0;
    play() {
      this.calls++;
      this.paused = false;
      return new Promise((resolve, reject) => { this.resolvePlay = resolve; this.rejectPlay = reject; });
    }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
    load() { this.loads++; }
  }
  const video = new Video();
  const start = new Element();
  const play = new Element();
  play.label = new Element();
  const sound = new Element();
  const status = new Element();
  const skip = new Element();
  const studio = new Element();
  studio.querySelector = selector => selector === "video" ? video : start;
  studio.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 });
  const document = new Element();
  const elements = { ".studio": studio, ".playback": play, ".film-sound": sound, ".film-status": status };
  document.querySelector = selector => elements[selector] ||= new Element();
  document.querySelectorAll = () => [skip];
  const motion = new Element();
  const narrow = new Element();
  let visibility;
  vm.runInNewContext(source, {
    document, innerWidth: 1440, innerHeight: 1000,
    matchMedia: query => query.includes("reduced-motion") ? motion : narrow,
    IntersectionObserver: class { constructor(callback) { visibility = callback; } observe() {} }
  });
  const click = element => element.dispatchEvent(new Event("click"));
  const playing = () => { video.dispatchEvent(new Event("playing")); video.resolvePlay(); };
  return { video, start, play, sound, document, motion, skip, visibility, click, playing };
}

test("sound and playback wait for a gesture, and mute does not start playback", () => {
  const p = player();
  assert.equal(p.video.calls, 0);
  assert.equal(p.video.paused, true);
  p.click(p.sound);
  assert.equal(p.video.muted, true);
  assert.equal(p.video.calls, 0);
  p.click(p.start);
  p.playing();
  assert.equal(p.video.calls, 1);
  assert.equal(p.video.muted, true);
  assert.equal(p.play.label.textContent, "Pause");
});

test("a stale play rejection cannot undo a newer play request", async () => {
  const p = player();
  p.click(p.start);
  const rejectOld = p.video.rejectPlay;
  p.click(p.play);
  p.click(p.play);
  p.playing();
  rejectOld(new Error("interrupted"));
  await Promise.resolve();
  assert.equal(p.play.label.textContent, "Pause");
  assert.equal(p.video.paused, false);
});

test("media failure reveals static previews and supports an explicit retry", () => {
  const p = player();
  p.click(p.start);
  p.video.dispatchEvent(new Event("error"));
  assert.equal(p.video.hidden, true);
  assert.equal(p.start.hidden, false);
  assert.equal(p.play.label.textContent, "Retry");
  p.click(p.start);
  p.playing();
  assert.equal(p.video.loads, 1);
  assert.equal(p.video.hidden, false);
  assert.equal(p.play.label.textContent, "Pause");
});

test("background audio stops, resumes only with prior intent, and Skip cancels it", () => {
  const p = player();
  p.click(p.start);
  p.playing();
  p.document.hidden = true;
  p.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(p.video.paused, true);
  p.document.hidden = false;
  p.visibility();
  p.playing();
  assert.equal(p.video.calls, 2);
  p.click(p.skip);
  p.visibility();
  assert.equal(p.video.paused, true);
  assert.equal(p.video.calls, 2);
});

test("changing motion preference stops playback until the visitor opts in again", () => {
  const p = player();
  p.click(p.start);
  p.playing();
  p.motion.matches = true;
  p.motion.dispatchEvent(new Event("change"));
  p.visibility();
  assert.equal(p.video.paused, true);
  assert.equal(p.video.calls, 1);
});
