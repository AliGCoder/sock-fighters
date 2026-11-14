"""Story voices, step 2: record every story line in its speaker's own voice (Qwen3-TTS, Apache-2.0, on the GPU).
- Fighters keep the ORIGINAL voice designed for them in tools/announcer (refs/fighter_<id>.wav), now speaking English.
- Queen Nylonia, the Fishnet Scout and the narrator get ORIGINAL voices designed here from a written description.
- 'fake' (the Dryer Demon pretending to be Princess Baby Bootie): Baby Bootie's voice, a little too deep.
  'fakedeep' (his real voice slipping out): the Demon's voice.
Reads jobs.json (from prep.js); writes story_clips.json { key: base64 mp3 } and samples/STORY_<voice>.wav to listen to.
Re-runnable: lines already recorded are skipped.
Usage: ../announcer/.venv-qwen/Scripts/python.exe qwen_story.py [--limit N] [--only voice,voice]"""
import base64, json, os, sys, zlib
import numpy as np, soundfile as sf, torch
from scipy.signal import resample
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ANN = os.path.join(HERE, '..', 'announcer')
sys.path.insert(0, ANN)
import qwen_fighters as QF
from qwen_tts import Qwen3TTSModel

QF.KBPS = 32  # speech: smaller files, still clear
SR = QF.SR
DRY = ' Close-mic studio recording, completely dry, no reverb or echo.'
DESIGNED = {
    'queen': ('A grand, theatrical queen in her forties: rich, warm, posh British accent, haughty, dramatic and regal, '
              'comically self-important, every line delivered like a royal proclamation.',
              'We are Queen Nylonia, and We are extremely fabulous. Kneel, if you have knees.'),
    'fishnet': ('A young woman, a royal scout: bright, quick and eager voice, a little nervous and cheeky, upbeat and loyal, '
                'talks fast when excited.',
                "Sir Knight! This way! Watch your step, it's a bit holey around here."),
    'narr': ('A warm, playful storybook narrator: a mature man with a clear, expressive, friendly voice, '
             'reading a funny bedtime story aloud with great comic timing.',
             'Once upon a time, in a coin laundry at midnight, a sock was about to go missing.'),
}
REFS = os.path.join(HERE, 'refs')
OUT = os.path.join(HERE, 'story_clips.json')
SAMPLES = os.path.join(HERE, 'samples')


def design_voices():
    todo = [v for v in DESIGNED if not os.path.exists(os.path.join(REFS, f'story_{v}.wav'))]
    if not todo:
        return
    design = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0',
                                           dtype=torch.bfloat16, attn_implementation='sdpa')
    for n, v in enumerate(todo):
        desc, line = DESIGNED[v]
        best, best_tail = None, 9.0
        for take in range(4):
            torch.manual_seed(9100 + 100 * take + n)
            wavs, _ = design.generate_voice_design(text=line, language='English', instruct=desc + DRY)
            y = np.asarray(wavs[0], dtype=np.float32)
            tail = QF.echo_tail(y)
            if tail < best_tail:
                best, best_tail = y, tail
        sf.write(os.path.join(REFS, f'story_{v}.wav'), best, SR)
        print(f'designed {v} (echo tail {best_tail * 1000:.0f} ms)', flush=True)
    del design
    torch.cuda.empty_cache()


def voice_source(voice):
    """(reference wav, reference text, effect) for a job's voice."""
    if voice in DESIGNED:
        return os.path.join(REFS, f'story_{voice}.wav'), DESIGNED[voice][1], None
    cid = {'fake': 'baby', 'fakedeep': 'demon'}.get(voice, voice)
    effect = 'fakebaby' if voice == 'fake' else QF.CAST[cid][3]
    return os.path.join(ANN, 'refs', f'fighter_{cid}.wav'), QF.ref_line(cid), effect


def finish(y, effect):
    if effect == 'fakebaby':  # a baby voice... a bit too deep and slow
        y = np.asarray(y, dtype=np.float64)
        y = resample(y, int(len(y) * 1.16))
        return QF.finish(y, None)
    return QF.finish(y, effect)


def plausible(say, y):
    words = max(1, len(say.split()))
    secs = len(y) / SR
    return 0.14 * words <= secs <= 0.8 * words + 2.0


def main():
    args = sys.argv[1:]
    limit = int(args[args.index('--limit') + 1]) if '--limit' in args else None
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    os.makedirs(REFS, exist_ok=True)
    os.makedirs(SAMPLES, exist_ok=True)
    jobs = json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8'))
    jobs.sort(key=lambda j: (j['file'] != 'story', j['file']))  # everyone's lines first, then hero by hero
    done = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    todo = [j for j in jobs if j['key'] not in done and (not only or j['voice'] in only)]
    if limit:
        todo = todo[:limit]
    print(f'{len(done)} already recorded, {len(todo)} to record', flush=True)
    if not todo:
        return
    design_voices()
    base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                         dtype=torch.bfloat16, attn_implementation='sdpa')
    prompts, reels = {}, {}
    for n, job in enumerate(todo):
        v = job['voice']
        ref, ref_text, effect = voice_source(v)
        if v not in prompts:
            prompts[v] = base.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text)
        best = None
        for attempt in range(3):
            torch.manual_seed(zlib.crc32(f"{job['key']}|{attempt}".encode()))
            wavs, _ = base.generate_voice_clone(text=job['say'], language='English', voice_clone_prompt=prompts[v])
            y = finish(wavs[0], effect)
            if plausible(job['say'], y):
                best = y
                break
            # keep the take closest to a normal speaking pace
            words = max(1, len(job['say'].split()))
            if best is None or abs(len(y) / SR / words - 0.38) < abs(len(best) / SR / words - 0.38):
                best = y
        done[job['key']] = base64.b64encode(QF.mp3(best)).decode('ascii')
        reel = reels.setdefault(v, [])
        if len(reel) < 8:
            reel += [best * 0.89, np.zeros(int(SR * 0.5))]
        print(f"[{n + 1}/{len(todo)}] {v:9s} {len(best) / SR:4.1f}s  {job['say'][:70]}", flush=True)
        if (n + 1) % 10 == 0:
            json.dump(done, open(OUT, 'w', encoding='utf-8'))
    json.dump(done, open(OUT, 'w', encoding='utf-8'))
    for v, reel in reels.items():
        sf.write(os.path.join(SAMPLES, f'STORY_{v}.wav'), np.concatenate(reel), SR)
    print(f'done: {len(done)} clips, {sum(len(b) for b in done.values()) / 1e6:.2f} MB of base64', flush=True)


if __name__ == '__main__':
    main()
