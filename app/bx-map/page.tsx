'use client';

import Script from 'next/script';

// ---------- Token bridge + full map CSS ----------
// Backtick-free; safe to embed in a template string.
const MAP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Archivo+Narrow:wght@500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap');
/* ====== Token bridge: site's --bx-* tokens → map's --surface/--fg/--accent layer ====== */
:root {
  /* UI chrome — follows site theme automatically */
  --surface: var(--bx-ink);
  --surface-raised: var(--bx-ink-soft);
  --surface-sunken: color-mix(in srgb, var(--bx-ink) 85%, black);
  --paper: var(--bx-ink-soft);
  --fg: var(--bx-parchment);
  --fg-muted: var(--bx-slate);
  --fg-subtle: color-mix(in srgb, var(--bx-slate) 70%, transparent);
  --border: color-mix(in srgb, var(--bx-parchment) 15%, transparent);
  --border-strong: color-mix(in srgb, var(--bx-parchment) 30%, transparent);
  --accent: var(--bx-brass);
  --accent-text: var(--bx-brass);
  --accent-bg: color-mix(in srgb, var(--bx-brass) 15%, transparent);
  --accent-fg: var(--bx-ink);
  --navy: var(--bbc-navy, #00205b);
  /* Map-specific tokens — architectural colours that don't follow site theme */
  --wall:#1c2740; --wall-thin:#5b6780; --exit:#1f8a4c; --exit-bg:#e2f3e8;
  --c-worship:#dfe4f4; --c-kids:#dcefe2; --c-students:#f7e8cd; --c-hospitality:#f6e2df; --c-fitness:#d8edf1;
  --c-meeting:#e7e6f2; --c-restroom:#ece4f4; --c-hall:#f6f7f9; --c-stairs:#e7ebf0; --c-elevator:#dfe5ec; --c-support:#eceef1;
  --t-worship:#3a4a8a; --t-kids:#2d6b45; --t-students:#8a5a10; --t-hospitality:#9a3f3a; --t-fitness:#106b7a;
  --t-meeting:#5a4f8f; --t-restroom:#6b4d96; --t-hall:#5b6780; --t-stairs:#3c4a63; --t-elevator:#3c4a63; --t-support:#66707f;
  --shadow:0 10px 30px rgba(16,26,51,.14); --focus:#ffb02e;
  color-scheme:light;
}
/* Room / wall colours adapt in dark mode; UI chrome adapts automatically via --bx-* */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --wall:#dfe6f4; --wall-thin:#8f9bb5; --exit:#4fcf85; --exit-bg:#123a24;
    --c-worship:#28345e; --c-kids:#1e3f2c; --c-students:#4a3714; --c-hospitality:#4a2a2a; --c-fitness:#123c47;
    --c-meeting:#33305a; --c-restroom:#3a2f55; --c-hall:#1a2236; --c-stairs:#26314a; --c-elevator:#2c3b53; --c-support:#222b3d;
    --t-worship:#b8c4f5; --t-kids:#9edcb7; --t-students:#f0c97a; --t-hospitality:#f3a8a1; --t-fitness:#86d7e8;
    --t-meeting:#c1b8f4; --t-restroom:#cbb4f0; --t-hall:#9aa6c0; --t-stairs:#b9c4da; --t-elevator:#b9c4da; --t-support:#a3adc0;
    --shadow:0 12px 34px rgba(0,0,0,.5);
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --wall:#dfe6f4; --wall-thin:#8f9bb5; --exit:#4fcf85; --exit-bg:#123a24;
  --c-worship:#28345e; --c-kids:#1e3f2c; --c-students:#4a3714; --c-hospitality:#4a2a2a; --c-fitness:#123c47;
  --c-meeting:#33305a; --c-restroom:#3a2f55; --c-hall:#1a2236; --c-stairs:#26314a; --c-elevator:#2c3b53; --c-support:#222b3d;
  --t-worship:#b8c4f5; --t-kids:#9edcb7; --t-students:#f0c97a; --t-hospitality:#f3a8a1; --t-fitness:#86d7e8;
  --t-meeting:#c1b8f4; --t-restroom:#cbb4f0; --t-hall:#9aa6c0; --t-stairs:#b9c4da; --t-elevator:#b9c4da; --t-support:#a3adc0;
  --shadow:0 12px 34px rgba(0,0,0,.5);
  color-scheme:dark;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--surface);color:var(--fg);font-family:"Source Sans 3",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.4;overflow:hidden}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
button:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.app{height:100%;display:grid;grid-template-rows:auto auto 1fr;padding-top:env(safe-area-inset-top,0px)}
/* ---------- top bar ---------- */
.bar{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface-raised);border-bottom:1px solid var(--border);flex-wrap:wrap;z-index:5}
.brand{display:flex;align-items:baseline;gap:10px;min-width:0}
.brand h1{font-family:"Archivo",sans-serif;font-weight:700;font-size:20px;letter-spacing:-.01em;margin:0;color:var(--navy);white-space:nowrap}
.brand span{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-subtle);white-space:nowrap}
.seg{display:inline-flex;background:var(--surface-sunken);border-radius:10px;padding:3px;gap:2px}
.seg button{padding:7px 14px;border-radius:8px;font-weight:600;font-size:14px;color:var(--fg-muted)}
.seg button[aria-pressed="true"]{background:var(--surface-raised);color:var(--navy);box-shadow:0 1px 3px rgba(0,0,0,.15)}
.search{position:relative;flex:1 1 220px;min-width:180px;max-width:420px;margin-left:auto}
.search input{width:100%;padding:9px 36px 9px 36px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font-size:15px}
.search input::placeholder{color:var(--fg-subtle)}
.search svg.ico{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:16px;height:16px;fill:none;stroke:var(--fg-subtle);stroke-width:2;pointer-events:none}
.search .clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:50%;color:var(--fg-subtle);display:none;align-items:center;justify-content:center}
.search .clear.show{display:flex}
.results{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--surface-raised);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);max-height:min(50vh,360px);overflow:auto;z-index:20;display:none}
.results.show{display:block}
.results button{display:flex;width:100%;align-items:center;gap:10px;padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)}
.results button:last-child{border-bottom:0}
.results button:hover,.results button.active{background:var(--surface-sunken)}
.results .sw{width:12px;height:12px;border-radius:3px;flex:none;border:1px solid var(--border-strong)}
.results .nm{flex:1;min-width:0;font-weight:600}
.results .lv{font-size:12px;color:var(--fg-subtle);white-space:nowrap}
.results .empty{padding:12px;color:var(--fg-subtle)}
/* ---------- stage ---------- */
.stage{position:relative;min-height:0;display:grid;grid-template-columns:1fr;grid-template-rows:1fr}
.mapwrap{position:relative;overflow:hidden;background:var(--surface);touch-action:none;cursor:grab}
.mapwrap.dragging{cursor:grabbing}
.mapwrap svg.map{width:100%;height:100%;display:block}
.chips{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding:6px 14px 4px;scrollbar-width:none;border-bottom:1px solid var(--border);background:var(--surface-raised)}
.chips::-webkit-scrollbar{display:none}
.chip{pointer-events:auto;flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 7px;border-radius:999px;background:var(--surface-raised);border:1px solid var(--border);font-size:12.5px;font-weight:600;color:var(--fg-muted);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.chip i{width:10px;height:10px;border-radius:3px;border:1px solid rgba(0,0,0,.15)}
.chip[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-text);background:var(--accent-bg)}
.zoom{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;z-index:3}
.zoom button{width:38px;height:38px;border-radius:10px;background:var(--surface-raised);border:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,.12);font-size:20px;font-weight:600;color:var(--fg-muted);display:flex;align-items:center;justify-content:center}
.zoom button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.legend{position:absolute;left:12px;bottom:12px;z-index:3;background:color-mix(in srgb,var(--surface-raised) 88%,transparent);backdrop-filter:blur(6px);border:1px solid var(--border);border-radius:12px;padding:8px 10px;display:grid;grid-template-columns:auto auto;gap:4px 14px;font-size:12px;color:var(--fg-muted)}
.legend div{display:flex;align-items:center;gap:6px;white-space:nowrap}
.legend svg{width:16px;height:16px}
.hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font-size:12px;color:var(--fg-subtle);background:color-mix(in srgb,var(--surface-raised) 85%,transparent);padding:4px 10px;border-radius:999px;border:1px solid var(--border);pointer-events:none;transition:opacity .4s;white-space:nowrap}
.hint.fade{opacity:0}
/* ---------- svg styling ---------- */
.room{stroke:var(--wall-thin);stroke-width:2;transition:fill .18s,stroke .18s,filter .18s;cursor:pointer}
.room.worship{fill:var(--c-worship)} .room.kids{fill:var(--c-kids)} .room.students{fill:var(--c-students)}
.room.hospitality{fill:var(--c-hospitality)} .room.fitness{fill:var(--c-fitness)} .room.meeting{fill:var(--c-meeting)}
.room.restroom{fill:var(--c-restroom)} .room.hall{fill:var(--c-hall)} .room.stairs{fill:var(--c-stairs)}
.room.elevator{fill:var(--c-elevator)} .room.support{fill:var(--c-support)}
.g-room:hover .room{filter:brightness(.94)}
.g-room.selected .room{stroke:var(--accent);stroke-width:7;filter:none}
.g-room.selected .rlabel{fill:var(--accent-text)}
.g-room.inner .room{stroke-dasharray:6 5;stroke-width:2.2;filter:brightness(.93)}
.g-room.dim .room{fill:var(--surface-sunken);opacity:.55}
.g-room.dim .rlabel,.g-room.dim .aka,.g-room.dim .deco{opacity:.25}
.rlabel{font-family:"Archivo Narrow","Archivo",sans-serif;font-weight:600;fill:var(--fg);pointer-events:none;text-anchor:middle;dominant-baseline:middle;letter-spacing:.01em}
.rlabel.worship{fill:var(--t-worship)} .rlabel.kids{fill:var(--t-kids)} .rlabel.students{fill:var(--t-students)}
.rlabel.hospitality{fill:var(--t-hospitality)} .rlabel.fitness{fill:var(--t-fitness)} .rlabel.meeting{fill:var(--t-meeting)}
.rlabel.restroom{fill:var(--t-restroom)} .rlabel.hall{fill:var(--t-hall);font-weight:500;font-style:italic;paint-order:stroke;stroke:var(--c-hall);stroke-width:5px;stroke-linejoin:round} .rlabel.stairs{fill:var(--t-stairs);paint-order:stroke;stroke:var(--c-stairs);stroke-width:6px;stroke-linejoin:round}
.rlabel.elevator{fill:var(--t-elevator)} .rlabel.support{fill:var(--t-support)}
.aka{font-family:"Archivo","Source Sans 3",sans-serif;font-weight:700;fill:var(--accent-text);pointer-events:none;text-anchor:middle;dominant-baseline:middle;display:none}
.show-aka .aka{display:block}
.outline{fill:none;stroke:var(--wall);stroke-width:9;stroke-linejoin:miter;pointer-events:none}
.deco{pointer-events:none}
.tread{stroke:var(--wall-thin);stroke-width:1.6;fill:none}
.stair-arrow{fill:none;stroke:var(--t-stairs);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.court{fill:none;stroke:var(--t-fitness);stroke-width:2;opacity:.55}
.arc{fill:none;stroke:var(--wall-thin);stroke-width:2.5;stroke-linecap:round}
.exit rect{fill:var(--exit);stroke:var(--surface);stroke-width:2}
.exit text{fill:#fff;font-family:"Archivo",sans-serif;font-weight:700;font-size:15px;text-anchor:middle;dominant-baseline:middle;letter-spacing:.06em}
.exit.selected rect{stroke:var(--accent);stroke-width:5}
.door line{stroke:var(--surface);stroke-width:12;stroke-linecap:butt}
.door path{fill:none;stroke:var(--wall-thin);stroke-width:1.6}
.door text{fill:var(--fg-muted);font-family:"Archivo Narrow",sans-serif;font-size:17px;font-weight:600;pointer-events:none}
.icon-rr{fill:var(--t-restroom)}
.icon-el{fill:none;stroke:var(--t-elevator);stroke-width:3}
.g-room.elevator .rlabel{font-size:15px}
.poi circle{fill:var(--surface-raised);stroke:var(--wall-thin);stroke-width:2;cursor:pointer}
.poi.aed circle{stroke:#c9302c}.poi.aed .i-fill{fill:#c9302c}.poi.aed .i-bolt{fill:none;stroke:#fff;stroke-width:1.8;stroke-linejoin:round}
.poi.info circle{stroke:var(--accent)}.poi.info .i-fill{fill:var(--accent)}.poi.info .i-line{fill:none;stroke:var(--accent);stroke-width:2.2;stroke-linecap:round}
.poi.coffee .i-line,.poi.cart .i-line{fill:none;stroke:var(--fg-muted);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.poi.selected circle{stroke:var(--accent);stroke-width:5}
.ctxlabel{font-family:"Archivo",sans-serif;font-weight:600;font-size:17px;letter-spacing:.18em;fill:var(--fg-subtle);text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.north path{fill:var(--fg-subtle)}.north text{font-family:"Archivo",sans-serif;font-weight:700;font-size:18px;fill:var(--fg-subtle);text-anchor:middle}
.counter-out{fill:none;stroke:var(--wall-thin);stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round;opacity:.55}
.counter-in{display:none}
.mark circle{fill:#e8912d;stroke:#fff;stroke-width:2.5;cursor:pointer}
.mark text{fill:#fff;font-family:"Archivo",sans-serif;font-weight:700;font-size:15px;text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.mark.active circle{stroke:var(--accent);stroke-width:4}
.mapwrap.doormode{cursor:crosshair}
.mapwrap.doormode .room{cursor:crosshair}
.snapdot{fill:none;stroke:#e8912d;stroke-width:3;pointer-events:none}
.doorbtn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-raised);font-weight:600;font-size:14px;color:var(--fg-muted);white-space:nowrap}
.doorbtn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.doorbtn[aria-pressed="true"]{background:#e8912d;border-color:#e8912d;color:#fff}
.doorpanel{padding:14px 16px 16px;overflow:auto;font-size:14px}
.doorpanel h2{margin:0 0 4px;font-family:"Archivo",sans-serif;font-size:17px;color:var(--navy)}
.doorpanel p{margin:0 0 10px;color:var(--fg-muted);max-width:44ch}
.doorpanel .status{font-size:12px;color:var(--fg-subtle);margin-bottom:8px}
.doorpanel ol{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.doorpanel li{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--paper)}
.doorpanel li.active{border-color:#e8912d}
.doorpanel li .n{width:22px;height:22px;border-radius:50%;background:#e8912d;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center}
.doorpanel li .rm{font-weight:600;font-size:13px;min-width:0}
.doorpanel li .rm small{display:block;font-weight:400;color:var(--fg-subtle)}
.doorpanel li input{grid-column:1/-1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--fg);font:inherit;font-size:13px}
.doorpanel li .del{width:26px;height:26px;border-radius:50%;color:var(--fg-subtle);display:flex;align-items:center;justify-content:center}
.doorpanel li .del:hover{background:var(--surface-sunken);color:#c9302c}
.doorpanel .actions{display:flex;gap:8px;margin-top:10px}
.doorpanel .actions button{padding:7px 12px;border-radius:8px;border:1px solid var(--border);font-weight:600;font-size:13px;color:var(--fg-muted)}
.panel.doormode .ph,.panel.doormode .pb,.panel.doormode .welcome{display:none!important}
.panel:not(.doormode) .doorpanel{display:none}
.pulse{fill:none;stroke:var(--accent);stroke-width:4;opacity:0;pointer-events:none}
@keyframes ring{0%{opacity:.9;stroke-width:4}100%{opacity:0;stroke-width:40}}
.pulse.go{animation:ring 1s ease-out 1}
/* ---------- panel ---------- */
.panel{position:absolute;z-index:6;background:var(--surface-raised);border:1px solid var(--border);box-shadow:var(--shadow);display:flex;flex-direction:column;transform:translateY(110%);transition:transform .28s cubic-bezier(.2,.8,.2,1)}
.panel.open{transform:none}
.panel .grab{width:40px;height:4px;border-radius:2px;background:var(--border-strong);margin:8px auto 0;display:none}
.ph{display:flex;align-items:flex-start;gap:12px;padding:14px 16px 8px}
.ph .sw{width:14px;height:14px;border-radius:4px;margin-top:6px;flex:none;border:1px solid rgba(0,0,0,.12)}
.ph h2{margin:0;font-family:"Archivo",sans-serif;font-weight:700;font-size:19px;line-height:1.2;color:var(--navy);text-wrap:balance}
.ph .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tag{font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:var(--surface-sunken);color:var(--fg-muted)}
.tag.acc{background:var(--accent-bg);color:var(--accent-text)}
.ph .x{margin-left:auto;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--fg-subtle);flex:none}
.ph .x:hover{background:var(--surface-sunken)}
.pb{padding:0 16px 16px;overflow:auto;font-size:14.5px}
.pb p{margin:6px 0 10px;color:var(--fg-muted);max-width:60ch}
.near h3{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-subtle);margin:12px 0 6px;font-weight:600}
.near ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.near li button{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:8px;text-align:left;border:1px solid var(--border);background:var(--paper)}
.near li button:hover{border-color:var(--accent)}
.near li svg{width:16px;height:16px;flex:none}
.near li .d{margin-left:auto;font-size:12px;color:var(--fg-subtle);font-variant-numeric:tabular-nums}
.pb .foot{margin-top:12px;font-size:12px;color:var(--fg-subtle)}
.pb .foot button{color:var(--accent-text);font-weight:600}
@media (min-width:860px){
  .stage{grid-template-columns:1fr 340px}
  .panel{position:relative;transform:none;border-left:1px solid var(--border);border-top:0;border-right:0;border-bottom:0;box-shadow:none;min-height:0;transition:none}
  .panel:not(.open) .ph,.panel:not(.open) .pb{display:none}
  .panel .welcome{display:none;padding:18px 16px;color:var(--fg-muted);font-size:14px}
  .panel:not(.open) .welcome{display:block}
  .welcome h2{font-family:"Archivo",sans-serif;font-size:17px;color:var(--navy);margin:0 0 6px}
  .welcome p{margin:0 0 10px;max-width:38ch}
  .welcome .kbd{display:inline-block;border:1px solid var(--border-strong);border-bottom-width:2px;border-radius:5px;padding:0 5px;font-size:12px;font-family:ui-monospace,monospace}
}
@media (max-width:859px){
  .panel.doormode{max-height:36%}
  .panel{left:0;right:0;bottom:0;border-radius:16px 16px 0 0;max-height:70%;padding-bottom:env(safe-area-inset-bottom,0px)}
  .panel .grab{display:block;cursor:pointer;touch-action:none;user-select:none}
  .panel.expanded{max-height:92%}
  .panel .welcome{display:none}
  .legend{display:none}
  .bar{gap:8px;padding:8px 12px}
  .brand span{display:none}
  .brand h1{font-size:17px}
  .zoom{bottom:calc(12px + env(safe-area-inset-bottom,0px))}
  .search{flex-basis:100%;max-width:none;margin-left:0;order:3}
}
@media (prefers-reduced-motion:reduce){.panel,.room{transition:none}.pulse.go{animation:none}}
`;

// ---------- Map HTML markup ----------
const MAP_MARKUP = `

<div class="app">
  <header class="bar">
    <div class="brand"><h1>BX Building Map</h1><span>Brainerd Baptist</span></div>
    <div class="seg" role="group" aria-label="Level">
      <button id="lv-lower" aria-pressed="true">Lower Level</button>
      <button id="lv-upper" aria-pressed="false">Upper Level</button>
    </div>
    <button class="doorbtn" id="doorbtn" aria-pressed="false" title="Mark where the room doors are"><svg viewBox="0 0 24 24"><path d="M4 20V5a1 1 0 0 1 1-1h9v16M4 20h16M14 4l5 2v14M11 12h.01"/></svg>Mark doors</button>
    <div class="search">
      <svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <input id="q" type="search" placeholder="Find a room, restroom, stair or exit" autocomplete="off" aria-label="Search the map">
      <button class="clear" id="qclear" aria-label="Clear search">&#x2715;</button>
      <div class="results" id="results" role="listbox"></div>
    </div>
  </header>

  <div class="chips" id="chips"></div>

  <div class="stage">
    <div class="mapwrap" id="mapwrap">
      <svg class="map" id="map" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BX floor plan"></svg>
      <div class="legend" id="legend"></div>
      <div class="hint" id="hint">Tap a room · drag to pan · pinch or scroll to zoom</div>
      <div class="zoom">
        <button id="zin" aria-label="Zoom in">+</button>
        <button id="zout" aria-label="Zoom out">&minus;</button>
        <button id="zfit" aria-label="Fit to screen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div>
    </div>
    <aside class="panel" id="panel" aria-live="polite">
      <div class="grab"></div>
      <div class="welcome">
        <h2>Pick any space</h2>
        <p>Tap a room to highlight it and see what's nearest: restrooms, stairs and exits. Switch levels with the toggle above, or type a name in the search box.</p>
        <p>Both levels are drawn from the architectural plan and oriented the same way, so the Gym (Blue Lot end) is always on the right, CrossView and CrossTies (Green Lot end) are on the left, and Austin St. with the main entrance is at the top.</p>
        <p>Doors are drawn with their swing, as walked and marked by the BX team. Green pills are exterior doors; the lower level has none on the Soccer Field side because it sits below grade there.</p>
        <p>Press <span class="kbd">Esc</span> to clear a selection.</p>
      </div>
      <div class="doorpanel" id="doorpanel">
        <h2>Door marks</h2>
        <p>Tap anywhere on a room's wall and a door marker snaps to the nearest wall. Tap a marker again to remove it. Add a note if the swing or side matters (for example "opens into hall, hinge on north").</p>
        <div class="status" id="door-status">Connecting to saved marks…</div>
        <ol id="door-list"></ol>
        <div class="actions"><button id="door-undo">Undo last</button><button id="door-done">Done marking</button></div>
      </div>
      <div class="ph">
        <span class="sw" id="p-sw"></span>
        <div style="min-width:0">
          <h2 id="p-name"></h2>
          <div class="meta" id="p-meta"></div>
        </div>
        <button class="x" id="p-close" aria-label="Close">&#x2715;</button>
      </div>
      <div class="pb">
        <p id="p-note"></p>
        <div class="near" id="p-near"></div>
        <div class="foot" id="p-foot"></div>
      </div>
    </aside>
  </div>
</div>
`;

/**
 * BX Building Map — /bx-map
 *
 * Full-screen overlay (z-50) so the site header/footer are hidden.
 * CSS tokens are bridged: --surface/--fg/--accent/--navy all resolve
 * to the site's --bx-* layer, so the map follows the site's theme.
 * JS is loaded from /bx-map/map.js via <Script strategy="afterInteractive">.
 * Hash deep-links (e.g. /bx-map#l-crossing) are handled in map.js.
 */
export default function BxMapPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: MAP_CSS }} />
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: MAP_MARKUP }} />
      <Script src="/bx-map/map.js" strategy="afterInteractive" />
    </div>
  );
}
