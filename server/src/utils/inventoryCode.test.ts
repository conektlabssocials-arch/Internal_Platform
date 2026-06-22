import assert from 'node:assert/strict';
import test from 'node:test';

import { getCategoryCode, formatInventoryCode } from './inventoryCode.js';

test('Mall / SOH uses the MALL category code', () => {
  assert.equal(getCategoryCode('Mall / SOH'), 'MALL');
});

test('formatInventoryCode builds a MALL-prefixed code for Mall / SOH', () => {
  assert.equal(
    formatInventoryCode('Mall / SOH', 'Bangalore', 'Whitefield', 1),
    'MALL-BLR-WHI-0001',
  );
});
