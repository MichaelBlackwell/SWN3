/**
 * Audio State Slice
 * 
 * Manages audio settings state in Redux:
 * - Master volume
 * - Music volume
 * - SFX volume
 * - Mute state
 * 
 * Settings are automatically persisted to localStorage.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const STORAGE_KEY = 'audioSettings';

export interface AudioState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}

const DEFAULT_STATE: AudioState = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  isMuted: false,
};

/**
 * Load audio settings from localStorage
 */
function loadFromStorage(): AudioState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        masterVolume: typeof parsed.masterVolume === 'number' ? parsed.masterVolume : DEFAULT_STATE.masterVolume,
        musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : DEFAULT_STATE.musicVolume,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULT_STATE.sfxVolume,
        isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : DEFAULT_STATE.isMuted,
      };
    }
  } catch (error) {
    console.warn('[audioSlice] Failed to load settings from localStorage:', error);
  }
  return DEFAULT_STATE;
}

/**
 * Save audio settings to localStorage
 */
function saveToStorage(state: AudioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[audioSlice] Failed to save settings to localStorage:', error);
  }
}

const initialState: AudioState = loadFromStorage();

const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    /**
     * Set master volume (0-1)
     */
    setMasterVolume: (state, action: PayloadAction<number>) => {
      state.masterVolume = Math.max(0, Math.min(1, action.payload));
      saveToStorage(state);
    },

    /**
     * Set music volume (0-1)
     */
    setMusicVolume: (state, action: PayloadAction<number>) => {
      state.musicVolume = Math.max(0, Math.min(1, action.payload));
      saveToStorage(state);
    },

    /**
     * Set SFX volume (0-1)
     */
    setSfxVolume: (state, action: PayloadAction<number>) => {
      state.sfxVolume = Math.max(0, Math.min(1, action.payload));
      saveToStorage(state);
    },

    /**
     * Toggle mute state
     */
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
      saveToStorage(state);
    },

    /**
     * Set mute state directly
     */
    setMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
      saveToStorage(state);
    },

    /**
     * Update all audio settings at once
     */
    updateAudioSettings: (state, action: PayloadAction<Partial<AudioState>>) => {
      if (action.payload.masterVolume !== undefined) {
        state.masterVolume = Math.max(0, Math.min(1, action.payload.masterVolume));
      }
      if (action.payload.musicVolume !== undefined) {
        state.musicVolume = Math.max(0, Math.min(1, action.payload.musicVolume));
      }
      if (action.payload.sfxVolume !== undefined) {
        state.sfxVolume = Math.max(0, Math.min(1, action.payload.sfxVolume));
      }
      if (action.payload.isMuted !== undefined) {
        state.isMuted = action.payload.isMuted;
      }
      saveToStorage(state);
    },

    /**
     * Reset to default settings
     */
    resetAudioSettings: (state) => {
      Object.assign(state, DEFAULT_STATE);
      saveToStorage(state);
    },
  },
});

export const {
  setMasterVolume,
  setMusicVolume,
  setSfxVolume,
  toggleMute,
  setMuted,
  updateAudioSettings,
  resetAudioSettings,
} = audioSlice.actions;

export default audioSlice.reducer;

// Selectors
export const selectMasterVolume = (state: { audio: AudioState }) => state.audio.masterVolume;
export const selectMusicVolume = (state: { audio: AudioState }) => state.audio.musicVolume;
export const selectSfxVolume = (state: { audio: AudioState }) => state.audio.sfxVolume;
export const selectIsMuted = (state: { audio: AudioState }) => state.audio.isMuted;
export const selectAudioSettings = (state: { audio: AudioState }) => state.audio;

