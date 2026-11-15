#!/bin/bash
# Shows how far the story voice recording has got (reads record_new.log). Ctrl+C to close.
cd "$(dirname "$0")"
prev=""; prevt=$(date +%s); rate=""
while true; do
  step=$(grep -a '^== ' record_new.log 2>/dev/null | tail -1)
  last=$(grep -ao '\[[0-9]*/[0-9]*\] [a-z]* *[0-9.]*s *[^ ]*' record_new.log 2>/dev/null | tail -1)
  n=$(echo "$last" | sed -E 's/^\[([0-9]+)\/.*/\1/'); tot=$(echo "$last" | sed -E 's/^\[[0-9]+\/([0-9]+)\].*/\1/')
  now=$(date +%s)
  if [ -n "$prev" ] && [ -n "$n" ] && [ "$n" -gt "$prev" ]; then rate=$(( (now - prevt) * 100 / (n - prev) )); prev=$n; prevt=$now; fi
  [ -z "$prev" ] && prev=$n && prevt=$now
  clear
  echo "SOCK FIGHTERS - recording the story voices"
  echo "$step"
  if [ -n "$n" ]; then
    pct=$(( n * 100 / tot )); bar=$(printf '%*s' $((pct / 2)) '' | tr ' ' '#')
    echo; printf '[%-50s] %d%%  (%s of %s lines)\n' "$bar" "$pct" "$n" "$tot"
    [ -n "$rate" ] && echo "About $(( (tot - n) * rate / 100 / 60 + 12 )) minutes left (including packing the files)"
    echo; echo "Last line: $last"
  fi
  [ -z "$(tasklist 2>/dev/null | grep -i python)" ] && echo && echo "Recording finished (or stopped)." && break
  sleep 30
done
