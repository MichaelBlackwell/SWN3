export type TutorialModuleId = 'mapNavigation' | 'assetManagement' | 'influence';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /**
   * Ordered list of selectors to spotlight. First match wins.
   */
  targetSelectors?: string[];
  /**
   * Extra padding (px) around spotlighted element.
   */
  highlightPadding?: number;
  /**
   * Automatically advance when this event fires.
   */
  completionEvent?: string;
  /**
   * Scroll the target into view when the step becomes active.
   */
  autoScroll?: boolean;
}

export interface TutorialModule {
  id: TutorialModuleId;
  title: string;
  summary: string;
  steps: TutorialStep[];
}

const mapNavigationModule: TutorialModule = {
  id: 'mapNavigation',
  title: 'Map Navigation',
  summary: 'Learn how to explore systems, inspect worlds, and read spike routes on the sector map.',
  steps: [
    {
      id: 'overview',
      title: 'Explore the Sector',
      body: 'The sector map tracks every Asset, Tag, and route in play. Use it to see which factions project Force, Cunning, or Wealth across nearby systems.',
      targetSelectors: ['.sector-map-container'],
      highlightPadding: 24,
    },
    {
      id: 'select-system',
      title: 'Select Any System',
      body: 'Click a system marker to focus it. The glow indicates a selected world, and its assets update in the sidebar.',
      targetSelectors: ['.sector-map-container .system-marker-group'],
      highlightPadding: 18,
      completionEvent: 'mapNavigation.systemSelected',
      autoScroll: true,
    },
    {
      id: 'inspect-details',
      title: 'Inspect World Details',
      body: 'Use the World Details panel to read the world’s Tags, economy, and connected factions. This panel explains why a world is valuable.',
      targetSelectors: ['.world-details-panel'],
      highlightPadding: 16,
      autoScroll: true,
    },
    {
      id: 'highlight-routes',
      title: 'Spike Routes & Trade Lanes',
      body: 'Hover over the blue spike routes or orange trade connections to see how assets can move. Routes determine which systems your Force or Wealth assets can reach in one turn.',
      targetSelectors: ['.sector-map-container .routes'],
      highlightPadding: 20,
      completionEvent: 'mapNavigation.routeHovered',
    },
    {
      id: 'wrap-up',
      title: 'Great! Ready for Actions',
      body: 'You can now navigate systems, inspect Assets, and read Tags. Continue through the tutorials to learn how to move assets and expand influence.',
      targetSelectors: ['.sector-map-view__sidebar', '.sector-map-container'],
      highlightPadding: 16,
    },
  ],
};

