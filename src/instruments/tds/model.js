// TDS2001C（I03）行為模型：尚未實作前先沿用占位模型，介面見 ../index.js。
import { StubModel } from '../stub.js';
import layout from './layout.js';

export class TdsModel extends StubModel {
  constructor() {
    super({ id: 'tds', title: 'TDS2001C', subtitle: '數位儲存示波器', layout, powerId: 'TDS.PWR.ON_OFF', card: 'I03', screen: [320, 240] });
  }
}
