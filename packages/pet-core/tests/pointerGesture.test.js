import { describe, expect, it, vi } from 'vitest';
import { createPointerGesture } from '../src/hosts/pointerGesture.js';

function setup(options = {}) {
  const target = new EventTarget();
  const cancelTarget = new EventTarget();
  const captured = new Set();
  target.setPointerCapture = (id) => captured.add(id);
  target.hasPointerCapture = (id) => captured.has(id);
  target.releasePointerCapture = (id) => {
    captured.delete(id);
    send('lostpointercapture', { pointerId: id });
  };
  const callbacks = { onTap: vi.fn(), onPress: vi.fn(), onDragStart: vi.fn(), onDragMove: vi.fn(), onEnd: vi.fn() };
  const gesture = createPointerGesture({
    target, cancelTarget, hitTest: (event) => event.clientX >= 0,
    ...callbacks, ...options,
  });
  function send(type, props = {}) {
    target.dispatchEvent(Object.assign(new Event(type), {
      button: 0, pointerId: 1, isPrimary: true,
      clientX: 10, clientY: 10, screenX: 110, screenY: 110, ...props,
    }));
  }
  return { ...callbacks, gesture, send, target, cancelTarget, captured };
}

describe('pointer gesture ownership', () => {
  it('taps only after a primary release on the pet, allowing small jitter', () => {
    const g = setup();
    g.send('pointerdown');
    expect(g.onTap).not.toHaveBeenCalled();
    g.send('pointerup', { clientX: 12 });
    expect(g.onTap).toHaveBeenCalledOnce();
    expect(g.captured.size).toBe(0);
    expect(g.onEnd).toHaveBeenCalledOnce();
  });

  it('ignores right clicks, secondary pointers and presses outside the pet', () => {
    const g = setup();
    g.send('pointerdown', { button: 2 });
    g.send('pointerdown', { isPrimary: false });
    g.send('pointerdown', { clientX: -10 });
    g.send('pointerup');
    expect(g.onPress).not.toHaveBeenCalled();
    expect(g.onTap).not.toHaveBeenCalled();
  });

  it('starts one drag at the threshold, follows it, and never taps on return', () => {
    const g = setup();
    g.send('pointerdown');
    g.send('pointermove', { clientX: 15 });
    g.send('pointermove', { clientX: 10 });
    g.send('pointerup');
    expect(g.onDragStart).toHaveBeenCalledOnce();
    expect(g.onDragStart.mock.calls[0][0].clientX).toBe(10);
    expect(g.onDragMove).toHaveBeenCalledTimes(2);
    expect(g.onEnd).toHaveBeenCalledWith(expect.objectContaining({ dragged: true, cancelled: false }));
    expect(g.onTap).not.toHaveBeenCalled();
  });

  it('uses screen coordinates even when a moving window changes client coordinates', () => {
    const g = setup({ getPoint: (e) => ({ x: e.screenX, y: e.screenY }) });
    g.send('pointerdown');
    g.send('pointermove', { clientX: 10, screenX: 120 });
    g.send('pointerup', { clientX: 10, screenX: 120 });
    expect(g.onDragStart).toHaveBeenCalledOnce();
    expect(g.onTap).not.toHaveBeenCalled();
  });

  it('does not mistake an unreported move or a release outside for a click', () => {
    const g = setup();
    g.send('pointerdown');
    g.send('pointerup', { clientX: 30 });
    g.send('pointerdown', { clientX: 1 });
    g.send('pointerup', { clientX: -1 });
    expect(g.onTap).not.toHaveBeenCalled();
  });

  it('preserves the initiating pointer when another pointer moves or releases', () => {
    const g = setup();
    g.send('pointerdown');
    g.send('pointerdown', { pointerId: 2 });
    g.send('pointermove', { pointerId: 2, clientX: 30 });
    g.send('pointerup', { pointerId: 2 });
    expect(g.gesture.isActive()).toBe(true);
    g.send('pointerup');
    expect(g.onTap).toHaveBeenCalledOnce();
    expect(g.onDragStart).not.toHaveBeenCalled();
  });

  it.each(['pointercancel', 'lostpointercapture'])('%s cancels without a tap and can start again', (type) => {
    const g = setup();
    g.send('pointerdown');
    g.send(type);
    g.send('pointerup');
    expect(g.gesture.isActive()).toBe(false);
    expect(g.onTap).not.toHaveBeenCalled();
    expect(g.onEnd).toHaveBeenCalledOnce();
    g.send('pointerdown');
    g.send('pointerup');
    expect(g.onTap).toHaveBeenCalledOnce();
  });

  it.each(['blur', 'Escape'])('%s ends a drag once and releases capture', (type) => {
    const g = setup();
    g.send('pointerdown');
    g.send('pointermove', { clientX: 30 });
    g.cancelTarget.dispatchEvent(Object.assign(new Event(type === 'blur' ? 'blur' : 'keydown'), { key: type }));
    g.send('pointerup');
    expect(g.onEnd).toHaveBeenCalledOnce();
    expect(g.onEnd).toHaveBeenCalledWith(expect.objectContaining({ dragged: true, cancelled: true }));
    expect(g.captured.size).toBe(0);
    expect(g.onTap).not.toHaveBeenCalled();
  });

  it('handles failed capture by cancelling on leave', () => {
    const g = setup();
    g.target.setPointerCapture = () => { throw new Error('inactive pointer'); };
    g.send('pointerdown');
    g.send('pointerleave');
    g.send('pointerup');
    expect(g.onEnd).toHaveBeenCalledOnce();
    expect(g.onTap).not.toHaveBeenCalled();
  });

  it('keeps a captured drag active when leaving its bounds', () => {
    const g = setup();
    g.send('pointerdown');
    g.send('pointerleave');
    expect(g.gesture.isActive()).toBe(true);
    g.gesture.cancel();
    expect(g.captured.size).toBe(0);
  });

  it('disposing ends a gesture and removes all input listeners', () => {
    const g = setup();
    g.send('pointerdown');
    g.gesture.dispose();
    g.send('pointerdown');
    g.send('pointerup');
    g.cancelTarget.dispatchEvent(new Event('blur'));
    expect(g.onEnd).toHaveBeenCalledOnce();
    expect(g.onPress).toHaveBeenCalledOnce();
    expect(g.onTap).not.toHaveBeenCalled();
  });
});
