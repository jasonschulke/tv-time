# 🎮 TV Time

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/jasonschulke/tv-time.svg)](https://github.com/jasonschulke/tv-time/releases)

A retro arcade **coin-drop TV-time meter for kids**, as a Home Assistant dashboard card.
A grown-up picks a time tier (Quick Video / Episode / Movie), the kid drags shiny
coins from their wallet into the coin slot, and when it fills up — *Ready to Play!*
Coins are spent against a daily budget you control with a single `input_number`.

No token, no cloud — the card runs inside your authenticated Home Assistant session.

<!-- Add a screenshot or GIF here once you have one:
![TV Time](docs/screenshot.png)
-->

## Features

- 🪙 **Drag-and-drop coins** into an arcade coin slot (touch + mouse).
- 👨‍👧 **Grown-up picks the time**, kid does the dragging — age-appropriate split.
- 🗓️ **Daily budget** in coins (e.g. 4 on weekdays = 1 hr, 8 on weekends = 2 hrs),
  with optional rollover.
- 🔢 **Wallet shows 10 slots**, only the day's available coins lit gold.
- 🔊 **8-bit sound effects + cozy background music** (synthesized, no audio files),
  with a mute toggle.
- 📺 **Optional "Turn on TV" button** that fires any Home Assistant service
  (a `media_player`, a `switch`, or a `script`) once time is funded.
- 📱 Works great full-screen in the Companion app.

## Installation

### HACS (custom repository)

1. In Home Assistant, open **HACS**.
2. Top-right **⋮ → Custom repositories**.
3. Repository: `https://github.com/jasonschulke/tv-time` — Category: **Dashboard**.
4. Find **TV Time** in HACS, **Download**, then reload your browser / Companion app.

One-click add:
[![Open your Home Assistant instance and open a repository inside HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jasonschulke&repository=tv-time&category=plugin)

HACS serves the file at `/hacsfiles/tv-time/tv-time.js` and adds the dashboard
resource for you. (On YAML-mode dashboards, add that URL as a **JavaScript Module** resource manually.)

### Manual

1. Copy `tv-time.js` to `/config/www/tv-time.js`.
2. **Settings → Dashboards → ⋮ → Resources → + Add Resource**
   URL `/local/tv-time.js?v=1`, type **JavaScript Module**.

## Setup

### 1. Create the coin helper

```yaml
input_number:
  tv_coins_remaining:
    name: TV Coins Remaining
    min: 0
    max: 20          # must be >= your rollover cap
    step: 1
    icon: mdi:circle-multiple
```

### 2. Add the card

```yaml
type: custom:tv-time-card
coin_entity: input_number.tv_coins_remaining
reset_hour: 6
minutes_per_coin: 15
weekday_coins: 4
weekend_coins: 8
wallet_slots: 10
action_entity: ""                  # e.g. media_player.living_room_tv / switch.tv / script.tv_time
action_service: homeassistant.turn_on
action_label: TURN ON TV
music: true
music_volume: 0.45
sound: true
shows:
  - name: Quick Video
    cost: 1
  - name: Episode
    cost: 2
  - name: Movie
    cost: 8
```

Only `coin_entity` is needed; everything else has a default.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `coin_entity` | `input_number.tv_coins_remaining` | The helper holding remaining coins. |
| `reset_hour` | `6` | Hour (0–23) the countdown targets; match your refill automation. |
| `minutes_per_coin` | `15` | Minutes each coin represents (drives the time labels). |
| `weekday_coins` | `4` | Coins shown as the daily allotment Mon–Fri (display + default). |
| `weekend_coins` | `8` | Coins shown as the daily allotment Sat–Sun. |
| `wallet_slots` | `10` | Total slots in the wallet (available coins are lit gold). |
| `action_entity` | `""` | Entity the "Ready to play" button acts on. Blank = plain play button. |
| `action_service` | `homeassistant.turn_on` | `domain.service` to call on `action_entity`. |
| `action_label` | `TURN ON TV` | Label for the action button. |
| `music` | `true` | Background 8-bit music. |
| `music_volume` | `0.45` | Music volume, 0–1. |
| `sound` | `true` | Coin / win sound effects. |
| `shows` | Quick Video / Episode / Movie | Time tiers. Each: `name` and `cost` (coins). |

### 3. Daily rollover automation (optional)

Keeps leftover coins and adds the day's grant, capped so they can't hoard forever:

```yaml
alias: TV Coins Daily Rollover
triggers:
  - trigger: time
    at: "06:00:00"
actions:
  - action: input_number.set_value
    target:
      entity_id: input_number.tv_coins_remaining
    data:
      value: >
        {% set leftover = states('input_number.tv_coins_remaining') | float(0) %}
        {% set grant = 8 if now().weekday() in [5, 6] else 4 %}
        {% set cap = 16 %}
        {{ [leftover + grant, cap] | min }}
mode: single
```

### 4. "TV time started" phone alert (optional)

```yaml
alias: TV Time Started Alert
triggers:
  - trigger: state
    entity_id: input_number.tv_coins_remaining
conditions:
  - condition: template
    value_template: >
      {{ trigger.from_state.state not in ['unknown','unavailable']
         and (trigger.to_state.state | float) < (trigger.from_state.state | float) }}
actions:
  - action: notify.mobile_app_YOUR_PHONE
    data:
      title: "TV Time"
      message: >
        {% set spent = (trigger.from_state.state | float) - (trigger.to_state.state | float) %}
        {{ (spent * 15) | int }} min of TV started — {{ trigger.to_state.state | int }} coins left today.
mode: single
```

## How it works

Coins dropped on the slot are **staged**, not spent — drag a staged coin back to the
wallet to reclaim it, or change the time chip to reset. Filling the slot subtracts the
cost from the helper (via `input_number.set_value`) and shows **Ready to play**. The card
reacts to the helper changing, so daily refills appear instantly with no polling.

## Notes

- The pixel fonts (Press Start 2P, VT323) load from Google Fonts. On installs with a
  strict custom Content-Security-Policy they may fall back to a system font; everything
  else still works.
- This card meters the **budget**, not the clock — it doesn't auto-off the TV.

## Credits

Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) and
[VT323](https://fonts.google.com/specimen/VT323) (SIL Open Font License).

## License

[MIT](LICENSE) © Jason Schulke
