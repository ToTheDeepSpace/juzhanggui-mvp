import assert from 'node:assert/strict';
import { selectStoreForSettings } from '../client/src/utils/storeSettings';

const stores = [
  { id: 'store-a', name: 'A店' },
  { id: 'store-b', name: 'B店' },
  { id: 'store-c', name: 'C店' },
];

const byStoreId = selectStoreForSettings(stores, { storeId: 'store-b', tenantId: 'store-a' });
assert.equal(byStoreId.store?.id, 'store-b', 'storeId should take priority over tenantId');
assert.equal(byStoreId.extrasReturned, true, 'multiple returned stores should be flagged');

const byTenantId = selectStoreForSettings(stores, { tenantId: 'store-c' });
assert.equal(byTenantId.store?.id, 'store-c', 'tenantId should be used when storeId is absent');

const mismatched = selectStoreForSettings(stores, { storeId: 'store-x', tenantId: 'store-y' });
assert.equal(mismatched.store, null, 'mismatched multi-store responses must not fall back to another store');

const singleWithoutIdentity = selectStoreForSettings([{ id: 'only-store', name: 'Only' }], {});
assert.equal(singleWithoutIdentity.store?.id, 'only-store', 'single-store response can be used when identity is missing');

console.log('store settings guard smoke passed');
