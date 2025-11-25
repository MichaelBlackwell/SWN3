/**
 * AudioManager - Singleton service for managing game audio
 *
 * Handles background music and sound effects using Howler.js.
 * Features:
 * - Cross-browser audio support
 * - Music crossfading between tracks
 * - Individual sound effect files (lazy loaded)
 * - Volume control with master/music/sfx channels
 * - Browser autoplay policy compliance
 */

import { Howl, Howler } from 'howler';

export type SoundEffectId =
  // UI sounds
  | 'ui_click'
  | 'ui_hover'
  | 'ui_modal_open'
  | 'ui_modal_close'
  // Phase sounds
  | 'phase_income'
  | 'phase_maintenance'
  | 'phase_action'
  | 'phase_news'
  | 'turn_complete'
  // Combat sounds
  | 'combat_attack'
  | 'combat_hit'
  | 'combat_miss'
  | 'combat_critical'
  | 'combat_destroyed'
  // Asset sounds
  | 'asset_purchase'
  | 'asset_sell'
  | 'asset_repair'
  | 'asset_move'
  // Notification sounds
  | 'notify_success'
  | 'notify_error'
  | 'notify_warning'
  | 'notify_info';

export type MusicTrackId =
  | 'menu'
  | 'frontier_wars'
  | 'trade_empire'
  | 'scream_aftermath'
  | 'galactic_core'
  | 'generic_gameplay'
  | 'combat';

interface MusicTrack {
  id: MusicTrackId;
  howl: Howl | null;
  src: string;
  loaded: boolean;
}

interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  isMuted: false,
};

// Music track definitions
const MUSIC_TRACKS: Record<MusicTrackId, string> = {
  menu: '/assets/audio/music/menu.mp3',
  frontier_wars: '/assets/audio/music/frontier_wars.mp3',
  trade_empire: '/assets/audio/music/trade_empire.mp3',
  scream_aftermath: '/assets/audio/music/scream_aftermath.mp3',
  galactic_core: '/assets/audio/music/galactic_core.mp3',
  generic_gameplay: '/assets/audio/music/generic_gameplay.mp3',
  combat: '/assets/audio/music/combat.mp3',
};

// Individual sound effect file definitions
const SFX_FILES: Record<SoundEffectId, string> = {
  // UI sounds
  ui_click: '/assets/audio/sfx/ui_click.mp3',
  ui_hover: '/assets/audio/sfx/ui_hover.mp3',
  ui_modal_open: '/assets/audio/sfx/ui_modal_open.mp3',
  ui_modal_close: '/assets/audio/sfx/ui_modal_close.mp3',
  // Phase sounds
  phase_income: '/assets/audio/sfx/phase_income.mp3',
  phase_maintenance: '/assets/audio/sfx/phase_maintenance.mp3',
  phase_action: '/assets/audio/sfx/phase_action.mp3',
  phase_news: '/assets/audio/sfx/phase_news.mp3',
  turn_complete: '/assets/audio/sfx/turn_complete.mp3',
  // Combat sounds
  combat_attack: '/assets/audio/sfx/combat_attack.mp3',
  combat_hit: '/assets/audio/sfx/combat_hit.mp3',
  combat_miss: '/assets/audio/sfx/combat_miss.mp3',
  combat_critical: '/assets/audio/sfx/combat_critical.mp3',
  combat_destroyed: '/assets/audio/sfx/combat_destroyed.mp3',
  // Asset sounds
  asset_purchase: '/assets/audio/sfx/asset_purchase.mp3',
  asset_sell: '/assets/audio/sfx/asset_sell.mp3',
  asset_repair: '/assets/audio/sfx/asset_repair.mp3',
  asset_move: '/assets/audio/sfx/asset_move.mp3',
  // Notification sounds
  notify_success: '/assets/audio/sfx/notify_success.mp3',
  notify_error: '/assets/audio/sfx/notify_error.mp3',
  notify_warning: '/assets/audio/sfx/notify_warning.mp3',
  notify_info: '/assets/audio/sfx/notify_info.mp3',
};

