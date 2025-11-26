import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import type { FactionAsset } from '../../types/faction';
import { getAssetById } from '../../data/assetLibrary';
import { assetHasAbility, isFreeAction, executeAbility } from '../../utils/assetAbilities';
import { stageActionWithPayload, selectCanStageAction, selectCurrentTurn } from '../../store/slices/turnSlice';
import {
  assetHasSpecialFeatures,
  getSpecialFeaturesForDisplay,
} from '../../utils/assetSpecialFeatures';
import { canAssetUseAbility, getAssetIneligibilityReason } from '../../utils/assetEligibility';
import { showNotification } from '../NotificationContainer';
import './OwnedAssetItem.css';

interface OwnedAssetItemProps {
  asset: FactionAsset;
  assetName: string;
  systemName: string;
  factionId: string;
  onSell?: (assetId: string) => void;
}

export default function OwnedAssetItem({
  asset,
  assetName,
  systemName,
  factionId,
  onSell,
}: OwnedAssetItemProps) {
  const dispatch = useDispatch();
  const canStageAction = useSelector(selectCanStageAction);
  const currentTurn = useSelector(selectCurrentTurn);
  const faction = useSelector((state: RootState) =>
    state.factions.factions.find((f: { id: string }) => f.id === factionId)
  );
  const state = useSelector((state: RootState) => state);

  const assetDef = getAssetById(asset.definitionId);
  const hasAbility = assetDef && assetHasAbility(asset.definitionId);
  const freeAction = hasAbility && isFreeAction(asset.definitionId);
  
  // Check if asset can act (not newly purchased or refitted)
  const assetCanAct = canAssetUseAbility(asset, currentTurn);
  const ineligibilityReason = getAssetIneligibilityReason(asset, currentTurn);

  const handleUseAbility = () => {
    if (!faction) {
      showNotification('Faction not found', 'error');
      return;
    }

    // Check if asset can act (not newly purchased or refitted)
    if (!assetCanAct) {
      showNotification(`Cannot use ability: ${ineligibilityReason}`, 'error');
      return;
    }

    // For free actions, we can use them even if an action is already staged
    if (!freeAction && !canStageAction) {
      showNotification('Cannot use ability: not in Action phase or action already staged', 'error');
      return;
    }

    // Execute the ability
    const result = executeAbility(faction, asset, state);

    if (!result.success && result.message.includes('handled through')) {
      // Movement abilities are handled separately
      showNotification(result.message, 'info');
      return;
    }

    if (!result.success && result.message.includes('not yet implemented')) {
      showNotification(result.message, 'info');
      return;
    }

    // Stage the ability action (only if it requires an action slot)
    if (result.requiresAction) {
      dispatch(stageActionWithPayload({
        type: 'USE_ABILITY',
        payload: {
          factionId,
          assetId: asset.id,
          abilityResult: {
            facCredsGained: result.facCredsGained,
            facCredsLost: result.facCredsLost,
            cost: result.cost,
            shouldDestroyAsset: result.data?.shouldDestroy as boolean,
          },
        },
      }));
      showNotification(`${result.message}. Action staged - commit to execute.`, 'info');
    } else {
      // Free action - execute immediately
      // For now, we'll still stage it but mark it as free
      // The turn manager should handle free actions differently
      showNotification(result.message, 'info');
      // TODO: Handle immediate execution for free actions
    }
  };

  // Calculate refund amount for display
  const refundAmount = assetDef ? Math.floor(assetDef.cost / 2) : 0;

  return (
    <div className="owned-asset-item">
      <div className="asset-item-header">
        <div className="asset-item-name">{assetName}</div>
        <div className="asset-item-actions">
          {hasAbility && (
            <button
              className={`asset-ability-btn ${freeAction ? 'free-action' : ''}`}
              onClick={handleUseAbility}
              disabled={!assetCanAct || (!freeAction && !canStageAction)}
              title={
                !assetCanAct
                  ? ineligibilityReason || 'Asset cannot act this turn'
                  : freeAction
                    ? 'Free action (does not consume action slot)'
                    : 'Use special ability'
              }
            >
              {freeAction ? '⚡ Ability' : 'Ability'}
            </button>
          )}
          {onSell && (
            <button
              className="asset-sell-btn"
              onClick={() => onSell(asset.id)}
              title={`Sell for ${refundAmount} FacCreds (half of original cost)`}
            >
              Sell
            </button>
          )}
        </div>
      </div>
      <div className="asset-item-location">Location: {systemName}</div>
      <div className="asset-item-hp">
        HP: {asset.hp} / {asset.maxHp}
      </div>
      {asset.stealthed && <div className="asset-item-stealth">Stealthed</div>}

      {assetDef && assetHasSpecialFeatures(asset.definitionId) && (
        <div className="owned-asset-special-features">
          <div className="owned-asset-special-features-label">Special Features:</div>
          <div className="owned-asset-special-features-content">
            {getSpecialFeaturesForDisplay(asset.definitionId).map((feature, index) => (
              <div key={index} className="owned-asset-feature-item">
                {feature.appliesAtLabel && (
                  <span className="owned-asset-feature-timing">{feature.appliesAtLabel}: </span>
                )}
                <span className="owned-asset-feature-description">{feature.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

