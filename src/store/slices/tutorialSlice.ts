import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string; // CSS selector for the target element
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  actionRequired?: string; // Description of action required to proceed
  viewMode?: 'sector' | 'factions'; // Expected view mode for this step
}

interface TutorialState {
  isActive: boolean;
  currentStepIndex: number;
}

const initialState: TutorialState = {
  isActive: false,
  currentStepIndex: 0,
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Faction Turn Simulator',
    content: 'This tutorial will guide you through the basics of managing factions in Stars Without Number. Click "Next" to begin.',
    position: 'center',
    viewMode: 'sector',
  },
  {
    id: 'systems',
    title: 'Systems',
    content: 'The sector map shows various star systems. Hover over a system to see basic info. Click on a system to view details.',
    targetSelector: '.sector-map__system', // We might need a more specific selector or ID later
    position: 'right',
    actionRequired: 'Select a star system',
    viewMode: 'sector',
  },
  {
    id: 'planets',
    title: 'World Details',
    content: 'Here you can see details about the planets in the system, including Tech Level and existing Assets.',
    targetSelector: '.world-details',
    position: 'left',
    viewMode: 'sector',
  },
  {
    id: 'connections',
    title: 'Hyperspace Routes',
    content: 'Lines between systems represent hyperspace routes. Assets can travel between connected systems based on their range.',
    targetSelector: '.sector-map__connection',
    position: 'bottom',
    viewMode: 'sector',
  },
  {
    id: 'factions_view',
    title: 'Factions Management',
    content: 'Now let\'s manage your faction. Click the "Factions" tab to switch views.',
    targetSelector: 'button[aria-label="Switch to Factions view"]',
    position: 'bottom',
    actionRequired: 'Switch to Factions view',
    viewMode: 'sector',
  },
  {
    id: 'assets',
    title: 'Faction Assets',
    content: 'This dashboard shows your faction\'s statistics and assets. Assets are your tools for influencing the sector.',
    targetSelector: '.faction-dashboard__stats',
    position: 'bottom',
    viewMode: 'factions',
  },
  {
    id: 'buying_assets',
    title: 'Buying Assets',
    content: 'You can purchase new assets if you have enough FacCreds and the required attributes. Try buying a "Smugglers" asset (Cunning 1).',
    targetSelector: '.asset-list__category--cunning button', // Approximate selector
    position: 'right',
    actionRequired: 'Buy an asset',
    viewMode: 'factions',
  },
  {
    id: 'moving_assets',
    title: 'Moving Assets',
    content: 'Most assets can move between systems. Select an asset and use the "Move" action to send it to a nearby system.',
    targetSelector: '.owned-asset-item',
    position: 'left',
    viewMode: 'factions',
  },
  {
    id: 'spreading_influence',
    title: 'Spreading Influence',
    content: 'To operate on a world, you usually need a Base of Influence. Use the "Expand Influence" action to establish a base on a new world.',
    targetSelector: '.expand-influence-button',
    position: 'top',
    viewMode: 'factions',
  },
  {
    id: 'conclusion',
    title: 'Tutorial Complete',
    content: 'You now know the basics! Explore the sector, build your faction, and compete for dominance.',
    position: 'center',
    viewMode: 'factions',
  },
];

const tutorialSlice = createSlice({
  name: 'tutorial',
  initialState,
  reducers: {
    startTutorial: (state) => {
      state.isActive = true;
      state.currentStepIndex = 0;
    },
    endTutorial: (state) => {
      state.isActive = false;
      state.currentStepIndex = 0;
    },
    nextStep: (state) => {
      if (state.currentStepIndex < TUTORIAL_STEPS.length - 1) {
        state.currentStepIndex += 1;
      } else {
        state.isActive = false;
      }
    },
    previousStep: (state) => {
      if (state.currentStepIndex > 0) {
        state.currentStepIndex -= 1;
      }
    },
    setStep: (state, action: PayloadAction<number>) => {
      state.currentStepIndex = action.payload;
    },
  },
});

export const { startTutorial, endTutorial, nextStep, previousStep, setStep } = tutorialSlice.actions;

// Selectors
export const selectIsTutorialActive = (state: RootState) => state.tutorial.isActive;
export const selectCurrentTutorialStepIndex = (state: RootState) => state.tutorial.currentStepIndex;
export const selectCurrentTutorialStep = (state: RootState) => TUTORIAL_STEPS[state.tutorial.currentStepIndex];

export default tutorialSlice.reducer;

