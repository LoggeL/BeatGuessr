"""
BeatGuessr Buzzer Mode - WebSocket handlers for real-time multiplayer
"""

import random
import string
import time
from flask import request
from flask_socketio import emit, join_room, leave_room

# Room storage
rooms = {}

# Player sessions (sid -> room_code)
player_sessions = {}


def generate_room_code():
    """Generate a 6-character room code."""
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code


def get_room_state(room_code, for_host=False):
    """Get sanitized room state for clients."""
    room = rooms.get(room_code)
    if not room:
        return None

    players_list = []
    for sid, player in room["players"].items():
        players_list.append(
            {
                "id": sid,
                "name": player["name"],
                "score": player["score"],
                "isLockedOut": sid in room["locked_out"],
                "isConnected": player.get("connected", True),
            }
        )

    # Sort by score descending
    players_list.sort(key=lambda p: p["score"], reverse=True)

    state = {
        "roomCode": room_code,
        "maxScore": room["max_score"],
        "players": players_list,
        "roundActive": room["round_active"],
        "currentBuzzer": None,
        "buzzQueue": [],
        "gameStarted": room["game_started"],
        "gameEnded": room["game_ended"],
        "winner": room.get("winner"),
    }

    # Add buzz queue info
    if room["current_buzzer"]:
        buzzer = room["players"].get(room["current_buzzer"])
        if buzzer:
            state["currentBuzzer"] = {
                "id": room["current_buzzer"],
                "name": buzzer["name"],
            }

    for sid in room["buzz_queue"]:
        player = room["players"].get(sid)
        if player:
            state["buzzQueue"].append({"id": sid, "name": player["name"]})

    # Add current song for host only
    if for_host and room["current_song"]:
        state["currentSong"] = room["current_song"]

    return state


