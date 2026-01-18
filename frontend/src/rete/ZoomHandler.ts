import normalizeWheel from 'normalize-wheel';
import { Zoom } from 'rete-area-plugin';

export class ZoomHandler extends Zoom {
  protected wheel = (e: WheelEvent) => {
    e.preventDefault();

    const normalized = normalizeWheel(e);
    const { left, top } = this.element.getBoundingClientRect();
    const delta = normalized.spinY * this.intensity;

    const ox = (left - e.clientX) * delta;
    const oy = (top - e.clientY) * delta;

    this.onzoom(delta, ox, oy, 'wheel');
  };
}
