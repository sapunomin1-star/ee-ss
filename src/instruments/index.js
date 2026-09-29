// 四台儀器的註冊表。每台模型的共同介面：
//   title, subtitle, layout, practice[]
//   reset()                 模擬器「電源開」＝該台的已定義重設狀態
//   isOn()
//   press(controlId, {long, ms}) → hint  按鍵；ms＝實際按住毫秒（鍵盤 Shift+Enter 只給 long:true）；long＝≥0.8 s（hint＝{kind:'info'|'approx'|'reject'|'out'|'ok', text} 或 null）
//   turn(controlId, ±1, {source:'drag'|'key'}) → hint  旋鈕一格（+1＝順時針）
//   onOut?(controlId) → hint  可選：OUT 鍵被按時通知（不得改其他狀態）
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