const assetManagementModule: TutorialModule = {
  id: 'assetManagement',
  title: 'Asset Lifecycle',
  summary: 'Procure new units, redeploy them via movement, and launch an opening attack.',
  steps: [
    {
      id: 'open-store',
      title: 'Open the Asset Store',
      body: 'Use the procurement terminal to spend FacCreds on a new Asset. Each Asset references its Force, Cunning, or Wealth requirements from the SWN faction rules.',
      targetSelectors: ['.asset-store-preview__btn'],
      highlightPadding: 18,
      completionEvent: 'assetTutorial.openStore',
    },
    {
      id: 'inspect-card',
      title: 'Inspect Asset Details',
      body: 'Hover an Asset card to review cost, Tech Level, Attack profile, and any Special Tags. Assets with Special features reference the FACTIONS catalog.',
      targetSelectors: ['.asset-list-grid .asset-card'],
      highlightPadding: 16,
      completionEvent: 'assetTutorial.assetInspected',
      autoScroll: true,
    },
    {
      id: 'purchase-asset',
      title: 'Purchase an Asset',
      body: 'Click Purchase to add the unit to your homeworld. Costs are deducted immediately, just like the FACTIONS buy action.',
      targetSelectors: ['.asset-card-purchase-btn'],
      highlightPadding: 16,
      completionEvent: 'assetTutorial.assetPurchased',
    },
    {
      id: 'select-system',
      title: 'Select the Asset’s System',
      body: 'Return to the Sector Map and select the world where the new Asset spawned. World details let you issue Move or Attack commands.',
      targetSelectors: ['.sector-map-container .system-marker-group', '.sector-map-container'],
      highlightPadding: 20,
      completionEvent: 'assetTutorial.assetSystemSelected',
    },
    {
      id: 'start-move',
      title: 'Start a Move Order',
      body: 'Use the Move button next to your Asset. Movement consumes 1 FacCred and must follow Spike Routes or adjacent hexes as described in FACTIONS.',
      targetSelectors: ['.world-details-action-btn--move'],
      highlightPadding: 14,
      completionEvent: 'assetTutorial.moveButtonPressed',
    },
    {
      id: 'complete-move',
      title: 'Choose a Destination',
      body: 'Click a highlighted hex to immediately execute the MOVE_ASSET action. The highlight matches valid Spike Route destinations.',
      targetSelectors: ['.sector-map-container .system-marker-group.valid-destination', '.sector-map-container'],
      highlightPadding: 20,
      completionEvent: 'assetTutorial.assetMoveCompleted',
    },
    {
      id: 'launch-attack',
      title: 'Initiate an Attack',
      body: 'Target a rival Asset from the World Details panel. Attacks follow the 1d10 + Attribute contest from the FACTIONS combat rules.',
      targetSelectors: ['.world-details-action-btn--attack'],
      highlightPadding: 14,
      completionEvent: 'assetTutorial.assetAttackInitiated',
    },
  ],
};

export const TUTORIAL_MODULES: Record<TutorialModuleId, TutorialModule> = {
  mapNavigation: mapNavigationModule,
  assetManagement: assetManagementModule,
  influence: {
    id: 'influence',
    title: 'Expanding Influence',
    summary: 'Guide a faction through qualifying requirements, selecting a target, and staging the Expand Influence action.',
    steps: [
      {
        id: 'open-dashboard',
        title: 'Open the Faction Dashboard',
        body: 'Select your faction dossier. Ensure it has at least one Asset in the target system, as required by the FACTIONS Expand Influence action.',
        targetSelectors: ['.faction-dashboard'],
        highlightPadding: 20,
        completionEvent: 'influenceTutorial.dashboardFocused',
      },
      {
        id: 'open-expand-modal',
        title: 'Launch the Expand Influence modal',
        body: 'Click the Expand Influence button. You must choose a world where you already possess an Asset, and pay 1 FacCred per Base HP, just like in the SWN rules.',
        targetSelectors: ['.expand-influence-btn'],
        highlightPadding: 16,
        completionEvent: 'influenceTutorial.expandModalOpened',
      },
      {
        id: 'select-world',
        title: 'Choose a System',
        body: 'Select a system that satisfies the prerequisites (existing Asset + FacCreds). The modal filters valid targets automatically.',
        targetSelectors: ['.expand-influence-modal .target-world-card'],
        highlightPadding: 12,
        completionEvent: 'influenceTutorial.targetSelected',
        autoScroll: true,
      },
      {
        id: 'confirm-expand',
        title: 'Confirm the Expansion',
        body: 'Confirm investment to stage the Expand Influence action. Success will add a Base of Influence, mirroring the FACTIONS Expand action.',
        targetSelectors: ['.expand-influence-modal .confirm-btn'],
        highlightPadding: 12,
        completionEvent: 'influenceTutorial.expandConfirmed',
      },
      {
        id: 'review-result',
        title: 'Review Influence Status',
        body: 'Close the modal and inspect the World Details panel to confirm the new Base. Influence determines where you can buy new Assets.',
        targetSelectors: ['.world-details-panel', '.faction-dashboard'],
        highlightPadding: 24,
      },
    ],
  },
};


