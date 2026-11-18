#!/bin/sh
# Builds the finished trailers from the recorded footage + a sound mix.
#   sh build.sh                 coded score  -> out/SockFighters_Trailer_Cinematic.mp4 + _Phone.mp4
#   sh build.sh ace             AI score     -> out/SockFighters_Trailer_Cinematic_AI.mp4 + _Phone_AI.mp4
set -e
cd "$(dirname "$0")/out"
FF=$(../.venv-ff/Scripts/python.exe -c "import imageio_ffmpeg as f;print(f.get_ffmpeg_exe())")
PY=../../announcer/.venv-qwen/Scripts/python.exe
if [ "$1" = ace ]; then MIX=trailer_mix_ace.wav; TAG=_AI; else MIX=trailer_mix.wav; TAG=; fi
LEN=$($PY -c "import soundfile as sf;i=sf.info('$MIX');print(round(i.frames/i.samplerate,2))")
FO=$($PY -c "print($LEN-1.2)")
WIDE=SockFighters_Trailer_Cinematic$TAG.mp4
TALL=SockFighters_Trailer_Phone$TAG.mp4
BANG="fontfile='../fonts/Bangers-Regular.ttf'"
PIX="fontfile='../fonts/PressStart2P-Regular.ttf'"
"$FF" -hide_banner -loglevel error -y -i sock-fighters-trailer.mp4 -i "$MIX" -filter_complex \
  "[0:v]fps=30,tpad=stop_mode=clone:stop_duration=6,trim=duration=$LEN,fade=t=in:st=0:d=0.8,fade=t=out:st=$FO:d=1.2,format=yuv420p[v]" \
  -map "[v]" -map 1:a -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t "$LEN" "$WIDE"
"$FF" -hide_banner -loglevel error -y -i "$WIDE" -filter_complex \
  "[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=28:2,eq=brightness=-0.28:saturation=1.2[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=0:(H-h)/2-60,\
drawtext=$BANG:text='SOCK FIGHTERS':fontsize=150:fontcolor=0xffd23f:borderw=10:bordercolor=0x120a20:shadowcolor=0xff9d2e@0.6:shadowx=0:shadowy=6:x=(w-tw)/2:y=300,\
drawtext=$BANG:text='TURBO RINSE':fontsize=84:fontcolor=0x3ff0ff:borderw=7:bordercolor=0x120a20:x=(w-tw)/2:y=460,\
drawtext=$PIX:text='PLAY FREE IN YOUR BROWSER':fontsize=34:fontcolor=white:borderw=4:bordercolor=black:x=(w-tw)/2:y=1420,\
drawtext=$PIX:text='aligcoder.github.io/sock-fighters':fontsize=28:fontcolor=0xff7ac0:borderw=4:bordercolor=black:x=(w-tw)/2:y=1490,\
drawtext=$PIX:text='INSERT COIN':fontsize=40:fontcolor=0xffd23f:borderw=4:bordercolor=black:x=(w-tw)/2:y=1600:enable='lt(mod(t\,0.9)\,0.5)'[v]" \
  -map "[v]" -map 0:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a copy -movflags +faststart "$TALL"
for f in "$WIDE" "$TALL"; do "$FF" -hide_banner -i "$f" 2>&1 | grep -E "Duration|Video:" | sed 's/^ */  /'; done
