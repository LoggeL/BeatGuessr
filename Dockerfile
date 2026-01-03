FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY data/ ./data/

WORKDIR /app/backend

EXPOSE 5000

# Use eventlet for WebSocket support
CMD ["python", "-c", "from app import app, socketio; socketio.run(app, host='0.0.0.0', port=5000)"]
