export function atMidnight(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function getMonday(date) {
  const midnight = atMidnight(date);
  const day = midnight.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(midnight, diff);
}

export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(ds) {
  if (!ds) {
    throw new Error('Cannot parse empty date string');
  }
  const [y, m, d] = ds.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: ${ds}`);
  }
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function weekdayName(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

export function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

