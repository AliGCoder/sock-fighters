"""Fighter voices: one ORIGINAL voice per character, designed from a written description with Qwen3-TTS
VoiceDesign (Apache-2.0), then every clip is spoken by the Qwen3-TTS Base model continuing that reference
line, so each character keeps the same voice. Outputs:
  refs/fighter_<id>.wav            the designed reference line per character
  fighter_clips.json               { id: { word: [base64 mp3, ...] } }   (inject with inject.js fighter)
  samples/FIGHTERS_preview.wav     a short audition of every character
Usage: .venv-qwen/Scripts/python.exe qwen_fighters.py [only_id ...]"""
import base64, gc, json, os, sys, zlib
import numpy as np, soundfile as sf, torch, lameenc
from scipy.signal import resample, butter, lfilter
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 24000
KBPS = 40

# Shared lines by voice type. Words are the game's FighterVoice words.
MALE = dict(light=['はっ!', 'やっ!', 'せいっ!'], heavy=['はあっ!', 'どりゃあ!'], special=['くらえ!', 'いくぞっ!'],
            throwv=['どっせい!'], hurt=['うっ!', 'ぐっ!', 'ちっ!'], hurtBig=['ぐああっ!', 'ぐおっ!'],
            ko=['うわああああ…!'], hup=['ほっ!'], block=['ふんっ!'], dizzy=['うう…目が回る…'])
FEMALE = dict(light=['はっ!', 'やっ!', 'えいっ!'], heavy=['やあっ!', 'はああっ!'], special=['くらえっ!', 'いくわよ!'],
              throwv=['それっ!'], hurt=['あっ!', 'うっ!', 'いたっ!'], hurtBig=['きゃあっ!', 'ああっ!'],
              ko=['きゃああああ…!'], hup=['ほっ!'], block=['んっ!'], dizzy=['ふにゃあ…目が回る…'])
SMALL = dict(light=['えいっ!', 'やっ!', 'てやっ!'], heavy=['えーいっ!', 'とりゃー!'], special=['くらえー!', 'いっけー!'],
             throwv=['ぽーい!'], hurt=['いたっ!', 'ひゃっ!', 'うっ!'], hurtBig=['うわーん!', 'ひゃああ!'],
             ko=['うわあああん…!'], hup=['ぴょん!'], block=['むっ!'], dizzy=['ふにゃ…くるくる…'])

