# Audio Assets

This directory contains all audio files for the Stars Without Number Faction Turn Simulator.

## Directory Structure

```
audio/
├── music/           # Background music tracks
│   ├── menu.mp3              # Main menu theme
│   ├── frontier_wars.mp3     # "The Frontier Wars" scenario
│   ├── trade_empire.mp3      # "Trade Empire" scenario
│   ├── scream_aftermath.mp3  # "The Scream Aftermath" scenario
│   ├── galactic_core.mp3     # "Galactic Core" scenario
│   ├── generic_gameplay.mp3  # Generic/editor gameplay
│   └── combat.mp3            # Combat intensity music
│
└── sfx/             # Sound effects
    ├── ui_sprite.mp3         # Audio sprite with all UI sounds
    └── ui_sprite.webm        # WebM fallback for compatibility
```

## Music Track Themes

Generate these using AI music services (Suno, Udio, Stable Audio):

| Track | Theme/Mood | Suggested Prompt |
|-------|------------|------------------|
| `menu.mp3` | Majestic, inviting | "Epic cinematic space theme, orchestral, hopeful and grand, video game main menu, 80s sci-fi inspired" |
| `frontier_wars.mp3` | Pioneer, tense | "Frontier western in space, synthesizers and strings, hopeful but with underlying tension, exploration theme" |
| `trade_empire.mp3` | Prosperous, elegant | "Bustling space station, prosperous trading hub, elegant electronic, busy but sophisticated" |
| `scream_aftermath.mp3` | Dark, haunting | "Post-apocalyptic space, eerie ambient, desolate and haunting, dark synth pads, minimal and atmospheric" |
| `galactic_core.mp3` | Grand, political | "Grand orchestral space opera, political intrigue, dramatic and sweeping, imperial court in space" |
| `generic_gameplay.mp3` | Ambient, strategic | "Ambient space strategy game, calm synthesizers, thinking music, gentle pulses, contemplative" |
| `combat.mp3` | Intense, action | "Space battle music, intense electronic, driving percussion, urgent but not chaotic" |

## Sound Effects Sprite

The UI sprite should contain these sounds in order (see `AudioManager.ts` for exact timings):

| Sound ID | Start (ms) | Duration (ms) | Description |
|----------|------------|---------------|-------------|
| `ui_click` | 0 | 150 | Button click |
| `ui_hover` | 200 | 100 | Subtle hover feedback |
| `ui_modal_open` | 400 | 300 | Modal/panel opening |
| `ui_modal_close` | 800 | 250 | Modal/panel closing |
| `phase_income` | 2000 | 400 | Income phase start |
| `phase_maintenance` | 2500 | 400 | Maintenance phase start |
| `phase_action` | 3000 | 400 | Action phase start |
| `phase_news` | 3500 | 400 | News phase start |
| `turn_complete` | 4000 | 600 | Turn completion chime |
| `combat_attack` | 5000 | 400 | Attack initiated |
| `combat_hit` | 5500 | 300 | Successful hit |
| `combat_miss` | 6000 | 300 | Attack missed |
| `combat_critical` | 6500 | 500 | Critical hit |
| `combat_destroyed` | 7000 | 800 | Asset destroyed |
| `asset_purchase` | 8000 | 400 | Asset purchased |
| `asset_sell` | 8500 | 350 | Asset sold |
| `asset_repair` | 9000 | 400 | Asset repaired |
| `asset_move` | 9500 | 300 | Asset moved |
| `notify_success` | 10000 | 400 | Success notification |
| `notify_error` | 10500 | 400 | Error notification |
| `notify_warning` | 11000 | 350 | Warning notification |
| `notify_info` | 11500 | 300 | Info notification |

## Audio Requirements

- **Format**: MP3 (primary), WebM (fallback)
- **Music**: 128-192kbps, stereo, seamless loop
- **SFX**: 128kbps, mono is fine for small sounds
- **Total sprite length**: ~12 seconds

## Tools for Creating Audio

- **AI Music**: [Suno](https://suno.ai), [Udio](https://udio.com), [Stable Audio](https://stableaudio.com)
- **SFX Libraries**: [Freesound](https://freesound.org), [Pixabay](https://pixabay.com/sound-effects/)
- **Audio Sprite Tool**: [audiosprite](https://github.com/tonistiigi/audiosprite)
- **Audio Editor**: [Audacity](https://www.audacityteam.org/)

## Creating the Audio Sprite

```bash
# Install audiosprite
npm install -g audiosprite

# Create sprite from individual files
audiosprite -o ui_sprite -f howler *.wav
```

Or manually combine in Audacity and update the sprite timings in `AudioManager.ts`.