class AudioManager {
  private static instance: AudioManager | null = null;

  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private isInitialized = false;
  private audioUnlocked = false;

  // Music state
  private musicTracks: Map<MusicTrackId, MusicTrack> = new Map();
  private currentMusicId: MusicTrackId | null = null;
  private currentMusicHowl: Howl | null = null;

  // SFX state
  private sfxSounds: Map<SoundEffectId, Howl> = new Map();
  private sfxLoading: Set<SoundEffectId> = new Set();

  private readonly CROSSFADE_DURATION = 2000; // ms

  private constructor() {
    // Singleton
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public initialize(): void {
    if (this.isInitialized) return;

    Howler.autoUnlock = true;
    Howler.html5PoolSize = 10;

    Object.entries(MUSIC_TRACKS).forEach(([id, src]) => {
      this.musicTracks.set(id as MusicTrackId, {
        id: id as MusicTrackId,
        howl: null,
        src,
        loaded: false,
      });
    });

    this.isInitialized = true;
    console.log('[AudioManager] Initialized');
  }

  public unlockAudio(): void {
    if (this.audioUnlocked) return;

    const silentHowl = new Howl({
      src: [
        'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZGN0HRAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZGN0HRAAAAAAAAAAAAAAAAAAAA',
      ],
      volume: 0,
      onend: () => {
        this.audioUnlocked = true;
        console.log('[AudioManager] Audio unlocked');
      },
    });
    silentHowl.play();
  }

  public updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    Howler.mute(this.settings.isMuted);

    if (this.currentMusicHowl) {
      this.currentMusicHowl.volume(this.getEffectiveMusicVolume());
    }

    this.sfxSounds.forEach(howl => {
      howl.volume(this.getEffectiveSfxVolume());
    });
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private getEffectiveMusicVolume(): number {
    return this.settings.masterVolume * this.settings.musicVolume;
  }

  private getEffectiveSfxVolume(): number {
    return this.settings.masterVolume * this.settings.sfxVolume;
  }

  private loadMusicTrack(trackId: MusicTrackId): Promise<Howl> {
    return new Promise((resolve, reject) => {
      const track = this.musicTracks.get(trackId);
      if (!track) {
        reject(new Error(`Unknown track: ${trackId}`));
        return;
      }

      if (track.howl && track.loaded) {
        resolve(track.howl);
        return;
      }

      const howl = new Howl({
        src: [track.src],
        loop: true,
        volume: 0,
        html5: true,
        onload: () => {
          track.howl = howl;
          track.loaded = true;
          console.log(`[AudioManager] Loaded music: ${trackId}`);
          resolve(howl);
        },
        onloaderror: (_id, error) => {
          console.warn(`[AudioManager] Failed to load music: ${trackId}`, error);
          reject(error);
        },
      });
    });
  }

  public async playMusic(trackId: MusicTrackId): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[AudioManager] Not initialized');
      return;
    }

    if (this.currentMusicId === trackId && this.currentMusicHowl?.playing()) {
      return;
    }