# id: (base lines, voice description, extra/override lines, post effect)
CAST = {
    'stinky': (MALE, 'A young Japanese man, a cocky street-tough gym brawler. Gruff, rough, energetic, a little rowdy.',
               dict(superv=['これがオレの全力だあっ!'], laugh=['へへっ!'], win=['よっしゃあ!']), None),
    'argyle': (MALE, 'A Japanese man in his thirties, a noble samurai. Crisp, deep, disciplined, sharp battle cries (kiai).',
               dict(superv=['一刀両断!'], laugh=['ふっ…'], win=['成敗!'], light=['はっ!', 'せいっ!', 'とうっ!']), None),
    'shinobi': (MALE, 'A young Japanese man of about twenty, a lone ninja: low, quiet and cool, cold and brooding like an aloof rival, flat and deadpan like a bored assassin, curt, a dismissive hmph, very mysterious.',
                dict(superv=['影分身の術!'], laugh=['ふん…'], win=['…弱すぎる。']), None),
    'gran': (FEMALE, 'A 98-year-old Japanese great-grandmother (an extremely old WOMAN), almost a hundred years old: a very, '
                     "very old woman's voice, thin, frail and papery, with a strong tremble and quaver in every word, breathy "
                     'and wheezy, toothless and mumbly, speaks slowly with little gasps, creaky, groaning about her aching back, '
                     'a grumpy but feisty old granny.',
             dict(light=['ほいっ!', 'ほれっ!', 'えいっ!'], heavy=['どっこいしょ!', 'ふんぬぬっ!'], special=['ほれ、くらいな!', 'いくよっ!'],
                  superv=['ばあちゃんをなめるでないよ!'], throwv=['よいしょお!'], hurt=['あいたたた!', 'こ、腰が…!', 'おおっと!'],
                  # her back REALLY hurts: three long, pained ouches
                  hurtBig=['あいたたたた!', 'ひいい、腰がぁ!いったぁ〜い、いったぁ〜い、いったぁ〜い!'],
                  ko=['あいたたた…腰が…いったぁ〜い…いったぁ〜い…いったぁ〜い…もうダメじゃ…'], hup=['よっこらしょ!'],
                  block=['ううっ…'], laugh=['ひぇっひぇっひぇ!'], win=['まだまだ若いもんには負けんよ…いたたた…'],
                  dizzy=['あ〜れ〜…腰が…いったぁ〜い…いったぁ〜い…いったぁ〜い…'],
                  # her nagging, shouted mid-fight (same order as GRAN_NAGS in index.html)
                  nag=['背筋を伸ばしなさい!', 'まったく、最近の若い靴下は!', 'ちゃんとご飯食べてるのかい?!',
                       'セーターを着なさいって言ってるでしょ!', '靴下は二足そろえて洗いなさい!',
                       '…あれ?何を言おうとしたんだっけ?!']), 'old'),
    'baby': (SMALL, 'A Japanese toddler girl, very squeaky, cute and bratty, babyish speech.',
             dict(superv=['おこったもん!'], laugh=['きゃはは!'], win=['やったー!']), None),
    'kneehi': (MALE, 'A huge Japanese sumo wrestler, booming deep voice, powerful and jolly.',
               dict(superv=['どすこおおおい!'], laugh=['がっはっは!'], win=['ごっつぁんです!'], heavy=['どすこい!', 'ふんぬっ!']), None),
    'robo': (MALE, 'A robot fighter with a flat, mechanical, monotone adult male voice, precise and cold.',
             dict(superv=['オーバードライブ、起動!'], laugh=['ハ・ハ・ハ。'], win=['ミッション、コンプリート。'],
                  hurt=['ガガッ!', 'ピピッ!', 'エラー!'], ko=['システム…ダウン…']), 'robot'),
    'ghost': (FEMALE, 'A young female ghost, soft, whispery, eerie and playful, airy breathy voice.',
              dict(superv=['うらめしや〜!'], laugh=['うふふふ…'], win=['また会いましょう…']), 'ghost'),
    'lint': (SMALL, 'A tiny fluffy creature with a very high, squeaky, cute little voice.',
             dict(superv=['もふもふアタック!'], laugh=['ぽふふっ!'], win=['ぽふっ!']), None),
    'socklet': (SMALL, 'A cheeky little Japanese boy, bratty and fast-talking, high energy.',
                dict(superv=['見えないだろー!'], laugh=['へへーん!'], win=['楽勝ー!']), None),
    'holey': (MALE, 'A nervous, cowardly Japanese man, shaky and whiny voice, easily scared.',
              dict(superv=['こ、こうなったら…!'], laugh=['へ、へへ…'], win=['た、助かった…'], ko=['ひいいいい…!']), None),
    'steel': (MALE, 'A huge, gruff Japanese construction worker, very deep, rough and heavy voice.',
              dict(superv=['ぶっ壊してやる!'], laugh=['ガハハ!'], win=['仕事完了だ!']), None),
    'king': (MALE, 'A pompous Japanese king, deep, theatrical, arrogant royal voice.',
             dict(superv=['ひれ伏すがよい!'], laugh=['ふはははは!'], win=['余の勝ちだ!']), None),
    'demon': (MALE, 'A demon lord with a deep, dark, gritty growling voice and huge attitude: arrogant, sneering, '
                    'mocking and cocky, menacing. Recorded close and dry, no echo.',
              dict(light=['フンッ!', 'ハッ!', 'オラッ!'], heavy=['オラァ!', '消えろ!'], special=['燃え尽きろ!', 'くらえ!'],
                   superv=['すべて焼き尽くしてやる!'], throwv=['吹っ飛べ!'], hurt=['チッ!', 'ぐぬっ!', '小癪な!'],
                   hurtBig=['ぐおおっ!', 'おのれぇ!'], ko=['バカな…この俺が…!'], hup=['フッ!'], block=['効かんな!'],
                   laugh=['フハハハハ!'], win=['弱すぎるわ!'], dizzy=['ぐぬぬ…']), 'demon'),
    'bleach': (MALE, 'A haughty Japanese aristocrat villain: cold, sneering and snobbish, refined posh voice with a cruel streak.',
               dict(light=['ふんっ!', 'はっ!', 'せいっ!'], heavy=['無礼者!', 'はああっ!'], special=['漂白してやろう!', '色を落とせ!'],
                    superv=['真っ白に染まれ!'], throwv=['下がれ!'], hurt=['ぐっ!', 'なっ!', 'この…!'], hurtBig=['ぐあっ!', '汚らわしい!'],
                    ko=['私の…白が…'], block=['無駄だ。'], laugh=['ふはは…下品な色だ。'], win=['染み一つ残さん。'],
                    dizzy=['め、目が回る…']), None),
    'cling': (FEMALE, 'A mature, elegant Japanese villainess queen in her thirties: low, smooth, sultry voice, cold and '
                      'commanding, condescending and mean, with a cruel, confident laugh. Grown-up and refined, not childish.',
              dict(light=['ふっ!', 'はっ!', 'そこよ。'], heavy=['お下がりなさい!', '邪魔よ。'], special=['しびれなさい。', '痺れて跪きなさい!'],
                   superv=['ひざまずきなさい、虫けら。'], throwv=['お退きなさい。'], hurt=['くっ…', '無礼な…!', 'あら…'],
                   hurtBig=['ああっ!', 'よくも…!'], ko=['この私が…ありえない…'], hup=['ふっ。'],
                   block=['あら、それだけ?'], laugh=['ふふふ…あはははは!'], win=['身の程を知りなさい。'],
                   dizzy=['くっ…目眩が…']), None),
    'mismatch': (MALE, 'A huge, burly Japanese MAN with a very deep, low, rumbling male bass voice, like a giant: '
                       'a golem stitched together from old socks, slow, gruff and a little dim-witted. Clearly an adult man.',
                 dict(light=['ぬん!', 'ふんっ!', 'どすっ!'], heavy=['ぬうううん!', 'どっすん!'], special=['靴下、くらえ!', '片っぽ、とんでけ!'],
                      superv=['ぜんぶ、ほどけろおおお!'], throwv=['ぽいっ!'], hurt=['ぬっ!', 'うぐ!', 'ほつれた!'],
                      hurtBig=['ぐおおおっ!', '縫い目がぁ!'], ko=['ほどける…ほどけるう…'], laugh=['ぐふふふ!'],
                      win=['コレクション、追加!'], dizzy=['ぐるぐる…ペアがいない…']), None),
    'puppet': (MALE, 'A flamboyant, theatrical young Japanese stage prince: dramatic, vain and hammy, a showman with a '
                     'bright, ringing, sing-song voice.',
               dict(light=['はっ!', 'それっ!', 'ほいっ!'], heavy=['ブラボー!', 'とうっ!'], special=['ボタン、乱れ撃ち!', 'ショーの始まりだ!'],
                    superv=['フィナーレだ!拍手を!'], throwv=['退場!'], hurt=['あいたっ!', '台本と違う!', 'ひっ!'],
                    hurtBig=['僕の衣装が!', 'ぎゃああ!'], ko=['幕が…下りる…'], laugh=['ハッハッハ、ブラボー!'],
                    win=['アンコールは僕にだけ!'], dizzy=['糸が…からまる…']), None),
    'mitten': (MALE, 'A big, grumpy Japanese man with a deep, booming but woolly, muffled voice: cold, sulky, jealous '
                     'and dramatic. Clearly an adult man.',
               dict(light=['ふんっ!', 'ぬん!', 'それっ!'], heavy=['ぬうん!', 'どすん!'], special=['雪玉、くらえ!', '凍えろ!'],
                    superv=['ブリザード・ハグだああ!'], throwv=['ぽいっ!'], hurt=['ぬっ!', '冷たっ!', 'ぐっ!'],
                    hurtBig=['毛玉がぁ!', 'ぐおお!'], ko=['片方…どこだ…'], laugh=['ぐははは!'],
                    win=['手袋の勝ちだ!'], dizzy=['ほどける…']), None),
    'iron': (MALE,'A towering, stern Japanese warlord: deep, commanding, booming voice, harsh and proud like a samurai general.',
             dict(light=['ふんっ!', 'せいっ!', 'はっ!'], heavy=['ぬおおっ!', '成敗!'], special=['蒸気を浴びよ!', '押し潰す!'],
                  superv=['しわ一つ残さぬ!'], throwv=['どりゃあ!'], hurt=['ぬっ!', 'ぐっ!', 'むっ!'], hurtBig=['ぐおおっ!', 'おのれ!'],
                  ko=['この…将軍が…!'], block=['効かぬ!'], laugh=['ぐははは!'], win=['完璧な仕上がりだ。'],
                  dizzy=['ぬう…目が…']), None),
    # ---- THE SHOE WARS (story chapters 8-20) ----
    'flipflop': (MALE, 'A laid-back young Japanese surfer dude: relaxed, sunny, drawling and cheerful, says "dude" a lot, '
                       'chill and goofy. Clearly a young man.',
                 dict(light=['ほいっ!', 'よっ!', 'それっ!'], heavy=['うぇーい!', 'どーん!'], special=['ビーサン、いけっ!', 'ワイプアウト!'],
                      superv=['カワバンガあああ!'], throwv=['ぽーい!'], hurt=['いてっ!', 'マジか!', 'うおっ!'],
                      hurtBig=['ワイプアウトだー!', 'うわあ!'], ko=['ひでぇ…波だぜ…'], laugh=['へへっ、イケてる!'],
                      win=['最高の波だったぜ!'], dizzy=['海がぐるぐる…']), None),
    'stiletto': (FEMALE, 'A haughty, glamorous Japanese fashion diva: sharp, sassy, dramatic and theatrical, a confident '
                         'catwalk queen with a sneering, elegant voice.',
                 dict(light=['はっ!', 'ふんっ!', 'えいっ!'], heavy=['ポーズ!', 'はああっ!'], special=['ヒール・スパイク!', 'ポーズを決めて!'],
                      superv=['ランウェイは私のものよ!'], throwv=['退場よ!'], hurt=['きゃっ!', '服が!', 'いやっ!'],
                      hurtBig=['ヒールが折れる!', 'きゃああ!'], ko=['今シーズン…終わり…'], laugh=['オーホッホッホ!'],
                      win=['あなた、時代遅れよ。'], dizzy=['フラッシュが…まぶしい…']), None),
    'galosh': (MALE, 'A huge, booming Japanese man with a big, rubbery, splashy, gleeful voice: loud, a little silly, loves '
                     'puddles. Clearly an adult man.',
               dict(light=['ふんっ!', 'ぬん!', 'それっ!'], heavy=['ザッバーン!', 'どすん!'], special=['水たまり、発射!', 'びしょぬれだ!'],
                    superv=['モンスーンだああ!'], throwv=['ぽちゃん!'], hurt=['キュッ!', 'ぐっ!', 'ぬっ!'],
                    hurtBig=['ゴムがぁ!', 'ぐおお!'], ko=['乾いて…しまう…'], laugh=['がっはっは!'],
                    win=['ずぶぬれだな!'], dizzy=['水がまわる…']), None),
    'skate': (FEMALE, 'A groovy, upbeat Japanese disco queen: bubbly, funky and sing-song, cheerful 1970s dance-floor '
                      'energy, a confident woman.',
              dict(light=['はっ!', 'それっ!', 'イェイ!'], heavy=['グルーヴィー!', 'フゥー!'], special=['ディスコ・スピン!', 'ローラー・ラッシュ!'],
                   superv=['グルーヴ・マシーン、スタート!'], throwv=['ほーら!'], hurt=['あんっ!', 'ちょっと!', 'いたっ!'],
                   hurtBig=['リズムが!', 'きゃああ!'], ko=['音楽が…止まる…'], laugh=['アハハ、ファンキー!'],
                   win=['踊り続けて、ベイビー!'], dizzy=['ミラーボールが…まわる…']), None),
    'tapper': (MALE, 'A dapper, old-fashioned Japanese showman: smooth, cheerful and theatrical, a song-and-dance man '
                     'with a crisp, bright voice.',
               dict(light=['タップ!', 'はっ!', 'それっ!'], heavy=['ジャズハンズ!', 'タタン!'], special=['タップ・アタック!', 'シャッフル!'],
                    superv=['フィナーレだ、拍手を!'], throwv=['ステージから退場!'], hurt=['おっと!', 'いたっ!', 'リズムが!'],
                    hurtBig=['タップが乱れる!', 'うわあ!'], ko=['幕…引き…'], laugh=['ハッハッハ!'],
                    win=['スタンディングオベーションを!'], dizzy=['ステップが…からまる…']), None),
    'slipper': (FEMALE, 'A sleepy, grumpy Japanese woman with a husky, yawning, cranky voice: drowsy and slow, then '
                        'suddenly roaring like a little dinosaur.',
                dict(light=['んっ!', 'ふんっ!', 'がおっ!'], heavy=['ガオー!', 'どすん!'], special=['おやすみゴロゴロ!', 'ねむねむスタンプ!'],
                     superv=['おやすみのお話、してあげる!'], throwv=['あっち行って!'], hurt=['むにゃ!', 'いたっ!', 'うう!'],
                     hurtBig=['眠いのに!', 'ガオオ!'], ko=['すぴー…'], laugh=['ふわぁ…ふふ…'],
                     win=['これで寝られる…'], dizzy=['ふわぁ…ねむ…']), None),
    'lace': (MALE, 'A sly, hissing Japanese man with a thin, slithering, snake-like voice: drawn-out s sounds, creepy '
                   'and smug.',
             dict(light=['シャッ!', 'シュッ!', 'はっ!'], heavy=['シャアア!', 'からめっ!'], special=['くつひも投げ縄!', '固結びだぁ!'],
                  superv=['からまれぇぇ!'], throwv=['ほどけろ!'], hurt=['シャッ!', 'くっ!', 'うぬ!'],
                  hurtBig=['ほつれるぅ!', 'シャアア!'], ko=['ほどけて…しまう…'], laugh=['シャッシャッシャ!'],
                  win=['結ばれたなぁ。'], dizzy=['からまって…まわる…']), None),
    'studs': (MALE, 'A loud, energetic Japanese football coach: shouty, sporty and boisterous, a gruff but cheerful '
                    'voice like a man yelling from the touchline.',
              dict(light=['おらっ!', 'ほいっ!', 'せいっ!'], heavy=['シュート!', 'どりゃあ!'], special=['パワーシュート!', 'オーバーヘッド!'],
                   superv=['ゴールデンゴールだ!'], throwv=['オフサイド!'], hurt=['ファウル!', 'いてっ!', 'ぐっ!'],
                   hurtBig=['レッドカード!', 'ぐああ!'], ko=['試合…終了…'], laugh=['がはは、ナイス!'],
                   win=['ゴオオオル!'], dizzy=['ボールが…ふたつ…']), None),
    'bigboot': (MALE, 'A gigantic, ancient Japanese giant: an extremely deep, slow, booming, rumbling voice that shakes '
                      'the room, grumpy and proud. Clearly a huge man.',
                dict(light=['ふん!', 'ぬん!', 'どん!'], heavy=['ドスン!', 'ぬおおお!'], special=['踏み潰す!', '泥をくらえ!'],
                     superv=['ストンパゲドンだあああ!'], throwv=['どけえ!'], hurt=['ぬっ!', 'ぐっ!', 'むう!'],
                     hurtBig=['わしの革がぁ!', 'ぐおおお!'], ko=['わしは…ただの…ブーツ…'], laugh=['ぐわっはっは!'],
                     win=['靴下は踏まれるものだ。'], dizzy=['ぬう…足元が…']), None),
    # CHAPTER 3: Lefty, the Lost Glove — a lonely, chillingly polite concierge
    'lefty': (MALE, 'A sly, quick-talking young Japanese man: a creepy villain who drops into a raspy, sinister whisper, '
                    'but also hilariously over-the-top dramatic and fussy, like a pompous hotel manager, '
                    'with a lonely, sad crack in his voice underneath it all.',
              dict(light=['はっ。', 'ふっ。', 'そこ。'], heavy=['お預かりします。', 'はあっ。'], special=['見つけました。', '拾得物です。'],
                   superv=['ファイブ・フィンガー・フレンジー。'], throwv=['お引き取りを。'], hurt=['くっ。', 'うっ。', '失礼。'],
                   hurtBig=['ぐうっ…'], ko=['私は…また…なくすのか…'], laugh=['ふふふ…'], win=['お忘れ物は、ございませんか。'],
                   dizzy=['…手が…しびれる…']), None),
    # Agent Fishnet: a secret shinobi of the royal court. Brave, fierce, and she trusts NOBODY.
    'fishnet': (FEMALE, 'A Japanese woman in her late twenties, a secret shinobi agent: a low, cool, controlled voice, '
                        'clipped and fierce, guarded and suspicious of everyone, brave and steely, with a dry, deadpan edge; '
                        'she speaks in short, sharp sentences, never girly or cute.',
                dict(light=['はっ。', 'ふっ。', 'せいっ。'], heavy=['はあっ!', '甘い。'], special=['逃がさない。', '終わりだ。'],
                     superv=['影縫い。'], throwv=['消えろ。'], hurt=['くっ。', 'ちっ。'], hurtBig=['ぐっ…まだだ。'],
                     ko=['不覚…'], laugh=['ふん。'], win=['任務完了。'], dizzy=['…視界が…']), None),
}