def register_buzzer_events(socketio, songs_data):
    """Register all buzzer-related WebSocket events."""

    @socketio.on("connect")
    def handle_connect():
        print(f"Client connected: {request.sid}")

    @socketio.on("disconnect")
    def handle_disconnect():
        sid = request.sid
        print(f"Client disconnected: {sid}")

        # Check if this was a player in a room
        if sid in player_sessions:
            room_code = player_sessions[sid]
            room = rooms.get(room_code)

            if room:
                if room["host_sid"] == sid:
                    # Host disconnected - notify all players
                    emit("host_disconnected", {}, room=room_code)
                    # Don't delete room immediately - allow reconnect
                    room["host_connected"] = False
                elif sid in room["players"]:
                    # Mark player as disconnected (allow rejoin)
                    room["players"][sid]["connected"] = False
                    emit("room_state", get_room_state(room_code), room=room_code)
                    emit(
                        "room_state",
                        get_room_state(room_code, for_host=True),
                        room=f"{room_code}_host",
                    )

            del player_sessions[sid]

    @socketio.on("create_room")
    def handle_create_room(data):
        sid = request.sid
        max_score = data.get("maxScore", 10)

        room_code = generate_room_code()

        rooms[room_code] = {
            "host_sid": sid,
            "host_connected": True,
            "max_score": max_score,
            "players": {},
            "current_song": None,
            "round_active": False,
            "buzz_queue": [],
            "current_buzzer": None,
            "locked_out": set(),
            "used_song_ids": set(),
            "game_started": False,
            "game_ended": False,
            "winner": None,
        }

        player_sessions[sid] = room_code
        join_room(room_code)
        join_room(f"{room_code}_host")

        emit("room_created", {"roomCode": room_code, "maxScore": max_score})
        print(f"Room created: {room_code} by {sid}")

    @socketio.on("join_room")
    def handle_join_room(data):
        sid = request.sid
        room_code = data.get("roomCode", "").upper()
        player_name = data.get("playerName", "").strip()

        if not room_code or not player_name:
            emit("error", {"message": "Raumcode und Name erforderlich"})
            return

        room = rooms.get(room_code)
        if not room:
            emit("error", {"message": "Raum nicht gefunden"})
            return

        if room["game_ended"]:
            emit("error", {"message": "Spiel ist bereits beendet"})
            return

        # Check for rejoin (same name)
        existing_sid = None
        for psid, player in room["players"].items():
            if player["name"].lower() == player_name.lower() and not player.get(
                "connected", True
            ):
                existing_sid = psid
                break

        if existing_sid:
            # Rejoin - transfer session
            player_data = room["players"].pop(existing_sid)
            player_data["connected"] = True
            room["players"][sid] = player_data

            # Update buzz queue if player was in it
            room["buzz_queue"] = [
                sid if x == existing_sid else x for x in room["buzz_queue"]
            ]
            if room["current_buzzer"] == existing_sid:
                room["current_buzzer"] = sid
            if existing_sid in room["locked_out"]:
                room["locked_out"].discard(existing_sid)
                room["locked_out"].add(sid)
        else:
            # New player
            if len(room["players"]) >= 8:
                emit("error", {"message": "Raum ist voll (max. 8 Spieler)"})
                return

            room["players"][sid] = {"name": player_name, "score": 0, "connected": True}

        player_sessions[sid] = room_code
        join_room(room_code)

        emit(
            "joined_room",
            {
                "roomCode": room_code,
                "playerName": player_name,
                "gameStarted": room["game_started"],
            },
        )

        # Notify everyone
        emit("player_joined", {"name": player_name}, room=room_code)
        emit("room_state", get_room_state(room_code), room=room_code)
        emit(
            "room_state",
            get_room_state(room_code, for_host=True),
            room=f"{room_code}_host",
        )

        print(f"Player {player_name} joined room {room_code}")

    @socketio.on("leave_room")
    def handle_leave_room():
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if room and sid in room["players"]:
            player_name = room["players"][sid]["name"]
            del room["players"][sid]

            leave_room(room_code)
            del player_sessions[sid]

            emit("player_left", {"name": player_name}, room=room_code)
            emit("room_state", get_room_state(room_code), room=room_code)
            emit(
                "room_state",
                get_room_state(room_code, for_host=True),
                room=f"{room_code}_host",
            )

    @socketio.on("start_game")
    def handle_start_game():
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room or room["host_sid"] != sid:
            emit("error", {"message": "Nur der Host kann das Spiel starten"})
            return

        if len(room["players"]) < 1:
            emit("error", {"message": "Mindestens 1 Spieler erforderlich"})
            return

        room["game_started"] = True

        emit("game_started", {}, room=room_code)
        emit("room_state", get_room_state(room_code), room=room_code)
        emit(
            "room_state",
            get_room_state(room_code, for_host=True),
            room=f"{room_code}_host",
        )

        print(f"Game started in room {room_code}")

    @socketio.on("start_round")
    def handle_start_round():
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room or room["host_sid"] != sid:
            return

        if room["game_ended"]:
            return

        # Get a random song
        all_songs = songs_data.get("songs", [])
        available = [s for s in all_songs if s["id"] not in room["used_song_ids"]]

        if not available:
            # Reset pool if exhausted
            room["used_song_ids"].clear()
            available = all_songs

        if not available:
            emit("error", {"message": "Keine Songs verfügbar"})
            return

        song = random.choice(available)
        room["used_song_ids"].add(song["id"])
        room["current_song"] = song
        room["round_active"] = True
        room["buzz_queue"] = []
        room["current_buzzer"] = None
        room["locked_out"] = set()

        # Send to host (full song info)
        emit("round_started", {"song": song}, room=f"{room_code}_host")

        # Send to players (no song info, just that round started)
        emit(
            "round_started",
            {"song": {"preview_url": song["preview_url"]}},
            room=room_code,
        )

        emit("room_state", get_room_state(room_code), room=room_code)
        emit(
            "room_state",
            get_room_state(room_code, for_host=True),
            room=f"{room_code}_host",
        )

        print(f"Round started in room {room_code}: {song['title']}")

    @socketio.on("buzz")
    def handle_buzz():
        sid = request.sid
        buzz_time = time.time()

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room or not room["round_active"]:
            return

        if sid not in room["players"]:
            return

        # Check if already buzzed or locked out
        if sid in room["buzz_queue"] or sid in room["locked_out"]:
            return

        # Add to queue
        room["buzz_queue"].append(sid)

        # If first buzzer, set as current
        if room["current_buzzer"] is None:
            room["current_buzzer"] = sid

        player_name = room["players"][sid]["name"]

        emit(
            "player_buzzed",
            {
                "playerId": sid,
                "playerName": player_name,
                "position": len(room["buzz_queue"]),
            },
            room=room_code,
        )

        emit("room_state", get_room_state(room_code), room=room_code)
        emit(
            "room_state",
            get_room_state(room_code, for_host=True),
            room=f"{room_code}_host",
        )

        print(f"Player {player_name} buzzed in room {room_code}")

    @socketio.on("judge")
    def handle_judge(data):
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room or room["host_sid"] != sid:
            return

        if not room["current_buzzer"]:
            return

        correct_artist = data.get("correctArtist", False)
        correct_title = data.get("correctTitle", False)
        points = (1 if correct_artist else 0) + (1 if correct_title else 0)

        buzzer_sid = room["current_buzzer"]
        buzzer = room["players"].get(buzzer_sid)

        if not buzzer:
            return

        result = {
            "playerId": buzzer_sid,
            "playerName": buzzer["name"],
            "correctArtist": correct_artist,
            "correctTitle": correct_title,
            "points": points,
        }

        if points > 0:
            # Correct answer - award points and end round
            buzzer["score"] += points
            room["round_active"] = False
            room["current_buzzer"] = None

            result["roundEnded"] = True
            result["song"] = room["current_song"]

            # Check for winner
            if buzzer["score"] >= room["max_score"]:
                room["game_ended"] = True
                room["winner"] = buzzer["name"]
                result["gameEnded"] = True
                result["winner"] = buzzer["name"]

            emit("judge_result", result, room=room_code)
            emit("room_state", get_room_state(room_code), room=room_code)
            emit(
                "room_state",
                get_room_state(room_code, for_host=True),
                room=f"{room_code}_host",
            )

            print(f"Player {buzzer['name']} scored {points} points in room {room_code}")
        else:
            # Wrong answer - lock out and move to next in queue
            room["locked_out"].add(buzzer_sid)
            room["buzz_queue"].remove(buzzer_sid)

            if room["buzz_queue"]:
                room["current_buzzer"] = room["buzz_queue"][0]
            else:
                room["current_buzzer"] = None

            result["lockedOut"] = True

            # Check if all players are locked out
            connected_players = [
                sid for sid, p in room["players"].items() if p.get("connected", True)
            ]
            if room["locked_out"] >= set(connected_players):
                room["round_active"] = False
                result["roundEnded"] = True
                result["allLockedOut"] = True
                result["song"] = room["current_song"]

            emit("judge_result", result, room=room_code)
            emit("room_state", get_room_state(room_code), room=room_code)
            emit(
                "room_state",
                get_room_state(room_code, for_host=True),
                room=f"{room_code}_host",
            )

            print(f"Player {buzzer['name']} locked out in room {room_code}")

    @socketio.on("skip_round")
    def handle_skip_round():
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room or room["host_sid"] != sid:
            return

        room["round_active"] = False
        room["current_buzzer"] = None
        room["buzz_queue"] = []

        emit("round_skipped", {"song": room["current_song"]}, room=room_code)

        emit("room_state", get_room_state(room_code), room=room_code)
        emit(
            "room_state",
            get_room_state(room_code, for_host=True),
            room=f"{room_code}_host",
        )

        print(f"Round skipped in room {room_code}")

    @socketio.on("end_game")
    def handle_end_game():
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room or room["host_sid"] != sid:
            return

        room["game_ended"] = True
        room["round_active"] = False

        # Find winner by highest score
        if room["players"]:
            winner = max(room["players"].values(), key=lambda p: p["score"])
            room["winner"] = winner["name"]

        emit(
            "game_ended",
            {
                "winner": room.get("winner"),
                "finalScores": get_room_state(room_code)["players"],
            },
            room=room_code,
        )

        print(f"Game ended in room {room_code}, winner: {room.get('winner')}")

    @socketio.on("host_rejoin")
    def handle_host_rejoin(data):
        sid = request.sid
        room_code = data.get("roomCode", "").upper()

        room = rooms.get(room_code)
        if not room:
            emit("error", {"message": "Raum nicht gefunden"})
            return

        # Allow rejoin if host was disconnected
        if not room["host_connected"]:
            room["host_sid"] = sid
            room["host_connected"] = True
            player_sessions[sid] = room_code
            join_room(room_code)
            join_room(f"{room_code}_host")

            emit("host_rejoined", get_room_state(room_code, for_host=True))
            print(f"Host rejoined room {room_code}")
        else:
            emit("error", {"message": "Host ist bereits verbunden"})

    @socketio.on("get_room_state")
    def handle_get_room_state():
        sid = request.sid

        if sid not in player_sessions:
            return

        room_code = player_sessions[sid]
        room = rooms.get(room_code)

        if not room:
            return

        if room["host_sid"] == sid:
            emit("room_state", get_room_state(room_code, for_host=True))
        else:
            emit("room_state", get_room_state(room_code))