    try {
      const newHowl = await this.loadMusicTrack(trackId);
      const targetVolume = this.getEffectiveMusicVolume();

      if (this.currentMusicHowl && this.currentMusicHowl.playing()) {
        const oldHowl = this.currentMusicHowl;
        oldHowl.fade(oldHowl.volume(), 0, this.CROSSFADE_DURATION);
        setTimeout(() => oldHowl.stop(), this.CROSSFADE_DURATION);

        newHowl.volume(0);
        newHowl.play();
        newHowl.fade(0, targetVolume, this.CROSSFADE_DURATION);
      } else {
        newHowl.volume(targetVolume);
        newHowl.play();
      }

      this.currentMusicHowl = newHowl;
      this.currentMusicId = trackId;
    } catch (error) {
      console.error(`[AudioManager] Error playing music: ${trackId}`, error);
    }
  }

  public stopMusic(fadeOut = true): void {
    if (!this.currentMusicHowl) return;

    if (fadeOut) {
      this.currentMusicHowl.fade(this.currentMusicHowl.volume(), 0, this.CROSSFADE_DURATION);
      setTimeout(() => {
        this.currentMusicHowl?.stop();
        this.currentMusicHowl = null;
        this.currentMusicId = null;
      }, this.CROSSFADE_DURATION);
    } else {
      this.currentMusicHowl.stop();
      this.currentMusicHowl = null;
      this.currentMusicId = null;
    }
  }

  public pauseMusic(): void {
    this.currentMusicHowl?.pause();
  }

  public resumeMusic(): void {
    this.currentMusicHowl?.play();
  }

  private loadSfxFile(soundId: SoundEffectId): Promise<Howl> {
    return new Promise((resolve, reject) => {
      const existing = this.sfxSounds.get(soundId);
      if (existing) {
        resolve(existing);
        return;
      }

      if (this.sfxLoading.has(soundId)) {
        setTimeout(() => {
          const loaded = this.sfxSounds.get(soundId);
          if (loaded) {
            resolve(loaded);
          } else {
            reject(new Error(`Still loading: ${soundId}`));
          }
        }, 300);
        return;
      }

      const src = SFX_FILES[soundId];
      if (!src) {
        reject(new Error(`Unknown sound: ${soundId}`));
        return;
      }

      this.sfxLoading.add(soundId);

      const howl = new Howl({
        src: [src],
        volume: this.getEffectiveSfxVolume(),
        preload: true,
        onload: () => {
          this.sfxSounds.set(soundId, howl);
          this.sfxLoading.delete(soundId);
          resolve(howl);
        },
        onloaderror: (_id, error) => {
          this.sfxLoading.delete(soundId);
          console.warn(`[AudioManager] Failed to load SFX: ${soundId}`, error);
          reject(error);
        },
      });
    });
  }

  public preloadCommonSfx(): void {
    const commonSounds: SoundEffectId[] = ['ui_click', 'notify_success', 'notify_error', 'notify_info'];
    commonSounds.forEach(id => {
      this.loadSfxFile(id).catch(() => {
        // optional
      });
    });
  }

  public playSfx(soundId: SoundEffectId): void {
    if (!this.isInitialized) {
      console.warn('[AudioManager] Not initialized');
      return;
    }

    const existing = this.sfxSounds.get(soundId);
    if (existing) {
      existing.volume(this.getEffectiveSfxVolume());
      existing.play();
      return;
    }

    this.loadSfxFile(soundId)
      .then(howl => {
        howl.play();
      })
      .catch(() => {
        // optional
      });
  }

  public setMasterVolume(volume: number): void {
    this.updateSettings({ masterVolume: Math.max(0, Math.min(1, volume)) });
  }

  public setMusicVolume(volume: number): void {
    this.updateSettings({ musicVolume: Math.max(0, Math.min(1, volume)) });
  }

  public setSfxVolume(volume: number): void {
    this.updateSettings({ sfxVolume: Math.max(0, Math.min(1, volume)) });
  }

  public toggleMute(): void {
    this.updateSettings({ isMuted: !this.settings.isMuted });
  }

  public setMuted(muted: boolean): void {
    this.updateSettings({ isMuted: muted });
  }

  public isMuted(): boolean {
    return this.settings.isMuted;
  }

  public getCurrentMusicId(): MusicTrackId | null {
    return this.currentMusicId;
  }

  public isMusicPlaying(): boolean {
    return this.currentMusicHowl?.playing() ?? false;
  }

  public dispose(): void {
    this.stopMusic(false);
    this.sfxSounds.forEach(howl => howl.unload());
    this.sfxSounds.clear();
    this.sfxLoading.clear();

    this.musicTracks.forEach(track => track.howl?.unload());
    this.musicTracks.clear();

    this.isInitialized = false;
    console.log('[AudioManager] Disposed');
  }
}

export const audioManager = AudioManager.getInstance();

export type { AudioSettings, MusicTrack };
