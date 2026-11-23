// Decorative feedback never delays links, replaces focus, or captures input.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const directions = { "↗": "diagonal-up", "↘": "diagonal-down", "↓": "down", "↑": "up" };
document.querySelectorAll('a span[aria-hidden="true"]').forEach(icon => {
  const direction = directions[icon.textContent.trim()];
  if (!direction) return;
  icon.innerHTML = `<svg class="liquid-arrow is-${direction}" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path fill="currentColor" d="M3 9.7c-2.2 0-2.2 4.6 0 4.6h9.8l-2.9 2.9c-2 2 1.2 5.2 3.2 3.2l7.8-7.8c.9-.9.9-2.3 0-3.2l-7.8-7.8c-2-2-5.2 1.2-3.2 3.2l4.9 4.9H3Z"/><path d="M4 11.2h11.8M12.4 4.2l6.7 6.7" fill="none" stroke="white" stroke-opacity=".65" stroke-width="1" stroke-linecap="round"/></svg>`;
});
const cursor = document.createElement("span");
cursor.className = "liquid-cursor";
cursor.setAttribute("aria-hidden", "true");
cursor.innerHTML = '<img src="assets/liquid-cursor.svg" alt="" width="38" height="44">';
const effects = document.createElement("div");
effects.className = "pointer-effects";
effects.setAttribute("aria-hidden", "true");
effects.append(cursor);
document.body.append(effects);
const cursorImage = cursor.firstElementChild;

function hideCursor() {
  document.documentElement.classList.remove("liquid-pointer");
}

function resetEffects() {
  hideCursor();
  document.querySelectorAll(".water-ripple").forEach(ripple => ripple.remove());
  cursorImage.getAnimations().forEach(animation => animation.cancel());
  document.querySelectorAll(".liquid-arrow").forEach(arrow => {
    arrow.getAnimations().forEach(animation => animation.cancel());
  });
}

document.addEventListener("pointermove", event => {
  if (motion.matches || !finePointer.matches || event.pointerType !== "mouse" || !cursorImage.complete || !cursorImage.naturalWidth) return;
  cursor.style.transform = `translate3d(${event.clientX - 4}px, ${event.clientY - 3}px, 0)`;
  document.documentElement.classList.add("liquid-pointer");
}, { passive: true });

function rippleAt(x, y) {
  if (motion.matches || typeof Element.prototype.animate !== "function") return;
  // Limit decorative nodes even during rapid clicking.
  if (document.querySelectorAll(".water-ripple").length >= 6) {
    document.querySelector(".water-ripple").remove();
  }
  const ripple = document.createElement("span");
  ripple.className = "water-ripple";
  ripple.setAttribute("aria-hidden", "true");
  ripple.style.left = x + "px";
  ripple.style.top = y + "px";
  effects.append(ripple);
  const animation = ripple.animate([
    { transform: "translate(-50%, -50%) scale(.12, .08)", opacity: .9, borderRadius: "48% 52% 43% 57%" },
    { transform: "translate(-50%, -50%) scale(.65, .48)", opacity: .65, borderRadius: "55% 45% 58% 42%", offset: .4 },
    { transform: "translate(-50%, -50%) scale(1.15, .95)", opacity: 0, borderRadius: "50%" }
  ], { duration: 740, easing: "cubic-bezier(.16, 1, .3, 1)" });
  animation.finished.then(() => ripple.remove(), () => ripple.remove());
}

document.addEventListener("pointerdown", event => {
  if (event.button !== 0 || motion.matches) return;
  rippleAt(event.clientX, event.clientY);
  if (finePointer.matches && event.pointerType === "mouse" && cursorImage.animate) {
    cursorImage.getAnimations().forEach(animation => animation.cancel());
    cursorImage.animate([
      { transform: "scale(1, 1)" },
      { transform: "scale(.72, 1.16) rotate(-8deg)", offset: .2 },
      { transform: "scale(1.16, .86) rotate(5deg)", offset: .48 },
      { transform: "scale(1, 1)" }
    ], { duration: 560, easing: "ease-out" });
  }
}, { passive: true });

document.addEventListener("click", event => {
  const control = event.target.closest("a, button");
  if (!control || motion.matches) return;
  // Keyboard activation gets the same feedback, without a pointer requirement.
  if (event.detail === 0) {
    const box = control.getBoundingClientRect();
    rippleAt(box.right - Math.min(18, box.width / 2), box.top + box.height / 2);
  }
  control.querySelectorAll(".liquid-arrow").forEach(arrow => {
    if (!arrow.animate) return;
    arrow.getAnimations().forEach(animation => animation.cancel());
    arrow.animate([
      { scale: "1 1", translate: "0 0" },
      { scale: ".65 1.25", translate: "-2px 2px", offset: .2 },
      { scale: "1.2 .8", translate: "3px -3px", offset: .55 },
      { scale: "1 1", translate: "0 0" }
    ], { duration: 600, easing: "cubic-bezier(.22, 1, .36, 1)" });
  });
});

document.addEventListener("keydown", hideCursor);
document.documentElement.addEventListener("pointerleave", hideCursor);
window.addEventListener("blur", hideCursor);
document.addEventListener("visibilitychange", () => { if (document.hidden) resetEffects(); });
motion.addEventListener("change", resetEffects);
finePointer.addEventListener("change", resetEffects);
