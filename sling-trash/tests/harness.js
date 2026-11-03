'use strict';
/* Headless harness: runs the real index.html <script> body in a vm context
 * with stubbed DOM/canvas/audio/localStorage, so the solver and scripted
 * pointer tests exercise the game's own physics (no reimplementation). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extractScript(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  const inline = matches.map(m => m[1]).filter(s => s.trim().length > 200).pop();
  if (!inline) throw new Error('inline <script> not found');
  return inline;
}

function makeCtxStub() {
  const noop = () => {};
  const self = {
    canvas: {width: 800, height: 450},
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, translate: noop, scale: noop, rotate: noop,
    setTransform: noop, drawImage: noop, fillText: noop, strokeText: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, setLineDash: noop, getLineDash: () => [],
    resetTransform: noop, transform: noop, isPointInPath: () => false, drawFocusIfNeeded: noop,
    createLinearGradient: () => ({addColorStop: noop}),
    createRadialGradient: () => ({addColorStop: noop}),
    createPattern: () => ({}),
    createImageData: (w, h) => ({data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h}),
    putImageData: noop,
    measureText: s => ({width: (s ? String(s).length : 0) * 8}),
  };
  let fillStyle = '#000', strokeStyle = '#000', lineWidth = 1, globalAlpha = 1, font = '10px sans-serif', textAlign = 'start', textBaseline = 'alphabetic', lineJoin = 'miter', lineCap = 'butt', globalCompositeOperation = 'source-over';
  Object.defineProperties(self, {
    fillStyle: {get: () => fillStyle, set: v => fillStyle = v},
    strokeStyle: {get: () => strokeStyle, set: v => strokeStyle = v},
    lineWidth: {get: () => lineWidth, set: v => lineWidth = v},
    globalAlpha: {get: () => globalAlpha, set: v => globalAlpha = v},
    font: {get: () => font, set: v => font = v},
    textAlign: {get: () => textAlign, set: v => textAlign = v},
    textBaseline: {get: () => textBaseline, set: v => textBaseline = v},
    lineJoin: {get: () => lineJoin, set: v => lineJoin = v},
    lineCap: {get: () => lineCap, set: v => lineCap = v},
    globalCompositeOperation: {get: () => globalCompositeOperation, set: v => globalCompositeOperation = v},
  });
  return self;
}

function makeElementStub(id) {
  const listeners = {};
  return {
    id,
    style: {},
    dataset: {},
    textContent: '',
    width: 800, height: 450,
    clientWidth: 800, clientHeight: 450,
    set onclick(fn) { this._onclick = fn; },
    get onclick() { return this._onclick; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatch(type, ev) { (listeners[type] || []).forEach(fn => fn(ev)); },
    setPointerCapture() {},
    getBoundingClientRect() { return {left: 0, top: 0, width: 800, height: 450}; },
    getContext() { return this._ctx || (this._ctx = makeCtxStub()); },
    getAttribute() { return null; }, setAttribute() {},
    focus() {}, click() { if (this._onclick) this._onclick(); },
  };
}

function build(htmlPath) {
  const script = extractScript(htmlPath);
  const els = {};
  ['c', 'map', 'restart', 'snd', 'sr', 'stage', 'tip'].forEach(id => { els[id] = makeElementStub(id); });

  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };

  const documentStub = {
    getElementById: id => els[id] || makeElementStub(id),
    createElement: tag => makeElementStub('canvas-' + tag),
    addEventListener: () => {},
    activeElement: null,
    hidden: false,
  };

  const sandbox = {
    window: undefined, // filled below with the context's globalThis proxy via vm
    document: documentStub,
    localStorage,
    console,
    Math, JSON, Date, Array, Object, String, Number, Boolean,
    performance: {now: () => Date.now()},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } set src(v) { this._src = v; } },
    AudioContext: undefined, webkitAudioContext: undefined,
    matchMedia: undefined,
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval: () => 0, clearInterval: () => {},
    setTimeout: (fn) => { return 0; }, clearTimeout: () => {},
    ART_META: undefined, WORLD_META: undefined, SPRITE_META: undefined,
  };
  const context = vm.createContext(sandbox);
  // self-references so `window.X` and `document.getElementById` work when the
  // script reads `window.foo` style globals
  vm.runInContext('window = this; this.window = this;', context);

  const wrapped = script;
  new vm.Script(wrapped, {filename: 'index.inline.js'}).runInContext(context);

  return {context, els, run: code => vm.runInContext(code, context), get: name => vm.runInContext(name, context)};
}

module.exports = {build, extractScript};
