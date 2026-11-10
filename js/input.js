// Keyboard, mouse and gamepad input.
export const input = {
  keys: new Set(), pressed: new Set(), mouse: { left: false, right: false },
  pad: null, padPrev: [],
  init() {
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && !isTyping(e)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    window.addEventListener('mousedown', e => {
      if (e.target.closest && e.target.closest('.ui-layer button, .panel')) return;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) { this.mouse.right = true; this.pressed.add('MouseRight'); }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    window.addEventListener('contextmenu', e => { if (document.body.classList.contains('in-battle')) e.preventDefault(); });
  },
  down(...codes) { return codes.some(c => this.keys.has(c)); },
  hit(code) { return this.pressed.has(code); },
  endFrame() { this.pressed.clear(); },
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null; for (const g of pads) if (g && g.connected) { p = g; break; }
    if (!p) { this.pad = null; return; }
    const btn = i => !!(p.buttons[i] && p.buttons[i].pressed);
    const dz = v => Math.abs(v) < 0.12 ? 0 : v;
    const cur = p.buttons.map(b => b.pressed);
    const edge = i => cur[i] && !this.padPrev[i];
    this.pad = {
      lx: dz(p.axes[0] || 0), ly: dz(p.axes[1] || 0), rx: dz(p.axes[2] || 0), ry: dz(p.axes[3] || 0),
      gun: btn(7), missile: edge(0), flare: edge(4), boost: btn(5), brake: btn(6), swap: edge(3), cam: edge(2), look: btn(1),
      m: [edge(12), edge(15), edge(13), edge(14)], pause: edge(9),
    };
    this.padPrev = cur;
  },
};
function isTyping(e) { return e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'); }
