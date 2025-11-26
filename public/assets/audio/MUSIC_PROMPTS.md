# AI Music Generation Prompts for Stars Without Number

Use these prompts with **Suno AI** (suno.com) or **Udio** (udio.com) to generate the themed background music tracks.

## General Tips for Best Results

- **Duration**: Request 2-3 minute tracks (they loop well)
- **Instrumental**: Always specify "instrumental" to avoid vocals
- **Loop-friendly**: Ask for ambient/seamless endings
- **Format**: Download as MP3, 192kbps minimum
- **Multiple generations**: Generate 3-4 versions and pick the best

---

## 🎵 Track 1: Main Menu Theme
**File**: `menu.mp3`

### Suno Prompt:
```
epic cinematic space orchestral, synthesizers and strings, hopeful and grand, 
main menu video game music, 80s sci-fi inspired, blade runner meets mass effect, 
sweeping melodies, ambient pads, instrumental, loop-friendly ending
```

### Style Tags (Suno v3.5):
```
cinematic, orchestral, electronic, space, epic, ambient
```

### Mood Description:
Majestic and inviting. The first thing players hear - should evoke the wonder of space exploration and the drama of interstellar politics. Think: looking out at a vast star field from a space station viewport.

---

## 🎵 Track 2: The Frontier Wars
**File**: `frontier_wars.mp3`

### Suno Prompt:
```
frontier western in space, acoustic guitar meets synthesizers, hopeful but tense undertones,
exploration theme, dusty outpost vibes, firefly inspired, ambient electronic,
sparse percussion, wide open spaces, instrumental, seamless loop
```

### Style Tags:
```
western, electronic, ambient, cinematic, atmospheric
```

### Mood Description:
Pioneer spirit with underlying tension. Like settlers on the edge of known space - hopeful about new opportunities but aware of the dangers. Sparse, open sound with occasional tension building.

---

## 🎵 Track 3: Trade Empire
**File**: `trade_empire.mp3`

### Suno Prompt:
```
bustling space station ambience, prosperous trading hub music, elegant electronic,
sophisticated jazz fusion meets synthwave, busy but refined, corporate luxury,
smooth basslines, shimmering pads, instrumental lounge, seamless loop
```

### Style Tags:
```
jazz fusion, synthwave, electronic, lounge, sophisticated
```

### Mood Description:
Wealth and prosperity. Busy starports, merchant guilds, economic power. Elegant but with energy - the sound of credits flowing and deals being made in gleaming corporate towers.

---

## 🎵 Track 4: The Scream Aftermath
**File**: `scream_aftermath.mp3`

### Suno Prompt:
```
post-apocalyptic space ambient, eerie and desolate, dark atmospheric synth,
haunting drone music, abandoned space station, dead civilization vibes,
minimal and sparse, unsettling undertones, dark ambient horror, instrumental loop
```

### Style Tags:
```
dark ambient, drone, atmospheric, horror, minimal
```

### Mood Description:
Desolation and loss. The galaxy after catastrophe - empty stations, dead worlds, the echoes of a fallen civilization. Sparse, haunting, with occasional unsettling elements. Should feel lonely and slightly creepy.

---

## 🎵 Track 5: Galactic Core
**File**: `galactic_core.mp3`

### Suno Prompt:
```
grand orchestral space opera, imperial court intrigue, dramatic and sweeping,
political thriller soundtrack, star wars meets game of thrones, brass and strings,
majestic but with tension, power and ambition, instrumental cinematic, loop-friendly
```

### Style Tags:
```
orchestral, cinematic, epic, dramatic, classical
```

### Mood Description:
Power and politics at the heart of civilization. Grand courts, ancient dynasties, complex schemes. Majestic and dramatic - the sound of empires rising and falling. Dense, layered, sophisticated.

---

## 🎵 Track 6: Generic Gameplay / Editor
**File**: `generic_gameplay.mp3`

### Suno Prompt:
```
ambient space strategy game music, calm synthesizers, thinking music,
gentle electronic pulses, contemplative and focused, stargazing ambient,
soft pads, minimal melody, concentration music, instrumental seamless loop
```

### Style Tags:
```
ambient, electronic, minimal, chill, atmospheric
```

### Mood Description:
Calm strategic thinking. Background music that doesn't distract but keeps you engaged. Good for long planning sessions. Gentle, unobtrusive, but still atmospheric and space-themed.

---

## 🎵 Track 7: Combat (Optional)
**File**: `combat.mp3`

### Suno Prompt:
```
space battle music, intense electronic action, driving percussion,
urgent but controlled, tactical combat soundtrack, mass effect combat vibes,
pulsing synths, dramatic builds, instrumental action, loop-friendly
```

### Style Tags:
```
electronic, action, intense, cinematic, driving
```

### Mood Description:
Tactical intensity without being chaotic. Fleet engagements, asset attacks, faction warfare. Driving but not overwhelming - players still need to think strategically during combat.

---

## 🔊 Sound Effects Sources

For UI sound effects, consider these free resources:

### Recommended Sites:
- **Freesound.org** - Large library of CC0 sounds
- **Pixabay.com/sound-effects** - Free for commercial use
- **OpenGameArt.org** - Game-specific sounds
- **Kenney.nl/assets** - High-quality game assets

### Search Terms for SWN Theme:
- "sci-fi UI beep"
- "space interface click"
- "holographic button"
- "futuristic notification"
- "spaceship computer"
- "energy shield"
- "laser impact"
- "explosion distant"

### AI Sound Effect Generation:
- **ElevenLabs Sound Effects** - elevenlabs.io/sound-effects
- **Stable Audio** - stableaudio.com (good for short sounds)

---

## Creating the Audio Sprite

Once you have individual sound effect files:

```bash
# Install audiosprite globally
npm install -g audiosprite

# Navigate to your sfx folder with individual .wav or .mp3 files
cd public/assets/audio/sfx/individual/

# Generate the sprite (creates ui_sprite.mp3 and ui_sprite.json)
audiosprite -o ../ui_sprite -f howler2 -e mp3 *.wav *.mp3

# The JSON file will contain the timing offsets
# Update AudioManager.ts SFX_SPRITE_DEFINITION with those timings
```

### Manual Alternative (Audacity):
1. Open Audacity
2. Import all sound files
3. Arrange on timeline with gaps (note start times)
4. Export as MP3
5. Update `SFX_SPRITE_DEFINITION` in `AudioManager.ts` with your timings

---

## File Checklist

After generation, ensure you have:

```
public/assets/audio/
├── music/
│   ├── menu.mp3              ✓
│   ├── frontier_wars.mp3     ✓
│   ├── trade_empire.mp3      ✓
│   ├── scream_aftermath.mp3  ✓
│   ├── galactic_core.mp3     ✓
│   ├── generic_gameplay.mp3  ✓
│   └── combat.mp3            (optional)
│
└── sfx/
    ├── ui_sprite.mp3         ✓
    └── ui_sprite.webm        (optional fallback)
```

---

## Quick Test

After adding audio files, run:
```bash
npm run dev
```

Open the game, click anywhere to unlock audio, then use the 🎵 button to verify:
- Volume sliders work
- Music plays on menu
- Music changes when entering a scenario