# Stocking Gran has no teeth: her さ-row comes out as a gummy lisp (さ→しゃ, す→しゅ, せ→しぇ, そ→しょ ...)
TOOTHLESS = {'gran'}
_LISP = {'さ': 'しゃ', 'す': 'しゅ', 'せ': 'しぇ', 'そ': 'しょ', 'ざ': 'じゃ', 'ず': 'じゅ', 'ぜ': 'じぇ', 'ぞ': 'じょ',
         'サ': 'シャ', 'ス': 'シュ', 'セ': 'シェ', 'ソ': 'ショ', 'ザ': 'ジャ', 'ズ': 'ジュ', 'ゼ': 'ジェ', 'ゾ': 'ジョ'}


def toothless(text):
    return ''.join(_LISP.get(c, c) for c in text)


def lines_for(cid):
    base, _, extra, _ = CAST[cid]
    words = {k: list(v) for k, v in base.items()}
    words.update(extra)
    if cid in TOOTHLESS:
        words = {k: [toothless(t) for t in v] for k, v in words.items()}
    return words


# Characters who must sound VERY old: their own design note (instead of "close-mic, punchy battle cries"),
# and their voice is picked by how old it sounds (see age_cues).
OLDEST = {
    'gran': ' Speaking style: a SASSY, quick-witted, fiery old granny of 98, SHOUTING and scolding at the top of '
            'her lungs, speaking SLOWLY and draggingly like a very old lady, with long pauses, but with snappy, cheeky comebacks and a sharp tongue, full of attitude, shrill and '
            'LOUD, her voice cracking and squeaking; now and then she trails off, forgets what she was saying, then '
            'snaps right back even louder. She has NO TEETH at all: a gummy, mushy, toothless mouth, lisping and '
            'slurring her s-sounds, lips smacking and flapping. Croaky and quavering with age, never calm. Natural '
            'recording in a small quiet room, no echo.',
}
# how OLDEST voices are picked: 'energy' = the most up-and-down, lively shouting (the age comes from the effect)
OLDEST_PICK = {'gran': 'energy'}
# the line a voice is designed with (and cloned from). Gran's is an angry telling-off, so every line she says
# carries that anger.
# Stinky and Argyle swapped voices (the player heard them the wrong way round): each reference recording keeps
# the words it was designed with
REF_TEXT_SWAP = {'stinky': 'はっ!はあっ!くらえ!成敗!', 'argyle': 'はっ!はあっ!くらえ!よっしゃあ!'}
REF_TEXT = {'shinobi': 'ふん…くだらない。俺の邪魔をするな。…はあっ!', 'fishnet': '動くな。私は誰も信用しない。…だが、おまえの背中は私が守る。行くぞ。', 'gran':'こらっ!背筋を伸ばしなさいって何度言ったらわかるんだい!…あれ、何の話だっけ?まあいい、とにかく伸ばしな!'}


