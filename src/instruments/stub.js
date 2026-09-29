// 尚未實作行為的儀器：面板可看、可按，但只回報「開發中」，不假裝成功。
export class StubModel {
  constructor({ id, title, subtitle, layout, powerId, card, screen }) {
    Object.assign(this, { id, title, subtitle, layout, powerId, card, screen });
    this.practice = [`這台的操作邏輯在 ${card} 實作，目前只能看面板與按鍵位置。`];
    this.reset();
  }
  reset() { this.on = true; }
  isOn() { return this.on; }
  press(id) {
    if (id === this.powerId) {
      this.on = !this.on;
      return { kind: 'approx', text: `模擬電源${this.on ? '開' : '關'}（近似）。` };
    }
    return { kind: 'info', text: `${this.title} 的按鍵行為還在開發（${this.card}），這次按鍵沒有改變任何狀態。` };
  }
  turn() { return this.press(''); }
  lcd() {
    const [w, h] = this.screen;
    return `<rect width="${w}" height="${h}" fill="#101418"/>` +
      `<text x="${w / 2}" y="${h / 2}" fill="#8fa3b5" font-size="${Math.round(h / 12)}" style="text-anchor:middle">${this.card} 開發中</text>`;
  }
  visual() { return {}; }
  status() { return [['狀態', `面板已就緒；行為在 ${this.card} 實作`]]; }
  snapshot() { return { on: this.on, stub: true }; }
}
