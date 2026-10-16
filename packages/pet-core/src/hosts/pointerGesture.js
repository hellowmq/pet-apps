/** Click/drag ownership. Cancellation never becomes a tap. No pet animation state. */
export function createPointerGesture({
  target,
  cancelTarget = window,
  hitTest,
  getPoint = (event) => ({ x: event.clientX, y: event.clientY }),
  threshold = 5,
  onPress,
  onTap,
  onDragStart,
  onDragMove,
  onEnd,
}) {
  let press = null;
  let dragged = false;
  let capture = null;

  function moved(event) {
    const point = getPoint(event);
    return Math.hypot(point.x - press.point.x, point.y - press.point.y) >= threshold;
  }

  function end(event, cancelled = true) {
    if (!press) return;
    if (event?.pointerId != null && event.pointerId !== press.event.pointerId) return;
    const wasDragged = dragged;
    const shouldTap = !cancelled && event.button === 0 && !dragged && !moved(event) && hitTest(event);
    const pointerId = press.event.pointerId;
    const captured = capture;
    press = null;
    dragged = false;
    capture = null;
    if (captured?.hasPointerCapture?.(pointerId)) captured.releasePointerCapture(pointerId);
    onEnd?.({ event, cancelled, dragged: wasDragged });
    if (shouldTap) onTap?.(event);
  }

  function down(event) {
    if (press || event.button !== 0 || event.isPrimary === false || !hitTest(event)) return;
    press = { event, point: getPoint(event) };
    capture = event.target;
    // Some hosts forward events without a capturable pointer. Leave/blur still cancel.
    try { capture?.setPointerCapture?.(event.pointerId); } catch { capture = null; }
    onPress?.(event);
  }

  function move(event) {
    if (!press || event.pointerId !== press.event.pointerId) return;
    if (!dragged && moved(event)) {
      dragged = true;
      onDragStart?.(press.event);
    }
    if (dragged) onDragMove?.(event);
  }

  const up = (event) => end(event, false);
  const cancel = (event) => end(event);
  const blur = () => end();
  const keydown = (event) => { if (event.key === 'Escape') end(); };
  const leave = (event) => {
    if (press && !capture?.hasPointerCapture?.(press.event.pointerId)) end(event);
  };
  const listeners = [
    [target, 'pointerdown', down], [target, 'pointermove', move],
    [target, 'pointerup', up], [target, 'pointercancel', cancel],
    [target, 'lostpointercapture', cancel], [target, 'pointerleave', leave],
    [cancelTarget, 'blur', blur], [cancelTarget, 'keydown', keydown],
  ];
  for (const [host, type, listener] of listeners) host.addEventListener(type, listener);

  return {
    isActive: () => press !== null,
    cancel: blur,
    dispose() {
      for (const [host, type, listener] of listeners) host.removeEventListener(type, listener);
      end();
    },
  };
}
