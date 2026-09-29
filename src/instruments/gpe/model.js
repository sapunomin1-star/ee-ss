// GPE-4323（I04）行為模型：尚未實作前先沿用占位模型，介面見 ../index.js。
import { StubModel } from '../stub.js';
import layout from './layout.js';

export class GpeModel extends StubModel {
  constructor() {
    super({ id: 'gpe', title: 'GPE-4323', subtitle: '四路直流電源供應器', layout, powerId: 'GPE.PWR.POWER', card: 'I04', screen: [480, 266] });
  }
}
