/**
 * AudioSettings Component
 * 
 * A settings panel for controlling audio volumes and mute state.
 * Can be used as a standalone panel or embedded in a modal.
 */

import { useState } from 'react';
import { useAudio } from '../../hooks/useAudio';
import './AudioSettings.css';

interface AudioSettingsProps {
  /** Whether to show as a compact inline control */
  compact?: boolean;
  /** Callback when settings panel is closed */
  onClose?: () => void;
}

export default function AudioSettings({ compact = false, onClose }: AudioSettingsProps) {
  const {
    masterVolume,
    musicVolume,
    sfxVolume,
    isMuted,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    toggleMute,
    playSfx,
  } = useAudio();

  // Preview sound on SFX volume change
  const handleSfxChange = (value: number) => {
    setSfxVolume(value);
    // Play a preview sound after a small delay to let volume update
    setTimeout(() => playSfx('ui_click'), 50);
  };

  if (compact) {
    return (
      <div className="audio-settings audio-settings--compact">
        <button
          className="audio-settings__mute-btn"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={masterVolume * 100}
          onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
          className="audio-settings__slider audio-settings__slider--compact"
          aria-label="Master Volume"
          title={`Volume: ${Math.round(masterVolume * 100)}%`}
        />
      </div>
    );
  }

  return (
    <div className="audio-settings">
      <div className="audio-settings__header">
        <h3 className="audio-settings__title">
          <span className="audio-settings__icon">🎵</span>
          Audio Settings
        </h3>
        {onClose && (
          <button className="audio-settings__close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="audio-settings__content">
        {/* Master Volume */}
        <div className="audio-settings__control">
          <div className="audio-settings__control-header">
            <label className="audio-settings__label">Master Volume</label>
            <span className="audio-settings__value">{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume * 100}
            onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
            className="audio-settings__slider"
          />
        </div>

        {/* Music Volume */}
        <div className="audio-settings__control">
          <div className="audio-settings__control-header">
            <label className="audio-settings__label">🎶 Music</label>
            <span className="audio-settings__value">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={musicVolume * 100}
            onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
            className="audio-settings__slider audio-settings__slider--music"
          />
        </div>

        {/* SFX Volume */}
        <div className="audio-settings__control">
          <div className="audio-settings__control-header">
            <label className="audio-settings__label">🔊 Sound Effects</label>
            <span className="audio-settings__value">{Math.round(sfxVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={sfxVolume * 100}
            onChange={(e) => handleSfxChange(Number(e.target.value) / 100)}
            className="audio-settings__slider audio-settings__slider--sfx"
          />
        </div>

        {/* Mute Toggle */}
        <div className="audio-settings__mute-section">
          <button
            className={`audio-settings__mute-toggle ${isMuted ? 'audio-settings__mute-toggle--muted' : ''}`}
            onClick={toggleMute}
          >
            <span className="audio-settings__mute-icon">
              {isMuted ? '🔇' : '🔊'}
            </span>
            <span className="audio-settings__mute-text">
              {isMuted ? 'Sound Off' : 'Sound On'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AudioSettingsButton - A button that opens the audio settings panel
 */
export function AudioSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { isMuted } = useAudio();

  return (
    <div className="audio-settings-button-container">
      <button
        className="audio-settings-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Audio Settings"
        title="Audio Settings"
      >
        {isMuted ? '🔇' : '🎵'}
      </button>
      
      {isOpen && (
        <>
          <div 
            className="audio-settings-overlay" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="audio-settings-popup">
            <AudioSettings onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

