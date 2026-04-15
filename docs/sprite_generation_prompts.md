# Sprite Generation Prompts (Boss Super Attacks + Player Supers)

This file contains production-ready prompts for generating new sprite frames that match current characters.

## Recommended output style
- pixel-art, side-view, transparent background
- same silhouette and costume as current in-game character
- strong action pose, clean readable weapon pose
- no text, no logos, no watermark
- 1024x1024 source, then crop to frame

## Boss attack prompts

### marja_liisa
- `PARKKIPAIKKA-LAPSY`: "Pixel-art side-view attack frame for boss Marja-Liisa (suburban ski mom), aggressive slap strike, transparent background, keep outfit and face style consistent with existing sprite set, no text"
- `WESTEND-RYNNI`: "Pixel-art side-view sprint charge frame for boss Marja-Liisa, leaning forward with handbag swing motion blur, transparent background, same character identity"
- `VALITUSMYRSKY`: "Pixel-art side-view barrage frame for boss Marja-Liisa, shouting with both hands raised, dramatic expression, transparent background"
- `PANIIKKI-POMPPU`: "Pixel-art side-view leap slam wind-up frame for boss Marja-Liisa, knees bent mid-air preparation, transparent background"

### jari_litmanen
- `AJAX-LAUKAUS`: "Pixel-art side-view football strike frame for boss Litmanen parody, powerful kick follow-through, transparent background, same face and kit identity"
- `KUNINKAAN SYOKSY`: "Pixel-art side-view charge frame for Litmanen parody boss, low sprint posture, transparent background"
- `AMSTERDAM-BARRAGE`: "Pixel-art side-view rapid volley frame for Litmanen parody boss, multiple football motion arcs, transparent background"
- `STADIONI-SLAM`: "Pixel-art side-view leap slam frame for Litmanen parody boss, airborne impact pose, transparent background"

### jari_isometsa
- `PLAID-OSUMA`: "Pixel-art side-view tech-bro punch frame for Tesla CEO parody boss, expensive jacket silhouette, transparent background"
- `LUDICROUS RAMMI`: "Pixel-art side-view high-speed charge frame for Tesla CEO parody boss, dynamic forward lean, transparent background"
- `SPACEX-SADE`: "Pixel-art side-view barrage cast frame for Tesla CEO parody boss, throwing glowing particles forward, transparent background"
- `HYPERLOOP-SLAM`: "Pixel-art side-view leap slam frame for Tesla CEO parody boss, airborne with heavy downward impact intent, transparent background"

### matti_nykanen
- `GREEN-LYONTI`: "Pixel-art side-view golf swing attack frame for golf boss parody, club extended in strike, transparent background"
- `EAGLE-SYOKSY`: "Pixel-art side-view charge frame for golf boss parody, aggressive rush with club tucked, transparent background"
- `DRIVER-KUURO`: "Pixel-art side-view projectile barrage frame for golf boss parody, rapid driver shots, transparent background"
- `BUNKKERI-LOIKKA`: "Pixel-art side-view leap slam frame for golf boss parody, high jump with club overhead, transparent background"

### jeti
- `HUUSSI-HEILAUS`: "Pixel-art side-view melee swing frame for PASI/Jeti boss parody, rough utility worker energy, transparent background"
- `KUPONKIRYNNI`: "Pixel-art side-view feral charge frame for PASI/Jeti boss, very aggressive forward motion, transparent background"
- `LETKUKUURO`: "Pixel-art side-view barrage frame for PASI/Jeti boss, spraying chaotic stream effect, transparent background"
- `HUUSSIHYPY`: "Pixel-art side-view leap slam frame for PASI/Jeti boss, heavy downward stomp in air, transparent background"

### timo_soini
- `JYTKY-LAPSY`: "Pixel-art side-view heavy strike frame for final boss Timo parody, forceful arm swing, transparent background"
- `VAALI-RYNNI`: "Pixel-art side-view charge frame for final boss Timo parody, dramatic political rally rush posture, transparent background"
- `LAUSUNTO-MYRSKY`: "Pixel-art side-view barrage frame for final boss Timo parody, rapid shout-and-cast pose, transparent background"
- `EDUSKUNTA-SLAM`: "Pixel-art side-view leap slam frame for final boss Timo parody, powerful airborne impact pose, transparent background"

## Player super prompts
- `SUPERSYOKSY`: "Pixel-art side-view player super dash axe frame, full-body forward lunge, oversized axe trail, transparent background, keep current player outfit and proportions"
- `MYRSKYVOLTTI`: "Pixel-art side-view player tornado spin frame, rapid rotational silhouette with circular motion trails, transparent background"
- `SUPERSAUVA`: "Pixel-art side-view player staff frenzy frame, dual-hand wide swing with radial strike arcs, transparent background"

## Batch generation command (when OPENAI_API_KEY is set)
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"

python3 "$IMAGE_GEN" generate-batch \
  --input docs/sprite_generation_prompts.jsonl \
  --out-dir output/imagegen \
  --concurrency 4 \
  --quality high
```

## Dry run check
```bash
python3 "$IMAGE_GEN" generate --prompt "Pixel-art attack frame test" --dry-run
```
