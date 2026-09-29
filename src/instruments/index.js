// 四台儀器的註冊表。每台模型的共同介面：
//   title, subtitle, layout, practice[]
//   reset()                 模擬器「電源開」＝該台的已定義重設狀態
//   isOn()
//   press(controlId, {long}) → hint  按鍵；long＝長按 ≥0.8 s（hint＝{kind:'info'|'approx'|'reject'|'out'|'ok', text} 或 null）
//   turn(controlId, ±1) → hint  旋鈕一格（+1＝順時針）
//   lcd() → SVG 字串（LCD 自身座標）、visual(id) → {lit, active}
//   status() → [[標題, 值]]、snapshot() → 可 JSON 化的唯讀狀態
//   scenarios?（測試情境）→ { title, list:[{id,label,desc}], get() → id, set(id) → hint }
import { AfgModel } from './afg/model.js';
import { TdsModel } from './tds/model.js';
import { GpeModel } from './gpe/model.js';
import { DmmModel } from './dmm/model.js';

export function createInstruments() {
  return { afg: new AfgModel(), tds: new TdsModel(), gpe: new GpeModel(), dmm: new DmmModel() };
}
