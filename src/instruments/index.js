// 四台儀器的註冊表。每台模型的共同介面：
//   title, subtitle, layout, practice[]
//   reset()                 模擬器「電源開」＝該台的已定義重設狀態
//   isOn()
//   press(controlId) → hint  按鍵（hint＝{kind:'info'|'approx'|'reject'|'out'|'ok', text} 或 null）
//   turn(controlId, ±1) → hint  旋鈕一格（+1＝順時針）
//   lcd() → SVG 字串（LCD 自身座標）、visual(id) → {lit, active}
//   status() → [[標題, 值]]、snapshot() → 可 JSON 化的唯讀狀態、scenarios?（測試情境）
import { AfgModel } from './afg/model.js';
import { StubModel } from './stub.js';
import tdsLayout from './tds/layout.js';
import gpeLayout from './gpe/layout.js';
import dmmLayout from './dmm/layout.js';

export function createInstruments() {
  return {
    afg: new AfgModel(),
    tds: new StubModel({ id: 'tds', title: 'TDS2001C', subtitle: '數位儲存示波器', layout: tdsLayout, powerId: 'TDS.PWR.ON_OFF', card: 'I03', screen: [320, 240] }),
    gpe: new StubModel({ id: 'gpe', title: 'GPE-4323', subtitle: '四路直流電源供應器', layout: gpeLayout, powerId: 'GPE.PWR.POWER', card: 'I04', screen: [480, 266] }),
    dmm: new StubModel({ id: 'dmm', title: '34460A', subtitle: '6½ 位數電表', layout: dmmLayout, powerId: 'DMM.PWR.POWER', card: 'I05', screen: [480, 318] }),
  };
}
