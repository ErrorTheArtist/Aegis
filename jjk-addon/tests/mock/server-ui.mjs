export const answers = [];
class F {
  constructor() { this.btns = []; this.ctl = []; }
  title(t) { this.t = t; return this; } body(b) { this.b = b; return this; } button(x) { this.btns.push(x); return this; }
  slider(l, a, b, c, d) { this.ctl.push({ k: "slider", l, min: a, max: b, def: d }); return this; }
  dropdown(l, o, d) { this.ctl.push({ k: "dropdown", l, o, def: d }); return this; }
  textField(l, ph, d) { this.ctl.push({ k: "text", l, def: d }); return this; }
  toggle(l, d) { this.ctl.push({ k: "toggle", l, def: d }); return this; }
  button1(x) { this.b1 = x; return this; } button2(x) { this.b2 = x; return this; }
  async show(p) { (globalThis.formLog ||= []).push({ t: this.t, b: this.b, btns: this.btns, ctl: this.ctl, to: p?.name }); const a = answers.shift(); return a ?? { canceled: true }; }
}
export class ActionFormData extends F {} export class ModalFormData extends F {} export class MessageFormData extends F {}
