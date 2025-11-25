/**
 * useAudio Hook
 * 
 * React hook for accessing and controlling the audio system.
 * Provides:
 * - Volume controls
 * - Sound effect playback
 * - Music control
 * - Mute toggle
 * 
 * Automatically syncs Redux state with AudioManager.
 */

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  audioManager, 
  type SoundEffectId, 
  type MusicTrackId 
} from '../services/AudioManager';
import {
  setMasterVolume,
  setMusicVolume,
  setSfxVolume,
  toggleMute,
  setMuted,
  selectAudioSettings,
} from '../store/slices/audioSlice';
import type { RootState } from '../store/store';

/**
 * Main audio hook - provides all audio controls
 */
export function useAudio() {
  const dispatch = useDispatch();
  const settings = useSelector(selectAudioSettings);

  // Initialize AudioManager and sync settings on mount
  useEffect(() => {
    audioManager.initialize();
    audioManager.updateSettings(settings);
  }, []);

  // Sync AudioManager with Redux state changes
  useEffect(() => {
    audioManager.updateSettings(settings);
  }, [settings]);

  // Volume controls
  const setMaster = useCallback((volume: number) => {
    dispatch(setMasterVolume(volume));
  }, [dispatch]);

  const setMusic = useCallback((volume: number) => {
    dispatch(setMusicVolume(volume));
  }, [dispatch]);

  const setSfx = useCallback((volume: number) => {
    dispatch(setSfxVolume(volume));
  }, [dispatch]);

  // Mute controls
  const toggle = useCallback(() => {
    dispatch(toggleMute());
  }, [dispatch]);

  const mute = useCallback((muted: boolean) => {
    dispatch(setMuted(muted));
  }, [dispatch]);

  // Music controls
  const playMusic = useCallback((trackId: MusicTrackId) => {
    audioManager.playMusic(trackId);
  }, []);

  const stopMusic = useCallback((fadeOut: boolean = true) => {
    audioManager.stopMusic(fadeOut);
  }, []);

  const pauseMusic = useCallback(() => {
    audioManager.pauseMusic();
  }, []);

  const resumeMusic = useCallback(() => {
    audioManager.resumeMusic();
  }, []);

  // SFX playback
  const playSfx = useCallback((soundId: SoundEffectId) => {
    audioManager.playSfx(soundId);
  }, []);

  // Unlock audio (call on first user interaction)
  const unlockAudio = useCallback(() => {
    audioManager.unlockAudio();
  }, []);

  return {
    // Current settings
    masterVolume: settings.masterVolume,
    musicVolume: settings.musicVolume,
    sfxVolume: settings.sfxVolume,
    isMuted: settings.isMuted,
    
    // Volume setters
    setMasterVolume: setMaster,
    setMusicVolume: setMusic,
    setSfxVolume: setSfx,
    
    // Mute controls
    toggleMute: toggle,
    setMuted: mute,
    
    // Music controls
    playMusic,
    stopMusic,
    pauseMusic,
    resumeMusic,
    
    // SFX
    playSfx,
    
    // Utilities
    unlockAudio,
    isMusicPlaying: () => audioManager.isMusicPlaying(),
    getCurrentMusicId: () => audioManager.getCurrentMusicId(),
  };
}

/**
 * useSound Hook
 * 
 * Simplified hook for playing sound effects.
 * Returns a function to play the specified sound.
 * 
 * @example
 * const playClick = useSound('ui_click');
 * <button onClick={playClick}>Click me</button>
 */
export function useSound(soundId: SoundEffectId) {
  const isMuted = useSelector((state: RootState) => state.audio.isMuted);

  const play = useCallback(() => {
    if (!isMuted) {
      audioManager.playSfx(soundId);
    }
  }, [soundId, isMuted]);

  return play;
}

/**
 * useSoundEffect Hook
 * 
 * Hook that returns a function to play any sound effect.
 * Useful when you need to play different sounds conditionally.
 * 
 * @example
 * const playSound = useSoundEffect();
 * playSound('ui_click');
 * playSound('notify_success');
 */
export function useSoundEffect() {
  const isMuted = useSelector((state: RootState) => state.audio.isMuted);

  const play = useCallback((soundId: SoundEffectId) => {
    if (!isMuted) {
      audioManager.playSfx(soundId);
    }
  }, [isMuted]);

  return play;
}

/**
 * useGameMusic Hook
 * 
 * Hook for managing game music based on current game state.
 * Automatically plays appropriate music for scenarios.
 */
export function useGameMusic() {
  const gameMode = useSelector((state: RootState) => state.gameMode.mode);
  const currentScenario = useSelector((state: RootState) => state.gameMode.currentScenario);
  const isMuted = useSelector((state: RootState) => state.audio.isMuted);

  useEffect(() => {
    // Initialize audio manager
    audioManager.initialize();
  }, []);

  useEffect(() => {
    if (isMuted) return;

    // Map game state to music track
    if (gameMode === 'menu') {
      audioManager.playMusic('menu');
    } else if (gameMode === 'scenario' && currentScenario) {
      // Map scenario name to music track
      const scenarioMusicMap: Record<string, MusicTrackId> = {
        'The Frontier Wars': 'frontier_wars',
        'Trade Empire': 'trade_empire',
        'The Scream Aftermath': 'scream_aftermath',
        'Galactic Core': 'galactic_core',
        'Random Sector': 'generic_gameplay',
      };
      
      const trackId = scenarioMusicMap[currentScenario.name] || 'generic_gameplay';
      audioManager.playMusic(trackId);
    } else if (gameMode === 'editor') {
      audioManager.playMusic('generic_gameplay');
    }
  }, [gameMode, currentScenario, isMuted]);

  return {
    playMusic: (trackId: MusicTrackId) => audioManager.playMusic(trackId),
    stopMusic: () => audioManager.stopMusic(),
  };
}

// Re-export types for convenience
export type { SoundEffectId, MusicTrackId };

