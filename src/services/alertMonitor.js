// ---------------------------------------------------------------------------
// AlertMonitor — evaluates alert conditions against live market context.
// Pure functions; the hook (useAlertMonitor) handles polling + side effects.
// ---------------------------------------------------------------------------

const PRICE_TOLERANCE = 0.0015; // 0.15% proximity counts as "reached"

/**
 * Check a single alert against live context.
 * Returns { triggered: true, reason } or null.
 */
export function checkAlert(alert, ctx) {
  if (!alert || !alert.active || alert.triggered) return null;
  const { snapshot, analysis, nextHighEventTime } = ctx;
  const type = alert.type;
  const price = snapshot?.current_price;
  const market = alert.market;

  switch (type) {
    case 'Major support break':
      if (price && snapshot?.support && price < snapshot.support)
        return { triggered: true, reason: `${market} broke support at ${snapshot.support} (now ${price})` };
      break;
    case 'Major resistance break':
      if (price && snapshot?.resistance && price > snapshot.resistance)
        return { triggered: true, reason: `${market} broke resistance at ${snapshot.resistance} (now ${price})` };
      break;
    case 'Price reaches entry zone':
      if (price && alert.price_level) {
        if (Math.abs(price - alert.price_level) / price < PRICE_TOLERANCE)
          return { triggered: true, reason: `${market} reached ${alert.price_level} (now ${price})` };
      }
      break;
    case 'High-quality setup appears': {
      const grade = analysis?.setup?.quality_grade;
      const dir = String(analysis?.setup?.direction || '').toUpperCase();
      if (analysis?.setup && (grade === 'A+' || grade === 'A') && dir !== 'NONE')
        return { triggered: true, reason: `${market} ${grade} ${dir} setup detected` };
      break;
    }
    case 'Major news approaching':
      if (nextHighEventTime) {
        const mins = (nextHighEventTime - Date.now()) / 60000;
        if (mins > 0 && mins < 30)
          return { triggered: true, reason: `High-impact event in ${Math.round(mins)} min` };
      }
      break;
    case 'Stop loss approached':
      if (price && alert.price_level && Math.abs(price - alert.price_level) / price < PRICE_TOLERANCE * 2)
        return { triggered: true, reason: `${market} approaching stop at ${alert.price_level}` };
      break;
    case 'TP1 reached':
      if (price && alert.price_level && Math.abs(price - alert.price_level) / price < PRICE_TOLERANCE)
        return { triggered: true, reason: `${market} reached TP1 at ${alert.price_level}` };
      break;
    // 'Break of structure', 'Liquidity sweep', 'Setup invalidated' require
    // tick-level monitoring not available from snapshot polling — left manual.
    default:
      break;
  }
  return null;
}

/**
 * Check all alerts. Returns [{ alert, reason }] for newly triggered ones.
 */
export function checkAllAlerts(alerts, contexts) {
  const triggered = [];
  for (const a of alerts || []) {
    if (!a.active || a.triggered) continue;
    const ctx = contexts[a.market] || {};
    const res = checkAlert(a, ctx);
    if (res?.triggered) triggered.push({ alert: a, reason: res.reason });
  }
  return triggered;
}