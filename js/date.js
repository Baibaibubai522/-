// 日期与时间格式化（全部按设备本地时区）

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function pad(n) {
  return String(n).padStart(2, '0');
}

function toDate(v) {
  return v instanceof Date ? v : new Date(v);
}

export function dateKey(v) {
  const d = toDate(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 10月17日 星期五 */
export function fmtHomeDate(v = new Date()) {
  const d = toDate(v);
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
}

/** 09:42 */
export function fmtTime(v) {
  const d = toDate(v);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 2026-10-17 09:42 */
export function fmtDateTime(v) {
  const d = toDate(v);
  return `${dateKey(d)} ${fmtTime(d)}`;
}

/** 今天 · 10月17日 / 昨天 · 10月16日 / 10月15日 / 2025年10月15日 */
export function fmtDayLabel(v) {
  const d = toDate(v);
  const now = new Date();
  const today = dateKey(now);
  const key = dateKey(d);
  if (key === today) return `今天 · ${d.getMonth() + 1}月${d.getDate()}日`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (key === dateKey(y)) return `昨天 · ${d.getMonth() + 1}月${d.getDate()}日`;
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** datetime-local 输入框的值：2026-10-17T09:42 */
export function toLocalInput(v) {
  const d = toDate(v);
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 把 datetime-local 的值转成 ISO */
export function fromLocalInput(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** 某月第一天 00:00（本地） */
export function startOfMonth(v = new Date()) {
  const d = toDate(v);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** 今天 23:59:59.999（本地） */
export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** 文件安全的时间戳：2026-10-17 */
export function stamp(v = new Date()) {
  return dateKey(v);
}
