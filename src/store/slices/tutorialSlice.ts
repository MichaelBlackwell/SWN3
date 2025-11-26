import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TutorialModuleId } from '../../tutorial/tutorialConfig';
import { TUTORIAL_MODULES } from '../../tutorial/tutorialConfig';

interface TutorialState {
  activeModule: TutorialModuleId | null;
  currentStepIndex: number;
  isVisible: boolean;
  completedModules: Partial<Record<TutorialModuleId, boolean>>;
}

const initialState: TutorialState = {
  activeModule: null,
  currentStepIndex: 0,
  isVisible: false,
  completedModules: {},
};

const advanceStep = (state: TutorialState) => {
  if (!state.activeModule) {
    return;
  }

  const moduleConfig = TUTORIAL_MODULES[state.activeModule];
  if (!moduleConfig) {
    return;
  }

  const isLastStep = state.currentStepIndex >= moduleConfig.steps.length - 1;
  if (isLastStep) {
    state.completedModules[state.activeModule] = true;
    state.activeModule = null;
    state.currentStepIndex = 0;
    state.isVisible = false;
    return;
  }

  state.currentStepIndex += 1;
};

export const tutorialSlice = createSlice({
  name: 'tutorial',
  initialState,
  reducers: {
    startTutorialModule(state, action: PayloadAction<TutorialModuleId>) {
      state.activeModule = action.payload;
      state.currentStepIndex = 0;
      state.isVisible = true;
    },
    closeTutorial(state) {
      state.isVisible = false;
      state.activeModule = null;
      state.currentStepIndex = 0;
    },
    nextTutorialStep(state) {
      advanceStep(state);
    },
    previousTutorialStep(state) {
      if (state.activeModule) {
        state.currentStepIndex = Math.max(0, state.currentStepIndex - 1);
      }
    },
    tutorialEventOccurred(state, action: PayloadAction<{ eventId: string }>) {
      if (!state.activeModule) return;
      const moduleConfig = TUTORIAL_MODULES[state.activeModule];
      const currentStep = moduleConfig?.steps[state.currentStepIndex];
      if (currentStep?.completionEvent === action.payload.eventId) {
        advanceStep(state);
      }
    },
  },
});

export const {
  startTutorialModule,
  closeTutorial,
  nextTutorialStep,
  previousTutorialStep,
  tutorialEventOccurred,
} = tutorialSlice.actions;

export default tutorialSlice.reducer;



