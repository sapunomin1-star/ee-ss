// 34460A（I05）行為模型：尚未實作前先沿用占位模型，介面見 ../index.js。
import { StubModel } from '../stub.js';
import layout from './layout.js';

export class DmmModel extends StubModel {
  constructor() {
    super({ id: 'dmm', title: '34460A', subtitle: '6½ 位數電表', layout, powerId: 'DMM.PWR.POWER', card: 'I05', screen: [480, 318] });
  }
}
