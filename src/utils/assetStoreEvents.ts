export const ASSET_STORE_OPEN_EVENT = 'asset-store:open';

export interface AssetStoreEventDetail {
  factionId?: string | null;
}

/**
 * Broadcast a request to open the asset store. Any listener may respond.
 * If factionId is provided, only listeners for that faction should react.
 */
export function dispatchOpenAssetStoreEvent(factionId?: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const event = new CustomEvent<AssetStoreEventDetail>(ASSET_STORE_OPEN_EVENT, {
    detail: { factionId },
  });

  window.dispatchEvent(event);
}


