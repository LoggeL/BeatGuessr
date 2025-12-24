# 🎵 BeatGuessr

**Das ultimative Musik-Ratespiel!** Test your music knowledge across decades of hits.

🎮 **[Play Now](https://loggel.github.io/BeatGuessr/)**

![BeatGuessr Screenshot](https://img.shields.io/badge/Songs-660+-purple?style=for-the-badge)
![Years](https://img.shields.io/badge/Years-1960--2025-teal?style=for-the-badge)
![Made with](https://img.shields.io/badge/Made%20with-❤️-pink?style=for-the-badge)

---

## 🎮 Game Modes

### 🎤 Classic Mode
Listen to a 30-second preview and try to guess the **song title** and **artist**. Score yourself:
- **+0** - Nothing correct
- **+1** - Title OR artist correct
- **+2** - Both correct!

Play endlessly and try to beat your high score. Songs never repeat within a session!

### 📅 Timeline Mode
A multiplayer (hot seat) game for 2-4 players:
1. Listen to a song preview
2. Guess where it fits chronologically in your timeline
3. Correct? The card is added. Wrong? It's discarded.
4. **First to 10 cards wins!**

---

## ✨ Features

- 🎧 **660 Songs** with Spotify 30-second previews
- 📅 **65 Years of Music** (1960-2025)
- 🇩🇪 **German UI** with year-specific cultural contexts
- 🎨 **Colorful Design** with decade-themed styling
- 📱 **Responsive** - Works on desktop and mobile
- 🔄 **No Repeats** - Smart randomizer within sessions

---

## 🚀 Quick Start

### Play Online
Just visit **[loggel.github.io/BeatGuessr](https://loggel.github.io/BeatGuessr/)**

### Run Locally

```bash
# Clone the repository
git clone https://github.com/LoggeL/BeatGuessr.git
cd BeatGuessr

# Option 1: Simple static server
cd frontend
python -m http.server 8000
# Open http://localhost:8000

# Option 2: With Flask backend
pip install flask flask-cors
cd backend
python app.py
# Open http://localhost:5000
```

---

## 🎵 Song Database

The game includes 660 carefully curated songs:
- **10 songs per year** from 1960 to 2025
- Mix of German and international chart hits
- Original versions only (no remixes)
- Each song has a German cultural context (e.g., "NDW-Höhepunkt", "Grunge-Revolution")

### Scraping New Songs

```bash
cd scripts
pip install -r requirements.txt
python scrape_songs.py
```

Requires Spotify API credentials in the script.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, CSS3 with glassmorphism effects
- **Backend** (optional): Flask, Python
- **Audio**: Spotify 30-second previews
- **Hosting**: GitHub Pages

---

## 📁 Project Structure

```
BeatGuessr/
├── frontend/           # Static frontend (GitHub Pages)
│   ├── index.html      # Main game page
│   ├── css/style.css   # Colorful theme
│   ├── data/songs.json # Song database
│   └── js/
│       ├── app.js      # Main application
│       ├── game/       # Game logic (GameState, Player, SongCard)
│       ├── audio/      # Audio player
│       └── ui/         # Screen components
├── backend/            # Optional Flask server
├── scripts/            # Song scraping tools
└── data/               # Source song data
```

---

## 🎨 Decade Colors

| Decade | Color | Context Examples |
|--------|-------|------------------|
| 60s | 🟠 Orange | Beatlemania, Hippie-Bewegung |
| 70s | 🟡 Gold | Disco-Fieber, Punk-Revolution |
| 80s | 🩷 Pink | NDW-Höhepunkt, Synth-Pop |
| 90s | 🩵 Teal | Grunge-Revolution, Techno |
| 00s | 🟣 Purple | MP3-Revolution, Emo-Welle |
| 10s | 🟢 Green | Streaming-Ära, EDM-Boom |
| 20s | 🔵 Blue | TikTok-Hits, Pandemie-Hits |

---

## 📄 License

MIT License - feel free to use, modify, and share!

---

<p align="center">
  Made with 🎵 and ❤️
  <br>
  <a href="https://loggel.github.io/BeatGuessr/">Play BeatGuessr Now!</a>
</p>
