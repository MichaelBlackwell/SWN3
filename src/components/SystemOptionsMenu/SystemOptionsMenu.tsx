import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SaveMenu from '../SaveMenu/SaveMenu';
import { AudioSettingsButton } from '../AudioSettings';
import './SystemOptionsMenu.css';

type TutorialModule = 'mapNavigation' | 'assetManagement' | 'influence';

interface SystemOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToMenu: () => void;
  onStartTutorial: (module: TutorialModule) => void;
  canGenerateSector?: boolean;
  onGenerateSector?: () => void;
}

export default function SystemOptionsMenu({
  isOpen,
  onClose,
  onReturnToMenu,
  onStartTutorial,
  canGenerateSector = false,
  onGenerateSector,
}: SystemOptionsMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const closeButton = panelRef.current.querySelector<HTMLButtonElement>('[data-close-button]');
      closeButton?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const content = (
    <div className="system-options-menu" role="dialog" aria-modal="true" aria-label="System options">
      <div className="system-options-menu__overlay" onClick={onClose} />
      <div className="system-options-menu__panel" ref={panelRef} role="document">
        <header className="system-options-menu__header">
          <div>
            <p className="system-options-menu__eyebrow">Campaign Console</p>
            <h2 className="system-options-menu__title">System Options</h2>
          </div>
          <button
            type="button"
            className="system-options-menu__close"
            onClick={onClose}
            aria-label="Close system options"
            data-close-button
          >
            ✕
          </button>
        </header>

        <section className="system-options-menu__group">
          <h3 className="system-options-menu__group-title">Quick Controls</h3>
          <div className="system-options-menu__control-row">
            <div className="system-options-menu__audio">
              <AudioSettingsButton />
              <span>Audio Settings</span>
            </div>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="btn btn-ghost system-options-menu__action"
            >
              ← Return to Main Menu
            </button>
            {canGenerateSector && onGenerateSector && (
              <button
                type="button"
                onClick={() => {
                  onGenerateSector();
                  onClose();
                }}
                className="btn btn-primary system-options-menu__action"
              >
                Generate New Sector
              </button>
            )}
          </div>
        </section>

        <section className="system-options-menu__group">
          <h3 className="system-options-menu__group-title">Tutorials</h3>
          <div className="system-options-menu__stack">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onStartTutorial('mapNavigation')}
              aria-label="Start map navigation tutorial"
            >
              Map Tutorial
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onStartTutorial('assetManagement')}
              aria-label="Start asset management tutorial"
            >
              Asset Tutorial
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onStartTutorial('influence')}
              aria-label="Start influence tutorial"
            >
              Influence Tutorial
            </button>
          </div>
        </section>

        <section className="system-options-menu__group">
          <h3 className="system-options-menu__group-title">Data Management</h3>
          <p className="system-options-menu__description">
            Export your current session or import a previously saved campaign.
          </p>
          <SaveMenu />
        </section>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}


