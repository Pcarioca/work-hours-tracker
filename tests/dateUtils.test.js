import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDate, getMonday, parseLocalDate } from '../js/dateUtils.js';

test('formatDate + parseLocalDate round-trip without timezone drift', () => {
  const sample = new Date();
  sample.setFullYear(2024, 5, 10);
  sample.setHours(3, 45, 0, 0);
  const formatted = formatDate(sample);
  const parsed = parseLocalDate(formatted);
  assert.equal(parsed.getFullYear(), sample.getFullYear());
  assert.equal(parsed.getMonth(), sample.getMonth());
  assert.equal(parsed.getDate(), sample.getDate());
});

test('getMonday returns same date for Mondays and rewinds for Sundays', () => {
  const monday = new Date(2024, 5, 10); // Monday
  const sunday = new Date(2024, 5, 16); // Sunday
  const monFromMonday = getMonday(monday);
  const monFromSunday = getMonday(sunday);
  assert.equal(monFromMonday.getDay(), 1);
  assert.equal(monFromSunday.getDay(), 1);
  assert.equal(formatDate(monFromSunday), '2024-06-10');
});

test('addDays preserves local date math', () => {
  const date = new Date(2024, 0, 31);
  const plusOne = addDays(date, 1);
  assert.equal(formatDate(plusOne), '2024-02-01');
});
