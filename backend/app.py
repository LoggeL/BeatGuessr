"""
BeatGuessr Backend - Flask API
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import random
import uuid
from pathlib import Path
from datetime import datetime

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

# Load song data
DATA_FILE = Path(__file__).parent.parent / "data" / "songs.json"
songs_data = {"songs": [], "contexts": {}}


def load_songs():
    global songs_data
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            songs_data = json.load(f)
        print(f"Loaded {len(songs_data.get('songs', []))} songs")
    else:
        print(f"Warning: Song data file not found at {DATA_FILE}")


# Game sessions storage (in-memory for now)
game_sessions = {}


# === Routes ===


@app.route("/")
def serve_frontend():
    """Serve the main frontend page."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    """Serve static files."""
    return send_from_directory(app.static_folder, path)


@app.route("/api/songs", methods=["GET"])
def get_songs():
    """Get all songs."""
    return jsonify(
        {
            "songs": songs_data.get("songs", []),
            "contexts": songs_data.get("contexts", {}),
            "total": len(songs_data.get("songs", [])),
        }
    )


@app.route("/api/songs/random", methods=["GET"])
def get_random_song():
    """Get a random song, optionally excluding certain IDs."""
    exclude = request.args.get("exclude", "").split(",")
    exclude = [e.strip() for e in exclude if e.strip()]

    available_songs = [
        s for s in songs_data.get("songs", []) if s.get("id") not in exclude
    ]

    if not available_songs:
        return jsonify({"error": "Keine Songs mehr verfügbar"}), 404

    song = random.choice(available_songs)
    return jsonify(song)


@app.route("/api/game/create", methods=["POST"])
def create_game():
    """Create a new game session."""
    data = request.json or {}
    player_names = data.get("players", ["Spieler 1", "Spieler 2"])

    if len(player_names) < 2 or len(player_names) > 4:
        return jsonify({"error": "Es werden 2-4 Spieler benötigt"}), 400

    game_id = str(uuid.uuid4())[:8]

    # Get all song IDs for the game pool
    all_song_ids = [s["id"] for s in songs_data.get("songs", [])]
    random.shuffle(all_song_ids)

    # Create players with starting cards
    players = []
    used_song_ids = []

    for i, name in enumerate(player_names):
        # Give each player a starting card
        starting_song_id = all_song_ids[i] if i < len(all_song_ids) else None
        if starting_song_id:
            used_song_ids.append(starting_song_id)

        players.append(
            {
                "id": i,
                "name": name,
                "timeline": [starting_song_id] if starting_song_id else [],
                "score": 1 if starting_song_id else 0,
            }
        )

    # Create game session
    game_sessions[game_id] = {
        "id": game_id,
        "players": players,
        "current_player_index": 0,
        "used_song_ids": used_song_ids,
        "remaining_song_ids": [s for s in all_song_ids if s not in used_song_ids],
        "current_song_id": None,
        "status": "playing",
        "winner": None,
        "created_at": datetime.now().isoformat(),
    }

    return jsonify(game_sessions[game_id])


@app.route("/api/game/<game_id>", methods=["GET"])
def get_game(game_id):
    """Get game state."""
    if game_id not in game_sessions:
        return jsonify({"error": "Spiel nicht gefunden"}), 404

    return jsonify(game_sessions[game_id])


@app.route("/api/game/<game_id>/draw", methods=["POST"])
def draw_card(game_id):
    """Draw a new card for the current player."""
    if game_id not in game_sessions:
        return jsonify({"error": "Spiel nicht gefunden"}), 404

    game = game_sessions[game_id]

    if game["status"] != "playing":
        return jsonify({"error": "Spiel ist beendet"}), 400

    if not game["remaining_song_ids"]:
        return jsonify({"error": "Keine Songs mehr verfügbar"}), 400

    # Draw a random song
    song_id = random.choice(game["remaining_song_ids"])
    game["current_song_id"] = song_id

    # Find the song data
    song = next((s for s in songs_data["songs"] if s["id"] == song_id), None)

    return jsonify(
        {
            "song_id": song_id,
            "preview_url": song["preview_url"] if song else None,
            "cover_url": song["cover_url"] if song else None,
        }
    )


@app.route("/api/game/<game_id>/guess", methods=["POST"])
def submit_guess(game_id):
    """Submit a guess for the current song."""
    if game_id not in game_sessions:
        return jsonify({"error": "Spiel nicht gefunden"}), 404

    game = game_sessions[game_id]
    data = request.json or {}
    position = data.get("position")  # Index where to insert

    if game["status"] != "playing":
        return jsonify({"error": "Spiel ist beendet"}), 400

    if not game["current_song_id"]:
        return jsonify({"error": "Kein Song gezogen"}), 400

    # Get current song data
    song_id = game["current_song_id"]
    song = next((s for s in songs_data["songs"] if s["id"] == song_id), None)

    if not song:
        return jsonify({"error": "Song nicht gefunden"}), 404

    # Get current player
    player = game["players"][game["current_player_index"]]

    # Get player's timeline with years
    timeline = []
    for sid in player["timeline"]:
        s = next((x for x in songs_data["songs"] if x["id"] == sid), None)
        if s:
            timeline.append(s["year"])

    # Check if guess is correct
    song_year = song["year"]
    is_correct = False

    if position is not None and 0 <= position <= len(timeline):
        # Check if the position is correct
        before_year = timeline[position - 1] if position > 0 else -9999
        after_year = timeline[position] if position < len(timeline) else 9999

        is_correct = before_year <= song_year <= after_year

    # Update game state
    if is_correct:
        # Insert song into timeline at the correct position
        player["timeline"].insert(position, song_id)
        player["score"] = len(player["timeline"])

        # Check for winner
        if player["score"] >= 10:
            game["status"] = "finished"
            game["winner"] = player["name"]

    # Remove song from available pool
    game["remaining_song_ids"].remove(song_id)
    game["used_song_ids"].append(song_id)
    game["current_song_id"] = None

    # Move to next player
    game["current_player_index"] = (game["current_player_index"] + 1) % len(
        game["players"]
    )

    return jsonify(
        {
            "correct": is_correct,
            "song": song,
            "player": player,
            "game_status": game["status"],
            "winner": game["winner"],
            "next_player_index": game["current_player_index"],
        }
    )


@app.route("/api/song/<song_id>", methods=["GET"])
def get_song(song_id):
    """Get a specific song by ID."""
    song = next(
        (s for s in songs_data.get("songs", []) if s.get("id") == song_id), None
    )

    if not song:
        return jsonify({"error": "Song nicht gefunden"}), 404

    return jsonify(song)


# Initialize
load_songs()

if __name__ == "__main__":
    print("Starting BeatGuessr Backend...")
    print(f"Songs loaded: {len(songs_data.get('songs', []))}")
    app.run(debug=True, host="0.0.0.0", port=5000)
