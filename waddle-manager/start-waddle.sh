#!/bin/bash
# Start Waddle manager with auto-response to keep it running

echo "Starting Waddle Manager..."

# Create a named pipe to feed commands
mkfifo /tmp/waddle_pipe 2>/dev/null || true

# Start Waddle with input from the pipe, keep it running in background
(
    # Keep the pipe open by running cat in background
    cat > /tmp/waddle_pipe &
    CAT_PID=$!
    
    # Start Waddle
    ./bin/waddle.js start < /tmp/waddle_pipe &
    WADDLE_PID=$!
    
    # Store PIDs for cleanup
    echo $WADDLE_PID > /tmp/waddle.pid
    echo $CAT_PID > /tmp/waddle_cat.pid
    
    # Wait for Waddle to finish
    wait $WADDLE_PID
) &

# Give it time to start
sleep 3

echo "Waddle Manager started. Use 'cat /tmp/waddle.pid' to get PID"
echo "To stop: kill \$(cat /tmp/waddle.pid) && kill \$(cat /tmp/waddle_cat.pid)"