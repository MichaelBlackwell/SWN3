import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store/store';
import {
  endTutorial,
  nextStep,
  previousStep,
  selectCurrentTutorialStep,
  selectCurrentTutorialStepIndex,
  selectIsTutorialActive,
  TUTORIAL_STEPS,
} from '../../store/slices/tutorialSlice';
import './TutorialManager.css';

// Helper to find element position
interface ElementPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TutorialManager = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isActive = useSelector(selectIsTutorialActive);
  const currentStep = useSelector(selectCurrentTutorialStep);
  const currentStepIndex = useSelector(selectCurrentTutorialStepIndex);
  const selectedSystemId = useSelector((state: RootState) => state.sector.selectedSystemId);
  const viewMode = useSelector((state: RootState) => state.gameMode.currentView);
  
  // Selectors to monitor for auto-advancement
  const factions = useSelector((state: RootState) => state.factions.factions);
  const assets = factions.flatMap(f => f.assets);

  const [targetRect, setTargetRect] = useState<ElementPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  
  // Refs to track previous state for change detection
  const prevSelectedSystemId = useRef(selectedSystemId);
  const prevAssetsCount = useRef(assets.length);
  const prevViewMode = useRef(viewMode);
  
  // Track asset locations to detect moves
  const prevAssetLocations = useRef<Record<string, string>>({});
  // Track Base of Influence count
  const prevBoiCount = useRef(0);

  // Dragging State
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset offset when step changes
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [currentStep]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    // Store the mouse position relative to the current offset
    dragStart.current = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setDragOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // Empty dep array since we use refs and setter

  // Force update when DOM might have changed
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Update tracked refs when assets change
    const currentLocations: Record<string, string> = {};
    let boiCount = 0;
    
    assets.forEach(a => {
      currentLocations[a.id] = a.location;
      // definitionId might be 'base_of_influence' or we check definition via other means if needed
      // Here we assume definitionId for Base of Influence is 'base_of_influence'
      if (a.definitionId === 'base_of_influence') {
        boiCount++;
      }
    });
    
    if (currentStep?.id === 'moving_assets') {
      // Check for any location change
      const hasMove = assets.some(a => {
        const prevLoc = prevAssetLocations.current[a.id];
        return prevLoc && prevLoc !== a.location;
      });
      
      if (hasMove) {
        dispatch(nextStep());
      }
    }

    if (currentStep?.id === 'spreading_influence') {
      if (boiCount > prevBoiCount.current) {
        dispatch(nextStep());
      }
    }

    // Update refs for next render
    prevAssetLocations.current = currentLocations;
    prevBoiCount.current = boiCount;
  }, [assets, currentStep, dispatch]); // Run whenever assets change

  useEffect(() => {
    if (!isActive) return;

    const handleResize = () => forceUpdate({});
    window.addEventListener('resize', handleResize);
    
    // Poll for element existence/position changes
    const interval = setInterval(() => forceUpdate({}), 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, [isActive]);

  // Logic for positioning tooltip and highlight
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const updatePosition = () => {
      // Default position (center of screen)
      let newRect: ElementPosition | null = null;

      if (currentStep.targetSelector) {
        const element = document.querySelector(currentStep.targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          newRect = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          };
        }
      }

      setTargetRect(newRect);

      // Calculate tooltip position
      if (newRect) {
        let top = 0;
        let left = 0;
        const spacing = 20;

        // Basic positioning logic
        switch (currentStep.position) {
          case 'top':
            top = newRect.top - spacing - 150; // Approximate height
            left = newRect.left + newRect.width / 2 - 175; // Center width
            break;
          case 'bottom':
            top = newRect.top + newRect.height + spacing;
            left = newRect.left + newRect.width / 2 - 175;
            break;
          case 'left':
            top = newRect.top + newRect.height / 2 - 75;
            left = newRect.left - spacing - 350;
            break;
          case 'right':
            top = newRect.top + newRect.height / 2 - 75;
            left = newRect.left + newRect.width + spacing;
            break;
          default: // center or fallback
            top = window.innerHeight / 2 - 100;
            left = window.innerWidth / 2 - 175;
        }
        
        // Boundary checks (simple)
        if (left < 20) left = 20;
        if (left > window.innerWidth - 370) left = window.innerWidth - 370;
        if (top < 20) top = 20;
        if (top > window.innerHeight - 200) top = window.innerHeight - 200;

        setTooltipPos({ top, left });
      } else {
        // Center screen
        setTooltipPos({
          top: window.innerHeight / 2 - 100,
          left: window.innerWidth / 2 - 175,
        });
      }
    };

    // Run immediately and after a short delay to allow DOM to settle
    updatePosition();
    const timer = setTimeout(updatePosition, 100);
    return () => clearTimeout(timer);
  }, [isActive, currentStep, currentStepIndex, viewMode]); // Re-run when step or view changes

  // Logic for auto-advancing steps
  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Check for specific conditions to advance
    if (currentStep.id === 'systems' && selectedSystemId !== prevSelectedSystemId.current && selectedSystemId) {
       dispatch(nextStep());
    }
    
    if (currentStep.id === 'factions_view' && viewMode === 'factions' && prevViewMode.current !== 'factions') {
       dispatch(nextStep());
    }

    if (currentStep.id === 'buying_assets' && assets.length > prevAssetsCount.current) {
      dispatch(nextStep());
    }

    // Add more conditions here for other steps (moving, expanding influence)
    // For moving and expanding influence, we might need to track other state changes or specific actions
    // For now, 'buying_assets' covers one state change. 
    
    // Update refs
    prevSelectedSystemId.current = selectedSystemId;
    prevAssetsCount.current = assets.length;
    prevViewMode.current = viewMode;

  }, [isActive, currentStep, selectedSystemId, assets.length, viewMode, dispatch]);


  if (!isActive || !currentStep) return null;

  return (
    <div className="tutorial-overlay">
      {targetRect && (
        <div 
          className="tutorial-highlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}
      
      <div 
        className="tutorial-tooltip"
        style={{
          top: tooltipPos.top + dragOffset.y,
          left: tooltipPos.left + dragOffset.x,
        }}
        onMouseDown={handleMouseDown}
      >
        <h3>{currentStep.title}</h3>
        <p>{currentStep.content}</p>
        
        <div className="tutorial-tooltip__actions">
          <span className="tutorial-tooltip__progress">
            Step {currentStepIndex + 1} of {TUTORIAL_STEPS.length}
          </span>
          
          <div className="tutorial-tooltip__buttons">
            <button 
              className="tutorial-button"
              onClick={() => dispatch(endTutorial())}
            >
              Skip
            </button>
            
            {currentStepIndex > 0 && (
              <button 
                className="tutorial-button"
                onClick={() => dispatch(previousStep())}
              >
                Back
              </button>
            )}
            
            {/* Only show Next if no action is explicitly required, OR if we want to allow bypassing */}
            {!currentStep.actionRequired && currentStepIndex < TUTORIAL_STEPS.length - 1 && (
              <button 
                className="tutorial-button tutorial-button--primary"
                onClick={() => dispatch(nextStep())}
              >
                Next
              </button>
            )}
            
            {currentStepIndex === TUTORIAL_STEPS.length - 1 && (
               <button 
               className="tutorial-button tutorial-button--primary"
               onClick={() => dispatch(endTutorial())}
             >
               Finish
             </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialManager;

