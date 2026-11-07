// De weergave van de pagina: tekent alles uit D, de gegevens die `dashboardData` berekent.
// Overgenomen van het claude.ai-dashboard (coach/dashboard.html), zodat versie 1 er hetzelfde uitziet.
// Gewoon JavaScript: de typecontrole slaat dit bestand over; de bouwstap kopieert het zoals het is.

let naResize = null;
addEventListener("resize", () => naResize?.());
let leeg = null;

/** Tekent de pagina opnieuw uit D. Geeft de hulpfuncties terug die de invoer nodig heeft. */
export function toon(D) {
  const main = document.getElementById("inhoud");
  if (leeg === null) leeg = main.innerHTML; else main.innerHTML = leeg;
    const $ = (id) => document.getElementById(id);
  const el = (tag, cls, tekst) => { const e = document.createElement(tag); if (cls) e.className = cls; if (tekst != null) e.textContent = tekst; return e; };
  const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const datum = (s) => new Date(s + "T12:00:00");
  const iso = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
  const plusDagen = (s, n) => { const d = datum(s); d.setDate(d.getDate() + n); return iso(d); };
  const kort = (s) => datum(s).toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const VANDAAG = D.momentopname;
  const bewaar = { lees(k) { try { return localStorage.getItem(k); } catch { return null; } }, zet(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  $("tijdstip").textContent = datum(VANDAAG).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
    (D.gemaakt_op ? ", bijgewerkt om " + D.gemaakt_op.slice(11, 16) : "");
  $("stand").textContent = D.indicator.stand;
  $("stand").dataset.stand = D.indicator.stand;
  $("stand").title = D.indicator.uitleg;

  // Meldingen bovenaan: rode waarschuwingen, dan wat je nog moet doorgeven, dan de rest. Niets te melden: geen blok.
  // Rood blijft volledig open; een gewone waarschuwing of een voorstel is één regel die openklapt.
  const kortMelding = (cls, titel, ...uitleg) => {
    const kaart = el("details", cls); kaart.append(el("summary", null, titel));
    for (const [tekst, c] of uitleg) if (tekst) kaart.append(el("p", c, tekst));
    return kaart;
  };
  for (const w of D.waarschuwingen) {
    if (w.ernst === "rood") {
      const kaart = el("div", "waarschuwing");
      kaart.append(el("strong", null, w.wat), el("p", "advies", w.advies));
      $("signalen-rood").append(kaart);
    } else $("signalen").append(kortMelding("waarschuwing", w.titel || w.wat, [w.titel ? w.wat : null], [w.advies, "advies"]));
  }
  for (const v of D.voorstellen) {
    const punt = v.indexOf(". ");
    $("signalen").append(punt < 0 ? Object.assign(el("div", "waarschuwing voorstel"), { textContent: v })
      : kortMelding("waarschuwing voorstel", v.slice(0, punt + 1), [v.slice(punt + 2)]));
  }
  const toonMeldingen = () => {
    for (const id of ["signalen-rood", "signalen"]) $(id).hidden = !$(id).children.length;
    $("meldingen").hidden = ["signalen-rood", "herinnering", "signalen"].every((id) => $(id).hidden);
  };
  toonMeldingen();

  const isHard = (t) => t.hard || t.ramptest || (t.zone || 0) > 2 || (t.belasting || 0) > 90;
  // Eén training: naam, duur, intensiteit, oefeningen en het waarom
  function training(t) {
    const blok = el("div", "training");
    const rij = el("div", "dag-kop");
    rij.append(el("strong", null, t.naam || t.soort), el("span", "klein", t.duur_min + " min"));
    if (t.hartslag_max) rij.append(el("span", "chip", "max " + t.hartslag_max + " bpm"));
    const hard = isHard(t);
    rij.append(el("span", hard ? "chip hard" : "chip", hard ? "harde training" : "rustig"));
    blok.append(rij);
    const g = blokjes(t); if (g) { kleur(g, soortVan(t)); blok.append(g); }
    const lijst = stappenLijst(t); if (lijst) blok.append(lijst);
    if (t.oefeningen && t.oefeningen.length) {
      if (t.rondes) blok.append(el("p", null, `Circuit: ${t.rondes} rondes, elke oefening één keer per ronde.`));
      const lijst = el("ul", "oefeningen");
      for (const o of t.oefeningen) lijst.append(oefening(o));
      blok.append(lijst);
    }
    if (t.uitleg) { const det = el("details"); det.append(el("summary", null, "Waarom"), el("p", null, t.uitleg)); blok.append(det); }
    return blok;
  }
  function oefening(o) {
    const tekst = `${o.naam} · ${o.sets ? o.sets + "×" : ""}${o.herhalingen ?? ""}`;
    const demo = (D.oefeningen || {})[o.code];
    if (!demo) return el("li", null, tekst);
    const li = el("li"), det = el("details"), kop = el("summary");
    kop.append(el("span", null, tekst), el("span", "chip bron-" + demo.bron, demo.bron === "kine" ? "van je kine" : "voorstel van de coach"));
    det.append(kop);
    let blok;
    det.addEventListener("toggle", () => { if (!det.open) return; if (blok) blok.start(); else det.append(blok = toonDemo(demo)); });
    li.append(det);
    return li;
  }

  // Elke oefening uit de oefeningenlijst (data/oefeningen.json) als bewegend figuurtje: zijaanzicht, of vooraanzicht
  // bij de step-down. Elke pose geeft de gewrichten; de animatie beweegt heen en weer tussen begin en eind.
  function tekenPose(svg, demo, pose) {
    svg.replaceChildren();
    const lijn = (punten, cls = "figuur") => svg.append(svgEl("polyline", { points: punten.map((p) => p.join(",")).join(" "), class: cls }));
    svg.append(svgEl("line", { x1: 8, x2: 192, y1: demo.vooraanzicht ? 155 : 150, y2: demo.vooraanzicht ? 155 : 150, class: "vloer" }));
    if (demo.vooraanzicht) {
      svg.append(svgEl("rect", { x: 50, y: 118, width: 54, height: 37, rx: 3, class: "doos" }));
      svg.append(svgEl("line", { x1: 106, x2: 150, y1: 140, y2: 140, class: "grens" }));
      const t = svgEl("text", { x: 152, y: 143, class: "grens-tekst" }); t.textContent = "10 cm"; svg.append(t);
      const heup = [(pose.heupL[0] + pose.heupR[0]) / 2, pose.heupL[1]];
      lijn([pose.nek, heup]); lijn([pose.heupL, pose.heupR]);
      lijn([pose.heupL, pose.knieA, pose.enkelA]); lijn([pose.heupR, pose.knieB, pose.enkelB]);
      lijn([pose.schouderL, pose.schouderR]);
      lijn([pose.schouderL, pose.elleboogL, pose.handL]); lijn([pose.schouderR, pose.elleboogR, pose.handR]);
    } else {
      lijn([pose.heup, pose.knieB, pose.enkelB, pose.teenB]);
      lijn([pose.nek, pose.heup, pose.knieA, pose.enkelA, pose.teenA]);
      lijn([pose.nek, pose.elleboog, pose.hand]);
      if (pose.elleboog2) lijn([pose.nek, pose.elleboog2, pose.hand2]);
      if (demo.elastiek) svg.append(svgEl("line", { x1: pose.knieA[0], y1: pose.knieA[1], x2: pose.knieB[0], y2: pose.knieB[1], class: "elastiek" }));
      if (demo.gewicht) svg.append(svgEl("rect", { x: pose.hand[0] - 9, y: pose.hand[1] - 3, width: 18, height: 7, rx: 2, class: "gewicht" }));
    }
    svg.append(svgEl("circle", { cx: pose.hoofd[0], cy: pose.hoofd[1], r: 9, class: "figuur-hoofd" }));
  }
  const mengPose = (a, b, t) => Object.fromEntries(Object.keys(a).map((k) => [k, [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t]]));
  const RUSTIG = matchMedia("(prefers-reduced-motion: reduce)");

  function toonDemo(demo) {
    const blok = el("div", "demo"), beelden = el("div", "demo-beelden");
    const nieuw = (label) => svgEl("svg", { viewBox: "0 0 200 160", role: "img", "aria-label": label });
    blok.start = () => {};
    if (RUSTIG.matches) {
      const a = nieuw("Beginhouding"), b = nieuw("Eindhouding");
      tekenPose(a, demo, demo.a); tekenPose(b, demo, demo.b); beelden.append(a, b);
    } else {
      const svg = nieuw("Animatie van de oefening, van begin- naar eindhouding en terug");
      beelden.append(svg);
      const periode = 4000, begin = performance.now();
      let loopt = false;
      const stap = (nu) => {
        if (!svg.isConnected || !svg.closest("details").open) { loopt = false; return; }
        const f = ((nu - begin) % periode) / periode;
        // 0-15% begin, 15-50% zakken, 50-60% onderaan, 60-90% omhoog, 90-100% begin
        const t = f < .15 ? 0 : f < .5 ? (f - .15) / .35 : f < .6 ? 1 : f < .9 ? 1 - (f - .6) / .3 : 0;
        tekenPose(svg, demo, mengPose(demo.a, demo.b, (1 - Math.cos(Math.PI * t)) / 2));
        requestAnimationFrame(stap);
      };
      blok.start = () => { if (!loopt) { loopt = true; requestAnimationFrame(stap); } };
      blok.start();
    }
    blok.append(beelden);
    const lijst = el("ul");
    for (const c of demo.cues) lijst.append(el("li", null, c));
    blok.append(lijst);
    const trefwoord = (demo.grens_trefwoord || "").toLowerCase();
    if (trefwoord) for (const g of (D.kine?.grenzen || []).filter((g) => g.toLowerCase().includes(trefwoord))) blok.append(el("p", "kine", "Grens van je kine: " + g));
    if (demo.bron === "coach") blok.append(el("p", "klein", "Dit is een oefening van je coach, niet van je kine. Vraag je kine of ze past."));
    if (!demo.goedgekeurd) blok.append(el("p", "nieuw", "Nieuw figuurtje: zeg je coach of het klopt. Pas daarna komt de oefening in je weekplannen."));
    return blok;
  }
  // Soort training: vaste kleur en icoon (spec dashboard-runna, R4 en R8). Een harde loop krijgt de harde kleur.
  const ICOON = {
    lopen: '<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1M11 15l-1-5"/>',
    mtb: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-8h5l3 8M10 8l2 8H6M14 5h3"/>',
    rollen: '<circle cx="17" cy="13" r="4"/><path d="M17 13l-4-7H8l-2 7h11M8 6l3 7M4 21h16M9 17l-2 4M17 17v4"/>',
    kracht: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
    rust: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  };
  const icoon = (naam) => {
    const svg = svgEl("svg", { viewBox: "0 0 24 24", class: "icoon", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    svg.innerHTML = ICOON[naam]; return svg;
  };
  const SOORT = {
    loopje: { label: "Rustig lopen", kleur: "t-rustig", icoon: "lopen" },
    mtb: { label: "MTB", kleur: "t-mtb", icoon: "mtb" },
    rollen: { label: "Rollen · ERG", kleur: "t-rollen", icoon: "rollen" },
    kracht: { label: "Kracht + kine", kleur: "t-kracht", icoon: "kracht" },
    rust: { label: "Rust", kleur: "t-rust", icoon: "rust" },
  };
  const soortVan = (t) => {
    const s = SOORT[t.soort] || SOORT.loopje;
    return t.soort === "loopje" && isHard(t) ? { ...s, label: "Hard lopen", kleur: "t-hard" } : s;
  };
  const kleur = (e, s) => { e.style.setProperty("--kleur", `var(--${s.kleur})`); return e; };
  const soortChip = (t) => { const s = soortVan(t), c = kleur(el("span", "soort"), s); c.append(icoon(s.icoon), el("span", null, s.label)); return c; };

  // Blokjesgrafiek (R14, R15): per stap een blok; breedte = duur, hoogte = midden van het bereik t.o.v. LTHR of FTP.
  const Z = D.zones || { lthr: 163, loop_z2_max: 145, ftp: 240 };
  const intensiteit = (st) => {
    if (st.hartslag) { const m = (st.hartslag[0] + st.hartslag[1]) / 2; return { pct: m / Z.lthr, hard: m > Z.loop_z2_max }; }
    if (st.wattage) { const m = (st.wattage[0] + st.wattage[1]) / 2; return { pct: m / Z.ftp, hard: m > 0.75 * Z.ftp }; }
    return null;
  };
  const hoogte = (pct) => Math.max(14, Math.min(100, (pct - 0.4) * 170));
  function blokjes(t, mini) {
    const stappen = (t.stappen || []).filter((st) => st.duur_min && intensiteit(st));
    if (!stappen.length) return null;
    const g = el("div", "blokjes" + (mini ? " mini" : ""));
    g.setAttribute("role", "img");
    g.setAttribute("aria-label", "Opbouw van de training: " + stappen.map((st) => `${st.duur_min} min ${st.naam}`).join(", "));
    if (!mini) {
      const lijn = el("span", "z2"); lijn.title = "Grens van zone 2";
      lijn.style.bottom = hoogte(stappen[0].hartslag ? Z.loop_z2_max / Z.lthr : 0.75) + "%"; g.append(lijn);
    }
    for (const st of stappen) {
      const it = intensiteit(st), b = el("i", it.hard ? "hard" : null);
      b.style.flex = st.duur_min; b.style.height = hoogte(it.pct) + "%"; b.title = st.naam;
      g.append(b);
    }
    return g;
  }
  function stappenLijst(t) {
    if (!(t.stappen || []).length) return null;
    const ul = el("ul", "stappen");
    for (const st of t.stappen) {
      const li = el("li"), tekst = el("div", null, st.naam);
      const bereik = st.hartslag ? `hartslag ${st.hartslag[0]}–${st.hartslag[1]}` : st.wattage ? `${st.wattage[0]}–${st.wattage[1]} W` : null;
      if (bereik) { tekst.append(el("br"), el("span", "klein", bereik)); }
      li.append(el("b", null, st.duur_min + "′"), tekst); ul.append(li);
    }
    return ul;
  }

  // Gedaan: een activiteit van die dag van dezelfde soort (loopje, mtb, rollen, kracht)
  const gedaan = (t) => ((D.deze_week || {}).gedaan || []).find((a) => a.datum === t.datum && a.soort === t.soort);
  const kniescore = (dag) => (D.pijn.kniepijn.find((p) => p.datum === dag) || {}).score;

  // Kaart Vandaag (R10): de training van vandaag, of op een rustdag de volgende training
  function vandaagKaarten(plan) {
    const doel = $("vandaag");
    if (!plan) return;
    const vandaag = plan.trainingen.filter((t) => t.datum === VANDAAG);
    const volgende = plan.trainingen.filter((t) => t.datum > VANDAAG).sort((a, b) => a.datum.localeCompare(b.datum));
    const rust = !vandaag.length;
    if (rust && plan.week <= VANDAAG) {
      const k = kleur(el("article", "vandaagkaart"), SOORT.rust), boven = el("div", "boven");
      boven.append(el("h2", null, "Vandaag"), soortChip({ soort: "rust" }));
      k.append(boven, el("h3", null, "Rustdag"), el("p", "klein", "Herstel is ook training: je pees en je spieren worden sterker tussen de trainingen. Wandelen of je kine-oefeningen mag."));
      doel.append(k);
    }
    const toon = rust ? volgende.filter((t) => t.datum === (volgende[0] || {}).datum) : vandaag;
    for (const t of toon) {
      const s = soortVan(t), k = kleur(el("article", "vandaagkaart"), s), boven = el("div", "boven");
      const titel = t.datum === VANDAAG ? "Vandaag" : t.datum === plusDagen(VANDAAG, 1) ? "Morgen" : DAGEN[datum(t.datum).getDay()] + " " + kort(t.datum);
      boven.append(el("h2", null, rust ? "Volgende · " + titel : titel));
      const klaar = gedaan(t);
      if (klaar) {
        const knie = kniescore(t.datum), c = el("span", "soort gedaan", "✓ Gedaan" + (knie != null ? " · knie " + knie : ""));
        boven.append(c);
      } else boven.append(soortChip(t));
      const duur = el("div", "duur"); duur.append(String(t.duur_min), el("small", null, " min"));
      k.append(boven, el("h3", null, t.naam || s.label), duur);
      const g = blokjes(t); if (g) k.append(g);
      const det = el("details"); det.append(el("summary", null, "Stappen en waarom"));
      const lijst = stappenLijst(t); if (lijst) det.append(lijst);
      if (t.oefeningen && t.oefeningen.length) { const ul = el("ul", "oefeningen"); for (const o of t.oefeningen) ul.append(oefening(o)); det.append(ul); }
      if (t.uitleg) det.append(el("p", null, t.uitleg));
      k.append(det);
      doel.append(k);
    }
    doel.hidden = !doel.children.length;
  }

  // Drie grote cijfers (R11): loopvolume gelopen/toegelaten, fietstijd en vorm
  function groteCijfers() {
    const lv = (D.deze_week || {}).loopvolume || {}, nu = D.belasting.length ? D.belasting[D.belasting.length - 1] : {};
    const fiets = D.fietstijd_deze_week || 0, vorm = nu.vorm;
    const over = lv.toegelaten != null && lv.gelopen > lv.toegelaten;
    const vormWoord = vorm == null ? null : vorm > 0 ? ["uitgerust", "ok"] : vorm > -10 ? ["normaal", "ok"] : vorm > -20 ? ["let op", "warn"] : ["goed herstellen", "bad"];
    const cijfer = (waarde, extra, label, duiding, tint) => {
      const c = el("div"), b = el("b", null, waarde); if (extra) b.append(el("small", null, extra));
      c.append(b, el("span", "label", label));
      if (duiding) { const d = el("span", "duiding", duiding); d.style.color = `var(--${tint})`; c.append(d); }
      return c;
    };
    $("groot").append(
      cijfer(String(lv.gelopen ?? 0), lv.toegelaten != null ? "/" + lv.toegelaten : null, "Loopvolume",
        lv.toegelaten == null ? null : over ? `${lv.gelopen - lv.toegelaten} min te veel` : "binnen de grens", over ? "warn" : "ok"),
      cijfer(Math.floor(fiets / 60) + "u" + String(fiets % 60).padStart(2, "0"), null, "Fietstijd", null),
      cijfer(vorm == null ? "—" : String(Math.round(vorm)), null, "Vorm", vormWoord && vormWoord[0], vormWoord && vormWoord[1]));
  }

  // Een dag in het weekschema (R12): datum, icoon, naam, mini-grafiek en duur met een kleurstreep.
  // Een dag met trainingen klapt open voor de stappen, de oefeningen en het waarom.
  function dagkaart(dag, trainingen) {
    const d = datum(dag);
    const extra = dag === VANDAAG ? " vandaag" : dag < VANDAAG ? " voorbij" : "";
    const rij = el(trainingen.length ? "summary" : "div", "dag-rij");
    const dd = el("div", "dag-datum"); dd.append(el("span", null, DAGEN[d.getDay()].slice(0, 2)), el("b", null, String(d.getDate())));
    const naam = el("div", "dag-naam"), duur = el("div", "dag-duur");
    if (!trainingen.length) {
      const regel = el("div", "regel"); regel.append(kleur(icoon("rust"), SOORT.rust), el("span", "rust", "Rustdag"));
      regel.firstChild.style.color = "var(--t-rust)";
      naam.append(regel); duur.textContent = "–";
      rij.append(dd, naam, duur);
      const kaart = kleur(el("div", "dag" + extra), SOORT.rust); kaart.append(rij); return kaart;
    }
    for (const t of trainingen) {
      const s = soortVan(t), regel = el("div", "regel"), ic = icoon(s.icoon);
      ic.style.color = `var(--${s.kleur})`;
      regel.append(ic, el("span", null, t.naam || s.label)); naam.append(regel);
      const g = blokjes(t, true); if (g) { kleur(g, s); naam.append(g); }
    }
    duur.append(trainingen.reduce((som, t) => som + t.duur_min, 0) + "′");
    if (trainingen.some(gedaan)) duur.append(el("small", null, "✓ gedaan"));
    rij.append(dd, naam, duur);
    const kaart = kleur(el("details", "dag" + extra), soortVan(trainingen[0]));
    kaart.append(rij);
    for (const t of trainingen) kaart.append(training(t));
    return kaart;
  }

  // Het weekschema: maandag tot zondag
  const plan = D.weekplan;
  const volgendeWeek = D.week > VANDAAG;
  $("titel").textContent = volgendeWeek ? "Volgende week" : "Deze week";
  $("t-week").textContent = "Week van " + kort(D.week) + (plan && plan.status === "voorstel" ? " (voorstel, nog geen akkoord)" : "");
  if (!plan) {
    $("weekplan").append(el("div", "leeg", "Nog geen weekplan voor deze week. Vraag er een met /weekplan in Claude Code."));
  } else {
    for (let i = 0; i < 7; i++) {
      const dag = plusDagen(plan.week, i);
      $("weekplan").append(dagkaart(dag, plan.trainingen.filter((t) => t.datum === dag)));
    }
    if (plan.uitleg) { const det = el("details"); det.append(el("summary", null, "Waarom deze week zo is"), el("p", null, plan.uitleg)); $("weekplan").append(det); }
  }
  vandaagKaarten(plan);
  groteCijfers();
  if (D.volgende_week) {
    $("weekplan").append(el("p", "klein", `Volgende week (vanaf ${kort(D.volgende_week.week)}): ` + (D.volgende_week.status === "voorstel"
      ? "voorstel klaar, nog geen akkoord. Bekijk het en geef akkoord met /weekplan in Claude Code."
      : "nog geen plan. Vraag er een met /weekplan in Claude Code.")));
  }

  const ftp = D.ftp || {};
  if (ftp.melding) {
    $("ftp-titel").textContent = ftp.melding.titel;
    $("ftp-uitklap").dataset.soort = ftp.melding.soort;
    $("ftp-tekst").textContent = ftp.melding.tekst;
  } else $("ftp-tekst").textContent = "Er is nog geen FTP ingesteld in intervals.icu.";
  if (ftp.eftp_uitleg) { $("ftp-eftp").textContent = ftp.eftp_uitleg; $("ftp-eftp").hidden = false; }


  $("knie-uitleg").textContent = D.pijn.kniepijn_uitleg;
  $("ochtend-uitleg").textContent = D.pijn.ochtendtest;
  $("schaal-uitleg").textContent = D.pijn.uitleg;
  for (const s of D.pijn.schaal) { const r = el("div"); r.append(el("b", null, s.score), el("span", null, s.uitleg)); $("schaal").append(r); }

  // Grafieken. Met band: true krijgt elk punt een eigen strook (voor balken), anders liggen de punten op de randen.
  function grafiek(doel, opts) {
    const breedte = Math.max(280, doel.clientWidth - 16), hoogte = opts.hoogte || 180;
    const m = { l: 30, r: 10, t: 10, b: 24 };
    const svg = svgEl("svg", { viewBox: `0 0 ${breedte} ${hoogte}`, role: "img", "aria-label": opts.label });
    const dagen = opts.dagen, n = dagen.length, binnen = breedte - m.l - m.r;
    const strook = opts.band ? binnen / Math.max(n, 1) : (n < 2 ? 0 : binnen / (n - 1));
    const x = (i) => m.l + (opts.band ? (i + 0.5) * strook : i * strook);
    const y = (v) => hoogte - m.b - ((v - opts.min) / (opts.max - opts.min)) * (hoogte - m.t - m.b);
    for (const v of opts.ticks) {
      svg.append(svgEl("line", { x1: m.l, x2: breedte - m.r, y1: y(v), y2: y(v), stroke: "var(--line)", "stroke-width": 1 }));
      const t = svgEl("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }); t.textContent = v; svg.append(t);
    }
    const labels = Math.max(2, Math.floor(binnen / 70)), stap = Math.max(1, Math.ceil(n / labels));
    dagen.forEach((d, i) => {
      if (i % stap === 0) { const t = svgEl("text", { x: x(i), y: hoogte - 6, "text-anchor": i === 0 && !opts.band ? "start" : "middle" }); t.textContent = kort(d); svg.append(t); }
    });
    opts.teken(svg, x, y, strook);
    doel.replaceChildren(svg);
    const tip = el("div", "tip"); tip.hidden = true; doel.append(tip);
    const toon = (e) => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (breedte / r.width);
      const i = opts.band ? Math.floor((px - m.l) / strook) : Math.round((px - m.l) / (strook || 1));
      if (i < 0 || i >= n) { tip.hidden = true; return; }
      const tekst = opts.tip(dagen[i]); if (!tekst) { tip.hidden = true; return; }
      tip.textContent = tekst; tip.hidden = false;
      const links = Math.min(Math.max(0, (x(i) / breedte) * r.width - tip.offsetWidth / 2), doel.clientWidth - tip.offsetWidth);
      tip.style.left = links + "px"; tip.style.top = "4px";
    };
    svg.addEventListener("pointermove", toon);
    svg.addEventListener("pointerdown", toon);
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") tip.hidden = true; });
  }
  const pad = (punten) => punten.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const vandaagLijn = (svg, x, y, i, max) => svg.append(svgEl("line", { x1: x(i), x2: x(i), y1: y(0), y2: y(max), stroke: "var(--bad)", "stroke-width": 1.5, "stroke-dasharray": "2 3" }));

  function tekenPijn() {
    const doel = $("pijngrafiek");
    const datums = [...new Set([...D.pijn.kniepijn.map((p) => p.datum), ...D.pijn.ochtendpijn.map((p) => p.datum)])].sort();
    if (!datums.length) { doel.replaceChildren(el("p", "klein", "Nog geen pijnscores.")); return; }
    grafiek(doel, {
      dagen: datums, min: 0, max: 10, ticks: [0, 3, 5, 10], label: "Kniepijn en ochtendpijn per dag",
      teken(svg, x, y) {
        svg.append(svgEl("line", { x1: x(0), x2: x(datums.length - 1), y1: y(D.pijn.grens), y2: y(D.pijn.grens), stroke: "var(--bad)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
        const ochtend = D.pijn.ochtendpijn.map((p) => [x(datums.indexOf(p.datum)), y(p.score)]);
        if (ochtend.length > 1) svg.append(svgEl("path", { d: pad(ochtend), fill: "none", stroke: "var(--tweede)", "stroke-width": 2 }));
        for (const p of ochtend) svg.append(svgEl("circle", { cx: p[0], cy: p[1], r: 3, fill: "var(--tweede)" }));
        for (const p of D.pijn.kniepijn) svg.append(svgEl("circle", { cx: x(datums.indexOf(p.datum)), cy: y(p.score), r: 5, fill: p.score > D.pijn.grens ? "var(--bad)" : "var(--accent)" }));
      },
      tip(d) {
        const k = D.pijn.kniepijn.filter((p) => p.datum === d).map((p) => `knie ${p.score} (${p.training})`);
        const o = D.pijn.ochtendpijn.filter((p) => p.datum === d).map((p) => `ochtend ${p.score}`);
        return [kort(d), ...k, ...o].join(" · ");
      },
    });
  }

  const nu = D.belasting.length ? D.belasting[D.belasting.length - 1] : {};
  // Een kort woord bij de vorm, met de grenzen uit de uitleg: tot -10 normaal, rond -20 of lager goed herstellen
  const duidVorm = (v) => v == null ? null : v > 0 ? "uitgerust" : v > -10 ? "normaal" : v > -20 ? "let op" : "goed herstellen";
  for (const [naam, waarde, duiding] of [["Fitheid", nu.fitheid], ["Vermoeidheid", nu.vermoeidheid], ["Vorm", nu.vorm, duidVorm(nu.vorm)], ["Loopvolume", D.toegelaten_loopvolume + " min"],
      ["Fietstijd", D.fietstijd_deze_week != null ? (Math.round(D.fietstijd_deze_week / 6) / 10) + " u" : null]]) {
    const c = el("div", "cijfer"); c.append(el("span", "label", naam), el("b", null, waarde ?? "—"));
    if (duiding) c.append(el("span", "duiding", duiding));
    $("cijfers").append(c);
  }

  function tekenBelasting() {
    const doel = $("belastinggrafiek"), rijen = D.belasting.filter((r) => r.fitheid != null);
    if (!rijen.length) { doel.replaceChildren(el("p", "klein", "Nog geen gegevens over belasting.")); return; }
    const hoogste = Math.max(10, ...rijen.map((r) => Math.max(r.fitheid, r.vermoeidheid || 0, r.belasting || 0)));
    const max = Math.ceil(hoogste / 20) * 20;
    grafiek(doel, {
      dagen: rijen.map((r) => r.datum), min: 0, max, ticks: [0, max / 2, max], label: "Fitheid, vermoeidheid en belasting per dag",
      teken(svg, x, y, strook) {
        const b = Math.max(3, Math.min(8, strook * 0.6));
        rijen.forEach((r, i) => { if (r.belasting) svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(r.belasting), width: b, height: y(0) - y(r.belasting), fill: "var(--line)" })); });
        svg.append(svgEl("path", { d: pad(rijen.map((r, i) => [x(i), y(r.vermoeidheid ?? 0)])), fill: "none", stroke: "var(--tweede)", "stroke-width": 2 }));
        svg.append(svgEl("path", { d: pad(rijen.map((r, i) => [x(i), y(r.fitheid)])), fill: "none", stroke: "var(--accent)", "stroke-width": 2.5 }));
      },
      tip(d) { const r = rijen.find((q) => q.datum === d); return `${kort(d)} · fitheid ${r.fitheid} · vermoeidheid ${r.vermoeidheid} · vorm ${r.vorm} · belasting ${r.belasting}`; },
    });
  }

  // De weg naar de wedstrijd: aftelling, verticale tijdlijn, loopvolume en fitheid
  let tekenVolume = () => {}, tekenFiets = () => {}, tekenFitheid = () => {};
  function bouwProgressie() {
    const doel = $("progressie"), p = D.progressie;
    if (p.leeg) { doel.replaceChildren(el("div", "leeg", p.melding)); return; }
    const sp = p.seizoensplan, a = p.aftelling;
    $("weg-titel").textContent = `De weg naar ${sp.doel.naam} · ${sp.doel.sport === "mtb" ? "MTB · " : ""}${sp.doel.afstand_km ?? "?"} km · ${datum(sp.doel.datum).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}`;
    const cijfers = el("div", "cijfers");
    for (const [naam, waarde] of [["Week", `${Math.max(a.week, 0)} van ${a.weken}`], ["Nog", `${a.dagen} dagen`], ["Fase", p.huidige_fase ? p.huidige_fase.naam : "—"], ["Fitheid", `${p.fitheid.huidig ?? "—"} → ${p.fitheid.streef ?? "—"}`]]) {
      const c = el("div", "cijfer"); c.append(el("span", "label", naam), el("b", null, waarde)); cijfers.append(c);
    }
    doel.append(cijfers);

    const items = [];
    for (const f of sp.fases) items.push({ datum: f.van, volgorde: 1, maak: () => {
      // Alleen de huidige fase toont haar doel; de andere fases zijn één regel die openklapt
      const huidig = p.huidige_fase && p.huidige_fase.naam === f.naam;
      const li = el("li", "fase" + (huidig ? " huidig" : f.tot < VANDAAG ? " voorbij" : ""));
      const kop = el("div", "fase-kop"); kop.append(el("h3", null, f.naam), el("span", "klein", `${kort(f.van)} – ${kort(f.tot)}`));
      const regel = el("span", "klein", `${f.weken} weken · ~${f.richtvolume_min} min lopen` +
        (f.richtvolume_fiets_uur != null ? ` en ~${f.richtvolume_fiets_uur} u fietsen` : "") + " per week");
      if (huidig) { li.append(kop, regel, el("p", null, f.doel)); return li; }
      const uitklap = el("details"), samenvatting = el("summary");
      samenvatting.append(kop, regel); uitklap.append(samenvatting, el("p", null, f.doel)); li.append(uitklap);
      return li;
    } });
    for (const w of sp.wedstrijden || []) items.push({ datum: w.datum, volgorde: 2, maak: () => {
      const li = el("li", "wedstrijd " + w.prioriteit);
      li.append(el("strong", null, `${kort(w.datum)} · ${w.naam} (${w.sport === "mtb" ? "MTB, " : ""}${w.prioriteit}, ${w.afstand_km ?? "?"} km)`), el("span", "klein", w.rol));
      return li;
    } });
    for (const c of p.checkpoints || []) items.push({ datum: c.datum, volgorde: 2, maak: () => {
      const li = el("li", "checkpoint" + (c.afgevinkt ? " klaar" : ""));
      li.append(el("strong", null, `${kort(c.datum)} · kine-checkpoint`), el("span", "klein", c.afgevinkt ? "Afgevinkt." : `Bespreek met je kine of de wedstrijd van ${kort(c.wedstrijd)} haalbaar is.`));
      return li;
    } });
    items.push({ datum: VANDAAG, volgorde: 0, maak: () => el("li", "nu", "Je bent hier · " + kort(VANDAAG)) });
    items.sort((x, y) => x.datum.localeCompare(y.datum) || x.volgorde - y.volgorde);
    const lijn = el("ol", "tijdlijn");
    for (const i of items) lijn.append(i.maak());
    doel.append(lijn);

    const vol = el("div", "grafiek");
    doel.append(el("h3", null, "Loopvolume per week"), vol,
      Object.assign(el("div", "legenda"), { innerHTML: '<span><i style="background:var(--muted)"></i>Richtvolume van de fase</span><span><i style="background:var(--accent-soft);height:8px;border:1px solid var(--accent)"></i>Gepland</span><span><i style="background:var(--accent);height:8px"></i>Gelopen</span>' }));
    const weken = p.loopvolume;
    const hier = weken.findIndex((w) => w.week <= VANDAAG && VANDAAG < plusDagen(w.week, 7));
    tekenVolume = () => {
      const vmax = Math.ceil(Math.max(30, ...weken.map((w) => Math.max(w.gepland || 0, w.werkelijk || 0, w.richtvolume || 0))) / 30) * 30;
      grafiek(vol, {
        band: true, dagen: weken.map((w) => w.week), min: 0, max: vmax, ticks: [0, vmax / 2, vmax], label: "Richtvolume, gepland en gelopen loopvolume per week tot de wedstrijd",
        teken(svg, x, y, strook) {
          const b = Math.max(3, strook * 0.7);
          weken.forEach((w, i) => {
            if (w.gepland != null) svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(w.gepland), width: b, height: y(0) - y(w.gepland), fill: "var(--accent-soft)", stroke: "var(--accent)", "stroke-width": 1 }));
            if (w.werkelijk) svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(w.werkelijk), width: b, height: y(0) - y(w.werkelijk), fill: "var(--accent)" }));
          });
          const trap = [];
          weken.forEach((w, i) => { if (w.richtvolume != null) trap.push([x(i) - strook / 2, y(w.richtvolume)], [x(i) + strook / 2, y(w.richtvolume)]); });
          if (trap.length) svg.append(svgEl("path", { d: pad(trap), fill: "none", stroke: "var(--muted)", "stroke-width": 2 }));
          if (hier >= 0) vandaagLijn(svg, x, y, hier, vmax);
        },
        tip(d) { const w = weken.find((q) => q.week === d); return `week van ${kort(d)} · richtvolume ${w.richtvolume ?? "—"} · gepland ${w.gepland ?? "—"} · gelopen ${w.werkelijk ?? "—"} min`; },
      });
    };

    // Fietstijd per week, in uren: de tweede doelsport naast het loopvolume
    const fiets = el("div", "grafiek");
    doel.append(el("h3", null, "Fietstijd per week"), fiets,
      Object.assign(el("div", "legenda"), { innerHTML: '<span><i style="background:var(--muted)"></i>Richtvolume van de fase</span><span><i style="background:var(--tweede);height:8px"></i>Gefietst (MTB en rollen)</span>' }));
    tekenFiets = () => {
      const uur = (m) => m == null ? null : Math.round(m / 6) / 10;
      const fmax = Math.ceil(Math.max(2, ...weken.map((w) => Math.max(uur(w.fietstijd) || 0, w.richtvolume_fiets_uur || 0))) / 2) * 2;
      grafiek(fiets, {
        band: true, dagen: weken.map((w) => w.week), min: 0, max: fmax, ticks: [0, fmax / 2, fmax], label: "Richtvolume en gefietste uren per week tot de wedstrijd",
        teken(svg, x, y, strook) {
          const b = Math.max(3, strook * 0.7);
          weken.forEach((w, i) => { if (w.fietstijd) svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(uur(w.fietstijd)), width: b, height: y(0) - y(uur(w.fietstijd)), fill: "var(--tweede)" })); });
          const trap = [];
          weken.forEach((w, i) => { if (w.richtvolume_fiets_uur != null) trap.push([x(i) - strook / 2, y(w.richtvolume_fiets_uur)], [x(i) + strook / 2, y(w.richtvolume_fiets_uur)]); });
          if (trap.length) svg.append(svgEl("path", { d: pad(trap), fill: "none", stroke: "var(--muted)", "stroke-width": 2 }));
          if (hier >= 0) vandaagLijn(svg, x, y, hier, fmax);
        },
        tip(d) { const w = weken.find((q) => q.week === d); return `week van ${kort(d)} · richtvolume ${w.richtvolume_fiets_uur ?? "—"} u · gefietst ${uur(w.fietstijd) ?? "—"} u`; },
      });
    };

    const fit = el("div", "grafiek"), fitUitklap = el("details");
    fitUitklap.append(el("summary", null, "Fitheid richting de wedstrijddag"), fit,
      Object.assign(el("div", "legenda"), { innerHTML: '<span><i style="background:var(--accent)"></i>Je fitheid</span><span><i style="background:var(--muted)"></i>Lijn naar je streefwaarde</span>' }),
      el("p", "klein", "De lijn loopt van je fitheid bij de start van het seizoensplan naar de streefwaarde op de wedstrijddag. Ligt je fitheid er ver onder, dan staat de stand op \"achter\". Het is een richtwaarde: de pijnregel gaat altijd voor."));
    doel.append(fitUitklap);
    fitUitklap.addEventListener("toggle", () => { if (fitUitklap.open) tekenFitheid(); });
    const f = p.fitheid;
    tekenFitheid = () => {
      if (!fitUitklap.open) return; // dicht: geen breedte om te tekenen; de grafiek komt bij het openklappen
      if (f.streef == null || f.start.waarde == null) { fit.replaceChildren(el("p", "klein", "Nog geen streefwaarde voor je fitheid.")); return; }
      const geschiedenis = D.belasting.filter((r) => r.fitheid != null);
      const eerste = [geschiedenis.length ? geschiedenis[0].datum : f.start.datum, f.start.datum].sort()[0];
      const dagen = []; for (let d = eerste; d <= f.streefdatum; d = plusDagen(d, 1)) dagen.push(d);
      const index = (d) => dagen.indexOf(d);
      const fmax = Math.ceil(Math.max(f.streef, f.huidig || 0, f.start.waarde, ...geschiedenis.map((r) => r.fitheid)) / 10) * 10 + 10;
      grafiek(fit, {
        dagen, min: 0, max: fmax, ticks: [0, fmax / 2, fmax], label: "Fitheid van de voorbije weken en de lijn naar de streefwaarde op de wedstrijddag",
        teken(svg, x, y) {
          svg.append(svgEl("line", { x1: x(index(f.start.datum)), y1: y(f.start.waarde), x2: x(dagen.length - 1), y2: y(f.streef), stroke: "var(--muted)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
          if (geschiedenis.length > 1) svg.append(svgEl("path", { d: pad(geschiedenis.map((r) => [x(index(r.datum)), y(r.fitheid)])), fill: "none", stroke: "var(--accent)", "stroke-width": 2.5 }));
          if (f.huidig != null) svg.append(svgEl("circle", { cx: x(Math.max(index(VANDAAG), 0)), cy: y(f.huidig), r: 5, fill: "var(--accent)" }));
          svg.append(svgEl("circle", { cx: x(dagen.length - 1), cy: y(f.streef), r: 4, fill: "var(--muted)" }));
        },
        tip(d) {
          const r = geschiedenis.find((q) => q.datum === d);
          if (r) return `${kort(d)} · fitheid ${r.fitheid}`;
          if (d === f.streefdatum) return `streefwaarde ${f.streef} op ${kort(d)}`;
          return d > VANDAAG ? `${kort(d)} · nu ${f.huidig ?? "—"}, verwacht vandaag ${f.verwacht ?? "—"}, streef ${f.streef}` : null;
        },
      });
    };
  }
  bouwProgressie();

  // Tabs: de grafieken worden getekend als hun tab zichtbaar is, zodat ze de juiste breedte hebben
  const TABS = { pijn: [tekenPijn], belasting: [tekenBelasting], weg: [() => tekenVolume(), () => tekenFiets(), () => tekenFitheid()] };
  let open = TABS[bewaar.lees("mycoach-tab")] ? bewaar.lees("mycoach-tab") : "pijn";
  function kies(naam) {
    open = naam; bewaar.zet("mycoach-tab", naam);
    for (const t of Object.keys(TABS)) {
      $("tab-" + t).setAttribute("aria-selected", String(t === naam));
      $("tab-" + t).tabIndex = t === naam ? 0 : -1;
      $("p-" + t).hidden = t !== naam;
    }
    for (const teken of TABS[naam]) teken();
  }
  for (const t of Object.keys(TABS)) $("tab-" + t).onclick = () => kies(t);
  $("tab-pijn").parentElement.addEventListener("keydown", (e) => {
    const namen = Object.keys(TABS), i = namen.indexOf(open);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = namen[(i + (e.key === "ArrowRight" ? 1 : namen.length - 1)) % namen.length]; kies(n); $("tab-" + n).focus(); }
  });
  kies(open);
  let wacht, vorigeBreedte = innerWidth;
  naResize = () => { if (innerWidth === vorigeBreedte) return; vorigeBreedte = innerWidth; clearTimeout(wacht); wacht = setTimeout(() => kies(open), 150); };

  return { kies, toonMeldingen, kort, iso, plusDagen, el, $ };
}