def age_cues(y):
    """How old a voice sounds, roughly: its median pitch (Hz, lower = older for this voice) and its jitter
    (the cycle-to-cycle pitch shake, higher = older), measured with Praat."""
    try:
        import parselmouth
        from parselmouth.praat import call
        snd = parselmouth.Sound(np.asarray(y, dtype=np.float64), sampling_frequency=SR)
        pitch = snd.to_pitch(pitch_floor=75, pitch_ceiling=700)
        f0 = call(pitch, 'Get quantile', 0, 0, 0.5, 'Hertz')
        pp = call(snd, 'To PointProcess (periodic, cc)', 75, 700)
        jitter = call(pp, 'Get jitter (local)', 0, 0, 0.0001, 0.02, 1.3)
        lo = call(pitch, 'Get quantile', 0, 0, 0.1, 'Hertz')
        hi = call(pitch, 'Get quantile', 0, 0, 0.9, 'Hertz')
        f0 = f0 if f0 == f0 else 999.0
        jitter = jitter if jitter == jitter else 0.0
        spread = 12 * np.log2(hi / lo) if lo == lo and hi == hi and lo > 0 else 0.0  # semitones between low and high
        return f0, jitter, spread
    except Exception as e:
        print('  (age cues failed: %s)' % e, flush=True)
        return 999.0, 0.0, 0.0


