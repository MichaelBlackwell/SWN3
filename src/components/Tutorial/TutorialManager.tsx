import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { closeTutorial, nextTutorialStep, previousTutorialStep } from '../../store/slices/tutorialSlice';
import { TUTORIAL_MODULES } from '../../tutorial/tutorialConfig';
import KeywordTooltipText from './KeywordTooltipText';
import './TutorialManager.css';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TutorialManager = () => {
  const dispatch = useDispatch();
  const tutorialState = useSelector((state: RootState) => state.tutorial);
  const moduleConfig = tutorialState.activeModule ? TUTORIAL_MODULES[tutorialState.activeModule] : null;
  const currentStep = moduleConfig ? moduleConfig.steps[tutorialState.currentStepIndex] : null;

  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const resolvedSelectors = useMemo(() => {
    if (!currentStep?.targetSelectors || currentStep.targetSelectors.length === 0) {
      return [];
    }
    return currentStep.targetSelectors;
  }, [currentStep]);

  useLayoutEffect(() => {
    if (!tutorialState.isVisible || !currentStep || resolvedSelectors.length === 0) {
      setSpotlight(null);
      return;
    }

    let activeElement: Element | null = null;
    for (const selector of resolvedSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        activeElement = el;
        break;
      }
    }

    if (!activeElement) {
      setSpotlight(null);
      return;
    }

    if (currentStep.autoScroll && 'scrollIntoView' in activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    const padding = currentStep.highlightPadding ?? 12;

    const updateSpotlight = () => {
      const rect = activeElement!.getBoundingClientRect();
      setSpotlight({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };

    updateSpotlight();

    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);

    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [tutorialState.isVisible, currentStep, resolvedSelectors]);

  useEffect(() => {
    if (!tutorialState.isVisible) {
      setSpotlight(null);
    }
  }, [tutorialState.isVisible]);

  if (!tutorialState.isVisible || !moduleConfig || !currentStep) {
    return null;
  }

  const stepCount = moduleConfig.steps.length;
  const isFirstStep = tutorialState.currentStepIndex === 0;
  const isLastStep = tutorialState.currentStepIndex === stepCount - 1;

  return (
    <div className="tutorial-manager" role="dialog" aria-live="polite">
      {spotlight && (
        <div
          className="tutorial-manager__spotlight"
          style={{
            top: `${spotlight.top}px`,
            left: `${spotlight.left}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
          }}
          aria-hidden
        />
      )}

      <div className="tutorial-manager__panel" role="document">
        <div className="tutorial-manager__panel-header">
          <div>
            <p className="tutorial-manager__module-label">{moduleConfig.title}</p>
            <h3 className="tutorial-manager__step-title">{currentStep.title}</h3>
          </div>
          <button
            className="tutorial-manager__close"
            onClick={() => dispatch(closeTutorial())}
            aria-label="Close tutorial"
          >
            ✕
          </button>
        </div>

        <KeywordTooltipText text={currentStep.body} className="tutorial-manager__body" />

        <div className="tutorial-manager__progress">
          Step {tutorialState.currentStepIndex + 1} of {stepCount}
        </div>

        <div className="tutorial-manager__actions">
          <button
            className="tutorial-manager__button tutorial-manager__button--ghost"
            onClick={() => dispatch(closeTutorial())}
          >
            Exit
          </button>
          <button
            className="tutorial-manager__button tutorial-manager__button--ghost"
            onClick={() => dispatch(previousTutorialStep())}
            disabled={isFirstStep}
          >
            Back
          </button>
          <button
            className="tutorial-manager__button tutorial-manager__button--primary"
            onClick={() => dispatch(nextTutorialStep())}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialManager;

