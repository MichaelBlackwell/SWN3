import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import {
  getAllAssetsForFaction,
  getAssetsByCategory,
} from '../../data/assetLibrary';
import type { AssetCategory } from '../../types/asset';
import AssetCard from './AssetCard';
import './AssetList.css';
import KeywordTooltipText, { highlightKeywords } from '../Tutorial/KeywordTooltipText';

interface AssetListProps {
  factionId: string | null;
  onPurchase?: (assetDefinitionId: string) => void;
  onDragStart?: () => void; // Optional callback for drag start
}

export default function AssetList({ factionId, onPurchase }: AssetListProps) {
  const factions = useSelector((state: RootState) => state.factions.factions);
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const faction = factionId
    ? factions.find((f: { id: string }) => f.id === factionId)
    : null;

  if (!faction) {
    return (
      <div className="asset-list-empty">
        <p>Select a faction to view available assets</p>
      </div>
    );
  }

  // Filter assets based on faction's ratings
  const availableAssets = getAllAssetsForFaction(
    faction.attributes.force,
    faction.attributes.cunning,
    faction.attributes.wealth
  );

  // Apply category filter
  let filteredAssets = availableAssets;
  if (categoryFilter !== 'All') {
    filteredAssets = getAssetsByCategory(categoryFilter).filter((asset) =>
      availableAssets.includes(asset)
    );
  }

  // Apply search filter
  if (searchTerm.trim()) {
    const search = searchTerm.toLowerCase();
    filteredAssets = filteredAssets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(search) ||
        asset.category.toLowerCase().includes(search) ||
        asset.type.toLowerCase().includes(search)
    );
  }

  // Sort by category, then by required rating, then by name
  filteredAssets.sort((a, b) => {
    if (a.category !== b.category) {
      const order = { Force: 0, Cunning: 1, Wealth: 2 };
      return order[a.category] - order[b.category];
    }
    if (a.requiredRating !== b.requiredRating) {
      return a.requiredRating - b.requiredRating;
    }
    return a.name.localeCompare(b.name);
  });

  const handlePurchase = (assetDefinitionId: string) => {
    if (onPurchase) {
      onPurchase(assetDefinitionId);
    }
  };

  return (
    <div className="asset-list">
      <div className="asset-list-header">
        <h2>
          Available <KeywordTooltipText as="span" text="Assets" />
        </h2>
        <div className="asset-list-info">
          {highlightKeywords(
            `Showing ${filteredAssets.length} of ${availableAssets.length} assets`,
            'asset-list-count',
          )}
        </div>
      </div>

      <div className="asset-list-controls">
        <div className="asset-list-search">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="asset-list-filters">
          {(['All', 'Force', 'Cunning', 'Wealth'] as const).map((category) => (
            <button
              key={category}
              className={`filter-btn ${categoryFilter === category ? 'active' : ''}`}
              onClick={() => setCategoryFilter(category)}
            >
              {category === 'All' ? 'All' : <KeywordTooltipText as="span" text={category} />}
            </button>
          ))}
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="asset-list-empty">
          <p>
            {searchTerm || categoryFilter !== 'All'
              ? 'No assets match your filters'
              : 'No assets available for this faction'}
          </p>
        </div>
      ) : (
        <div className="asset-list-grid">
          {filteredAssets.map((asset) => {
            const canAfford = faction.facCreds >= asset.cost;
            const canPurchase =
              (asset.category === 'Force' &&
                faction.attributes.force >= asset.requiredRating) ||
              (asset.category === 'Cunning' &&
                faction.attributes.cunning >= asset.requiredRating) ||
              (asset.category === 'Wealth' &&
                faction.attributes.wealth >= asset.requiredRating);

            return (
              <AssetCard
                key={asset.id}
                asset={asset}
                canAfford={canAfford}
                canPurchase={canPurchase}
                onPurchase={handlePurchase}
                isDraggable={true}
                factionId={factionId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

