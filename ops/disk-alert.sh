#!/bin/bash
# Disk usage alert for iamfaulty-mini
# Run via cron: 0 * * * * /Users/peteedoo/iamfaulty-homelab/ops/disk-alert.sh

THRESHOLD=85
ALERT_FILE="/tmp/disk_alert_sent"

# Get used percentage (strip % sign)
USED_PCT=$(df /System/Volumes/Data | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$USED_PCT" -ge "$THRESHOLD" ]; then
  if [ ! -f "$ALERT_FILE" ]; then
    echo "[$(date)] ALERT: Disk usage is ${USED_PCT}% (threshold: ${THRESHOLD}%)" >&2
    # Add notification method here if desired (e.g., send to a log, iMessage, etc.)
    touch "$ALERT_FILE"
  fi
else
  if [ -f "$ALERT_FILE" ]; then
    echo "[$(date)] OK: Disk usage recovered to ${USED_PCT}%"
    rm -f "$ALERT_FILE"
  fi
fi

echo "Disk usage: ${USED_PCT}%"
