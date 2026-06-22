export type StoreSettingsIdentity = {
  storeId?: string | null;
  tenantId?: string | null;
};

export type StoreSettingsRecord = {
  id: string;
};

export function boundStoreId(identity?: StoreSettingsIdentity | null): string {
  return identity?.storeId || identity?.tenantId || '';
}

export function selectStoreForSettings<T extends StoreSettingsRecord>(
  stores: T[],
  identity?: StoreSettingsIdentity | null,
): { store: T | null; extrasReturned: boolean } {
  const id = boundStoreId(identity);
  const extrasReturned = stores.length > 1;

  if (id) {
    return {
      store: stores.find(store => store.id === id) || null,
      extrasReturned,
    };
  }

  return {
    store: stores.length === 1 ? stores[0] : null,
    extrasReturned,
  };
}