def ref_line(cid):
    if cid in REF_TEXT_SWAP:
        return REF_TEXT_SWAP[cid]
    if cid in REF_TEXT:
        return toothless(REF_TEXT[cid]) if cid in TOOTHLESS else REF_TEXT[cid]
    w = lines_for(cid)
    return w['light'][0] + w['heavy'][0] + w['special'][0] + w['win'][0]


def trim(y, db=-40, pad=0.015):
    env = np.convolve(np.abs(y), np.ones(240) / 240, mode='same')
    idx = np.where(env > env.max() * 10 ** (db / 20))[0]
    if not len(idx):
        return y
    p = int(SR * pad)
    return y[max(0, idx[0] - p): idx[-1] + p]


def effect(y, kind):
    if kind == 'robot':  # ring modulation + slight bit-crush
        t = np.arange(len(y)) / SR
        y = 0.55 * y + 0.45 * y * np.sin(2 * np.pi * 55 * t)
        y = np.round(y * 48) / 48
    elif kind == 'demon':  # lower and slower, plus grit
        y = resample(y, int(len(y) * 1.22))
        y = np.tanh(2.2 * y / (np.max(np.abs(y)) or 1))
    elif kind == 'ghost':  # airy echo
        out = np.zeros(len(y) + int(SR * 0.5))
        out[:len(y)] += y
        for k, g in ((0.12, 0.35), (0.24, 0.18), (0.36, 0.08)):
            d = int(SR * k)
            out[d:d + len(y)] += y * g
        b, a = butter(1, 3500 / (SR / 2))
        y = lfilter(b, a, out)
    return y


