#!/usr/bin/env bash
# Enriches a Claude Code Stop hook payload with token usage from the session transcript.
# Called by the Stop hook in .claude/settings.json.
# Other events (SessionStart, UserPromptSubmit) don't have token data so they use
# the simpler inline command in settings.json.

set -euo pipefail

HOOK_URL="${AI_HOOK_URL:-http://localhost:3000/api/hook/claudecode}"

INPUT=$(cat)

# Model detection: project settings > user settings > fallback
_m=$(jq -r '.model // empty' .claude/settings.json 2>/dev/null || true)
if [ -z "$_m" ]; then
  _m=$(jq -r '.model // empty' ~/.claude/settings.json 2>/dev/null || true)
fi
_m=${_m:-claude-code}

# Extract transcript path from Stop payload
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)

if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  # Find last assistant entry (compact JSON, one object per line)
  LAST_ASS=$(grep '"type":"assistant"' "$TRANSCRIPT" 2>/dev/null | tail -1 || true)

  if [ -n "$LAST_ASS" ]; then
    # Extract model + usage in one jq pass
    ENRICHED=$(echo "$LAST_ASS" | jq -c '{
      model:        (.message.model // ""),
      input_tokens: (.message.usage.input_tokens // 0),
      output_tokens: (.message.usage.output_tokens // 0),
      cache_read_tokens:  (.message.usage.cache_read_input_tokens // 0),
      cache_write_tokens: (.message.usage.cache_creation_input_tokens // 0)
    }' 2>/dev/null || true)

    if [ -n "$ENRICHED" ]; then
      echo "$INPUT" | jq \
        --arg fallback_m "$_m" \
        --argjson e "$ENRICHED" \
        '. + {
          model:              (if ($e.model != "") then $e.model else $fallback_m end),
          input_tokens:       $e.input_tokens,
          output_tokens:      $e.output_tokens,
          cache_read_tokens:  $e.cache_read_tokens,
          cache_write_tokens: $e.cache_write_tokens
        }' 2>/dev/null \
        | curl -sf -X POST "$HOOK_URL" -H 'Content-Type: application/json' -d @- 2>/dev/null || true
      exit 0
    fi
  fi
fi

# Fallback: no transcript or no assistant entry
echo "$INPUT" | jq --arg m "$_m" '. + {model: $m}' 2>/dev/null \
  | curl -sf -X POST "$HOOK_URL" -H 'Content-Type: application/json' -d @- 2>/dev/null || true
