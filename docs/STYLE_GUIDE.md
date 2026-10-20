# Rec Room Style Guide

Specs for HTML pages in this multiplayer game app. The visual language comes from the sports collage: coral court stripes, a tennis-net grid, a sky-blue arena circle, and die-cut sticker outlines. Use those as **texture and color**, not as a sports-only theme — this is a game-night table for friends.

Live gallery: [`/style-guide.html`](../public/style-guide.html)  
Stylesheet: [`/styles.css`](../public/styles.css)

---

## 1. Brand

**Personality:** playful, social, sticker-like. Rec-room energy. Competitive but kind.

| Do | Don't |
| --- | --- |
| Invite people to sit down and play | Sound like a dashboard or sports broadcast |
| Use short, warm copy (“Your turn”, “Pull up a chair”) | Theme labels around tennis, bowling, or leagues |
| Treat the collage as **logo / hero art** | Repeat clip-art of rackets and balls across every screen |

**Court vs arena**

- **Court coral** (`--color-court`): energy — primary actions, scores, “your turn”, header/footer bands.
- **Arena blue** (`--color-arena`): “you’re in the game” — play surface, headers inside the well, info chrome.
- **Net cream** (`--color-net`): the field around the table — page background, quiet panels.

Voice: second person, present tense, short sentences. Celebrate wins without mocking the table.

---

## 2. Color

Tokens live on `:root` in `public/styles.css`.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-arena` | `#3BADE8` | Blue circle / play well |
| `--color-court` | `#E85C48` | Coral bands, CTAs, selection |
| `--color-ball` | `#D4893A` | Warm badges, ready state, wins |
| `--color-ink` | `#2B2A28` | Text, outlines |
| `--color-net` | `#F4F1E8` | Page field, quiet fills |
| `--color-felt` | `#1F6FA3` | Hover / contrast on blue, links |
| `--color-chalk` | `#FFFFFF` | Sticker stroke, button text on coral |
| `--color-court-deep` | `#C24535` | Primary hover, danger |
| `--color-muted` | `#6E6A64` | Secondary copy |
| `--color-shadow` | `rgb(43 42 40 / 18%)` | Lift shadows |

**Roles**

- Page background: net cream + CSS net grid + coral top/bottom bands.
- Primary button: court fill, chalk text, ink outline.
- Secondary button: chalk fill, ink outline.
- Selected / focus: chalk inner stroke + court outer ring (sticker look).
- Success: ball orange. Danger: court deep. Info: arena blue.

**Contrast**

- Body text is ink on net or chalk — AA for normal text.
- Chalk on court and chalk on felt are for **UI labels and buttons** (large/bold), not long paragraphs.
- Do not put muted gray on arena blue. Use chalk or ink-outlined chalk chips instead.

**Don't**

- Don't introduce a new brand hue without adding a token.
- Don't use the old `#2f7dff` selection ring.
- Don't put coral text on arena blue (poor contrast and two accents fighting).

---

## 3. Type

Load Google Fonts in the document `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;700;800&display=swap"
  rel="stylesheet"
/>
```

| Role | Font | Token | Use |
| --- | --- | --- | --- |
| Display | Fredoka | `--font-display` | Titles, scores, buttons, brand |
| UI / body | Nunito | `--font-ui` | Chat, rules, forms, body |

**Scale**

| Token | Size | Typical use |
| --- | --- | --- |
| `--text-xs` | 14px | Captions, badge, chat “who” |
| `--text-sm` | 16px | Body, buttons |
| `--text-md` | 20px | Section titles, brand |
| `--text-lg` | 28px | Page titles |
| `--text-xl` | 40px | Hero / lobby headline |

Line-height: `--leading-tight` (1.2) for display, `--leading-body` (1.5) for copy. Buttons and chips use weight 600–800.

---

## 4. Layout

Page anatomy, top to bottom:

1. **Coral band** — `.band` header (brand, nav, player chip).
2. **Net field** — body background (grid + cream).
3. **Arena well** — `.arena` (circle) or `.arena--rect` (rounded rectangle for denser UI).
4. **Coral band** — footer (status, leave table).

```html
<body class="page">
  <header class="band">
    <a class="brand" href="/">Rec Room</a>
  </header>
  <main class="page-body">
    <div class="arena arena--rect">
      <!-- table, lobby, results -->
    </div>
  </main>
  <footer class="band">
    <span>Waiting for friends…</span>
  </footer>
</body>
```

Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 (`--space-1` … `--space-7`).

