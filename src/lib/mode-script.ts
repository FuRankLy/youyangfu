// Colour mode: Light, Dark, or Now (the default), where the palette follows the
// sun's elevation over Auckland.
//
// `boot` is serialised with toString() and inlined in <head>, so it runs before
// the first paint and the page never flashes the wrong colours. That means it
// must stay fully self-contained: no imports, no references to anything outside
// its own body, and only plain ES5-style syntax.
//
// It also installs `window.__mode`, the one API the rest of the site uses to
// read or change the mode. Token values here mirror globals.css.

export type Mode = "light" | "dark" | "now";

export type ModeApi = {
  get(): Mode;
  set(mode: Mode): void;
  /** Re-applies the stored mode. Call every minute in Now mode, and after React resets <html> in development. */
  refresh(): void;
  /** Sun elevation over Auckland right now, in degrees. */
  sun(): number;
};

/* eslint-disable no-var */
function boot() {
  var root = document.documentElement;
  var KEY = "mode";
  var LAT = -36.8485;
  var LON = 174.7633;
  var LIGHT = { paper: "#EDEFEC", ink: "#1B1E24", cinnabar: "#C23B22", jade: "#2B7A5F" };
  var DARK = { paper: "#13161B", ink: "#E7E9E4", cinnabar: "#E0563D", jade: "#4FB08B" };
  var PROPS = ["paper", "surface", "ink", "ink-soft", "grid", "line", "cinnabar", "jade"];

  function rgb(hex: string) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a: string, b: string, t: number) {
    var x = rgb(a);
    var y = rgb(b);
    var out = "#";
    for (var i = 0; i < 3; i++) {
      var v = Math.round(x[i] + (y[i] - x[i]) * t);
      out += (v < 16 ? "0" : "") + v.toString(16);
    }
    return out;
  }
  function luminance(hex: string) {
    var c = rgb(hex);
    var l = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
      var v = c[i] / 255;
      l[i] = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function elevation(date: Date) {
    var rad = Math.PI / 180;
    var d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    var g = (357.529 + 0.98560028 * d) * rad;
    var q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
    var e = (23.439 - 0.00000036 * d) * rad;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
    var ha = (gmst * 15 + LON) * rad - ra;
    return Math.asin(Math.sin(LAT * rad) * Math.sin(dec) + Math.cos(LAT * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
  }
  function read() {
    try {
      var m = localStorage.getItem(KEY);
      if (m === "light" || m === "dark" || m === "now") return m;
    } catch {}
    return "now";
  }
  function apply(mode: string) {
    // Marks that scripts run, so CSS can hide no-JavaScript fallbacks before first paint.
    root.setAttribute("data-js", "");
    root.setAttribute("data-mode", mode);
    if (mode === "now") {
      var el = elevation(new Date());
      var t = Math.min(1, Math.max(0, (el + 6) / 8));
      t = t * t * (3 - 2 * t);
      var glow = Math.exp(-Math.pow((el - 1) / 4.5, 2));
      var paper = mix(DARK.paper, LIGHT.paper, t);
      paper = mix(paper, el >= -2 ? "#E3B996" : "#46517C", glow * (t > 0.5 ? 0.2 : 0.14));
      var light = luminance(paper) > 0.28;
      var base = light ? LIGHT : DARK;
      root.setAttribute("data-theme", light ? "light" : "dark");
      root.style.setProperty("--paper", paper);
      root.style.setProperty("--surface", mix(paper, "#FFFFFF", light ? 0.55 : 0.035));
      root.style.setProperty("--ink", base.ink);
      root.style.setProperty("--ink-soft", mix(paper, base.ink, light ? 0.68 : 0.6));
      root.style.setProperty("--grid", mix(paper, base.ink, light ? 0.2 : 0.13));
      root.style.setProperty("--line", mix(paper, base.ink, 0.34));
      root.style.setProperty("--cinnabar", base.cinnabar);
      root.style.setProperty("--jade", base.jade);
    } else {
      for (var i = 0; i < PROPS.length; i++) root.style.removeProperty("--" + PROPS[i]);
      root.setAttribute("data-theme", mode);
    }
    try {
      window.dispatchEvent(new CustomEvent("modechange", { detail: { mode: mode } }));
    } catch {}
  }

  (window as unknown as { __mode: unknown }).__mode = {
    get: read,
    set: function (mode: string) {
      try {
        localStorage.setItem(KEY, mode);
      } catch {}
      apply(mode);
    },
    refresh: function () {
      apply(read());
    },
    sun: function () {
      return elevation(new Date());
    },
  };
  apply(read());
}
/* eslint-enable no-var */

export const MODE_SCRIPT = `(${boot.toString()})()`;
