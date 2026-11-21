import test from 'node:test';
import assert from 'node:assert/strict';
import { cn, formatDate, demoAccounts } from '../src/shared/utils/helpers.js';

test('cn joins classes cleanly without falsy values', () => {
  assert.equal(cn('btn', false, null, undefined, 'btn-primary', ''), 'btn btn-primary');
  assert.equal(cn(['a', 'b'], 'c'), 'a b c');
});

test('formatDate outputs formatted dates correctly', () => {
  const d = new Date(2025, 0, 15);
  const formatted = formatDate(d, 'PPP');
  assert.match(formatted, /January 15, 2025/);

  const shortFormat = formatDate(d, 'MMM dd, yyyy');
  assert.match(shortFormat, /Jan 15, 2025/);
});

test('demo accounts mapping verifies correct roles', () => {
  assert.equal(demoAccounts['student@alaminschools.edu.ng'].type, 'student');
  assert.equal(demoAccounts['staff@alaminschools.edu.ng'].type, 'staff');
  assert.equal(demoAccounts['teacher@alaminschools.edu.ng'].type, 'staff');
  assert.equal(demoAccounts['admin@alaminschools.edu.ng'].type, 'admin');
  assert.equal(demoAccounts['invalid@example.com'], undefined);
});