**Arena circle** (`.arena`) is for a single focal well (home hero, winner badge). Use `.arena--rect` for lists, forms, and galleries.

Sticker stroke on panels: white ring, then ink ring, then a soft lift shadow.

---

## 5. Components

Hit targets are at least **44px** tall. Interactive elements use the bounce ease (`--ease-bounce`, ~180ms).

### Buttons

```html
<button class="btn btn-primary" type="button">Play</button>
<button class="btn btn-secondary" type="button">Spectate</button>
<button class="btn btn-ghost" type="button">Rules</button>
<button class="btn btn-icon btn-secondary" type="button" aria-label="More">···</button>
```

| State | Behavior |
| --- | --- |
| Hover | Lifts 2px, ink “floor” shadow grows |
| Active | Presses down |
| Disabled | 50% opacity, no lift, `cursor: not-allowed` |
| Focus | Chalk + court double ring (`--focus-ring`) |

### Panel

```html
<section class="panel">
  <h2>Tonight’s table</h2>
  <p class="muted">Four seats. First to 500.</p>
</section>
```

### Player chip

```html
<div class="player-chip is-turn">
  <span class="avatar" aria-hidden="true">A</span>
  Alex
</div>
<div class="player-chip is-ready">
  <span class="avatar" aria-hidden="true">B</span>
  Bo
</div>
```

- Default: seated.
- `.is-turn`: court sticker ring (your turn / current actor).
- `.is-ready`: ball-orange avatar.
- `.is-away`: muted.

### Lobby room card

```html
<article class="room-card">
  <header>
    <h3>Kitchen table</h3>
    <span class="seats">2 / 4</span>
  </header>
  <p class="muted">Casual · best of three</p>
  <div class="players">…chips…</div>
  <button class="btn btn-primary" type="button">Join</button>
</article>
```

### Forms

```html
<label class="field">
  <span class="label">Display name</span>
  <input class="input" type="text" name="name" autocomplete="nickname" />
</label>
```

Use `.select` and `.textarea` the same way. Labels stay visible; don’t rely on placeholder alone.

### Chat bubble

```html
<div class="chat">
  <div class="bubble">
    <span class="who">Bo</span>
    Ready when you are.
  </div>
  <div class="bubble is-self">
    <span class="who">You</span>
    Shuffle us in.
  </div>
</div>
```

### Toast and badges

```html
<div class="toast" role="status">Bo joined the table</div>
<span class="badge">Ready</span>
<span class="badge badge-score">120</span>
<span class="badge badge-info">Info</span>
```

## 6. Iconography and imagery

- Favicons, empty states, and the marketing hero may use the sports collage.
- In-app icons should be simple, round, and **outlined in ink** like stickers (white fill, 2px charcoal stroke).
- Circular badges match the arena. Avoid sharp rectangles for avatars.
- Do not wallpaper pages with rackets, bats, or balls. The net grid and coral bands already carry the motif.

---

## 7. Motion and accessibility

- Duration: `--duration` (180ms). Easing: `--ease-bounce`.
- Honor `prefers-reduced-motion: reduce` (transitions/animations off in CSS).
- Focus rings are required; never `outline: none` without a replacement. Use `--focus-ring` (chalk + court).
- Include a skip link to `#main` on multi-section pages.
- Color is not the only state signal: “your turn” uses the ring **and** copy (“Alex to play”).
- Minimum contrast as in [Color](#2-color). Hit targets ≥ 44px.

---

## 8. Page recipes

### Lobby

Header band with brand + “Host a table”. Body: `.arena--rect` containing a `.grid-2` of `.room-card`. Footer band: connection status.

### In-game table

Header: brand + opponent chips (active chip gets `.is-turn`). Body: circular `.arena` for the play surface. Footer: “Your turn” or a primary **Play** button.

### Results

Circular `.arena` with a display headline (“Table’s yours”), score badges, and `btn-primary` **Rematch** + `btn-secondary` **Lobby**.

New HTML files should:

1. Link `/styles.css` and the Fredoka + Nunito font stylesheet.
2. Use `.page` > `.band` > `.page-body` > `.arena`.
3. Prefer existing component classes over one-off colors.
4. Keep game logic out of the stylesheet — tokens and classes only.
