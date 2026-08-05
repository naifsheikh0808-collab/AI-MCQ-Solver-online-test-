// ═══════════════════════════════════════════════════════════════════════════
// MCQ Solver AI — Visibility Bypass (MAIN WORLD)
//
// This script runs in the page's own JavaScript context (world: "MAIN"),
// NOT in the extension's isolated world. This is the ONLY reliable way to:
//   1. Override document.hidden / visibilityState on the real Document prototype
//   2. Patch the real document.addEventListener / window.addEventListener
//   3. Stop visibilitychange/blur events BEFORE the page's handlers run
//
// IMPORTANT: No chrome.* APIs are available here (no storage, no runtime).
// This file handles ONLY the anti-cheat bypass. All MCQ logic stays in content.js.
// ═══════════════════════════════════════════════════════════════════════════

(function mcqSolverVisibilityBypass() {
  'use strict';

  // ── STEP 1: Spoof Document.prototype so ALL documents in the page ─────────
  // always report as visible. Using the prototype ensures it cannot be
  // overridden by the page assigning to the instance.
  try {
    Object.defineProperty(Document.prototype, 'hidden', {
      get: function() { return false; },
      configurable: true
    });
    Object.defineProperty(Document.prototype, 'visibilityState', {
      get: function() { return 'visible'; },
      configurable: true
    });
    Object.defineProperty(Document.prototype, 'webkitHidden', {
      get: function() { return false; },
      configurable: true
    });
    Object.defineProperty(Document.prototype, 'webkitVisibilityState', {
      get: function() { return 'visible'; },
      configurable: true
    });
  } catch (e) {}

  // Swallow inline event handler assignments: document.onvisibilitychange = fn
  try {
    Object.defineProperty(Document.prototype, 'onvisibilitychange', {
      get: function() { return null; },
      set: function() { /* swallow */ },
      configurable: true
    });
  } catch(e) {}
  try {
    Object.defineProperty(window, 'onblur', {
      get: function() { return null; },
      set: function() { /* swallow */ },
      configurable: true
    });
  } catch(e) {}

  // ── STEP 2: Patch addEventListener on the REAL objects ───────────────────
  // Since we're in MAIN world, this patches what the PAGE actually calls.
  // Future registrations of blur/visibility handlers become no-ops.
  var BLOCKED = [
    'visibilitychange', 'webkitvisibilitychange',
    'blur', 'mouseleave', 'mouseout', 'pagehide', 'freeze'
  ];

  function patchAEL(target, name) {
    var orig = target.addEventListener;
    target.addEventListener = function(type, listener, options) {
      if (typeof type === 'string' && BLOCKED.indexOf(type.toLowerCase()) !== -1) {
        // Register a no-op stub so removeEventListener still works
        return orig.call(this, type, function() {}, options);
      }
      return orig.call(this, type, listener, options);
    };
    // Preserve toString so detection-aware scripts don't flag our patch
    target.addEventListener.toString = function() {
      return orig.toString();
    };
  }

  try { patchAEL(EventTarget.prototype, 'EventTarget.prototype'); } catch(e) {}
  try { patchAEL(document, 'document'); } catch(e) {}
  try { patchAEL(window,   'window');   } catch(e) {}

  // ── STEP 3: stopImmediatePropagation for events already registered ────────
  // For any blur/visibilitychange listeners the page registered BEFORE our
  // patch (shouldn't happen at document_start, but just in case), our
  // capture-phase listener fires FIRST and kills the event chain.
  var killEvent = function(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
  };

  // These run in MAIN world now, so they share the real event queue
  document.addEventListener('visibilitychange',       killEvent, true);
  document.addEventListener('webkitvisibilitychange', killEvent, true);
  document.addEventListener('mouseleave',             killEvent, true);
  document.addEventListener('mouseout',               killEvent, true);
  document.addEventListener('pagehide',               killEvent, true);
  window.addEventListener('blur',                     killEvent, true);
  window.addEventListener('pagehide',                 killEvent, true);
  window.addEventListener('freeze',                   killEvent, true);

  console.log('[MCQ Solver AI] Main-world visibility bypass active \u2705');

})();