def finish(y, kind):
    from fighter_fx import EFFECTS  # robot / demon / ghost (tuned after the first audition)
    y = trim(np.asarray(y, dtype=np.float64))
    if kind:
        y = EFFECTS[kind](y)
    y = trim(y, db=-45)
    n = min(len(y) // 4, int(SR * 0.005))
    if n > 1:
        r = np.linspace(0, 1, n)
        y[:n] *= r
        y[-n:] *= r[::-1]
    return y * (10 ** (-1 / 20) / (np.max(np.abs(y)) or 1))


def mp3(y):
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    return enc.encode((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush()


def plausible(text, y):
    chars = len(text.replace('…', '').replace('、', ''))
    return 0.12 <= len(y) / SR <= 0.3 * chars + 1.3


def echo_tail(y):
    """Average time (s) the sound lingers after each loud part ends, down to -30 dB: room echo."""
    env = np.convolve(np.abs(y), np.ones(240) / 240, mode='same')
    peak = env.max() or 1
    loud = env > peak * 0.3
    tails, i = [], 0
    while i < len(y):
        if loud[i]:
            j = i
            while j < len(y) and loud[j]:
                j += 1
            k = j
            while k < len(y) and env[k] > peak * 0.03 and not loud[k]:
                k += 1
            tails.append((k - j) / SR)
            i = k
        else:
            i += 1
    return float(np.mean(tails)) if tails else 0.0


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or list(CAST)
    os.makedirs(os.path.join(HERE, 'refs'), exist_ok=True)

    # 1) design each character's voice: one energetic reference line
    design = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0',
                                           dtype=torch.bfloat16, attn_implementation='sdpa')
    for n, cid in enumerate(ids):
        if os.path.exists(os.path.join(HERE, 'refs', f'fighter_{cid}.wav')) and '--redesign' not in sys.argv:
            continue  # keep the voice that was already designed (and auditioned)
        # several takes; keep the driest one (the model sometimes "records" a voice in a big echoey room).
        # OLDEST (Stocking Gran): more takes, and keep the lowest, shakiest voice of the dry ones.
        oldest = cid in OLDEST
        best, best_tail, best_score = None, 9.0, 9e9
        for take in range(10 if oldest else 5):
            torch.manual_seed(7000 + 100 * take + n + (500 if oldest else 0))
            wavs, _ = design.generate_voice_design(
                text=ref_line(cid), language='Japanese',
                instruct=CAST[cid][1] + (OLDEST[cid] if oldest else
                                         ' A fighting game character shouting battle cries: short, punchy and full of energy. '
                                         'Close-mic studio recording, completely dry, no reverb or echo.'))
            y = np.asarray(wavs[0], dtype=np.float32)
            tail = echo_tail(y)
            if oldest:
                f0, jitter, spread = age_cues(y)
                if OLDEST_PICK.get(cid) == 'energy':  # the liveliest: big ups and downs, a shaky voice
                    score = -20 * spread - 600 * jitter + (1000 if tail > 0.25 else 0)
                else:  # low and shaky wins; echoey loses
                    score = f0 - 600 * jitter + (1000 if tail > 0.25 else 0)
                print(f'  {cid} take {take + 1}: pitch {f0:.0f} Hz, ups-and-downs {spread:.1f} semitones, shake {jitter * 100:.1f}%, echo tail {tail * 1000:.0f} ms', flush=True)
                if score < best_score:
                    best, best_tail, best_score = y, tail, score
                continue
            print(f'  {cid} take {take + 1}: echo tail {tail * 1000:.0f} ms', flush=True)
            if tail < best_tail:
                best, best_tail = y, tail
        sf.write(os.path.join(HERE, 'refs', f'fighter_{cid}.wav'), best, SR)
        print(f'designed {cid} (echo tail {best_tail * 1000:.0f} ms)', flush=True)
    del design
    gc.collect()
    torch.cuda.empty_cache()

    # 2) every clip in that voice
    base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                         dtype=torch.bfloat16, attn_implementation='sdpa')
    path = os.path.join(HERE, 'fighter_clips.json')
    clips = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    preview = []
    for cid in ids:
        prompt = base.create_voice_clone_prompt(ref_audio=os.path.join(HERE, 'refs', f'fighter_{cid}.wav'), ref_text=ref_line(cid))
        kind = CAST[cid][3]
        clips[cid] = {}
        for word, texts in lines_for(cid).items():
            clips[cid][word] = []
            for j, text in enumerate(texts):
                for attempt in range(4):
                    torch.manual_seed(zlib.crc32(f"{cid}|{word}|{j}|{attempt}".encode()))
                    wavs, _ = base.generate_voice_clone(text=text, language='Japanese', voice_clone_prompt=prompt)
                    y = finish(wavs[0], kind)
                    if plausible(text, y):
                        break
                clips[cid][word].append(base64.b64encode(mp3(y)).decode('ascii'))
                if word in ('heavy', 'special', 'hurtBig', 'laugh', 'win') and j == 0:
                    preview += [y * 0.89, np.zeros(int(SR * 0.25))]
        preview.append(np.zeros(int(SR * 0.6)))
        print(f'{cid}: {sum(len(v) for v in clips[cid].values())} clips', flush=True)

    json.dump(clips, open(path, 'w', encoding='utf-8'))
    sf.write(os.path.join(HERE, 'samples', 'FIGHTERS_preview.wav'), np.concatenate(preview), SR)
    size = sum(len(c) for ch in clips.values() for v in ch.values() for c in v)
    print(f'done: {len(clips)} characters, {size / 1e6:.2f} MB embedded')


if __name__ == '__main__':
    main()
