// De weergave van de pagina: tekent de vier schermen (Vandaag, Plan, Logboek, Voortgang) en de details uit D, de
// gegevens die `paginaData` berekent (paginadata.ts). Wat de pagina beslist (dagoordeel, check-ins, gepland tegenover
// gedaan, 80/20, weekstatus) staat al in D: hier wordt alleen getekend.
// Gewoon JavaScript: de typecontrole slaat dit bestand over; de bouwstap kopieert het zoals het is.

// naar de bron verwezen: de bouwstap maakt er ../datum.js van
import { maandag, plusDagen } from "../datum.js";
import { planNakijken as moetNakijken } from "../paginadata.js";

// --- Routes: #vandaag, #plan, #plan/<datum>/<n>, #logboek, #logboek/<id>, #voortgang -------------------------

export const TABS = [
  { naam: "vandaag", label: "Vandaag", icoon: "zon" },
  { naam: "plan", label: "Plan", icoon: "kalender" },
  { naam: "logboek", label: "Logboek", icoon: "lijst" },
  { naam: "voortgang", label: "Voortgang", icoon: "lijn" },
];
const TABNAMEN = TABS.map((t) => t.naam);
const BEWAARDE_TAB = "mycoach-tab";

const bewaar = {
  lees(k) { try { return localStorage.getItem(k); } catch { return null; } },
  zet(k, v) { try { localStorage.setItem(k, v); } catch { /* geen opslag: dan niet */ } },
  sessie(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } },
};

/** De route uit de hash. Zonder hash: de bewaarde tab (een oude tab zoals pijn of belasting wordt Vandaag). */
export function route() {
  const delen = decodeURIComponent(location.hash.slice(1)).split("/").filter(Boolean);
  let tab = delen[0];
  if (!TABNAMEN.includes(tab)) {
    const bewaard = bewaar.lees(BEWAARDE_TAB);
    tab = TABNAMEN.includes(bewaard) ? bewaard : "vandaag";
    return { tab, sleutel: tab };
  }
  if (tab === "plan" && delen.length === 3) return { tab, datum: delen[1], index: Number(delen[2]), sleutel: delen.join("/") };
  if (tab === "logboek" && delen.length >= 2) return { tab, id: delen.slice(1).join("/"), sleutel: delen.join("/") };
  return { tab, sleutel: tab };
}

const naarTraining = (datum, index) => `#plan/${datum}/${index}`;
const naarActiviteit = (id) => `#logboek/${encodeURIComponent(String(id))}`;

// --- Hulpjes ---------------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const el = (tag, cls, tekst) => { const e = document.createElement(tag); if (cls) e.className = cls; if (tekst != null) e.textContent = tekst; return e; };
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const datum = (s) => new Date(s + "T12:00:00");
const kort = (s) => datum(s).toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
const lang = (s) => datum(s).toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
const uurMin = (m) => `${Math.floor(m / 60)}u${String(Math.round(m % 60)).padStart(2, "0")}`;
const getal = (x) => x == null ? "—" : String(x).replace(".", ",");
const BREED = matchMedia("(min-width: 1024px)");
const RUSTIG = matchMedia("(prefers-reduced-motion: reduce)");

const ICOON = {
  lopen: '<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1M11 15l-1-5"/>',
  mtb: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-8h5l3 8M10 8l2 8H6M14 5h3"/>',
  rollen: '<circle cx="17" cy="13" r="4"/><path d="M17 13l-4-7H8l-2 7h11M8 6l3 7M4 21h16M9 17l-2 4M17 17v4"/>',
  kracht: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  rust: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  wandel: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-7 3 3v4M9 11l2-3 3 1 2 3M12 14l-1-5M7 21l2-5"/>',
  wedstrijd: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  zon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  kalender: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  lijst: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  lijn: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  vink: '<path d="M5 12l5 5L20 7"/>',
  driehoek: '<path d="M12 4l9 16H3z"/>',
};
function icoon(naam, cls = "icoon") {
  const svg = svgEl("svg", { viewBox: "0 0 24 24", class: cls, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  svg.innerHTML = ICOON[naam];
  return svg;
}

/** De vier eigen iconen van het dagoordeel: vorm en woord dragen de betekenis, niet alleen de kleur. */
const OORDEEL_ICOON = {
  "in orde": '<circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.5 3.5L17 9"/>',
  "let op": '<path d="M12 2.5l10 18H2z"/><path d="M12 9.5v5M12 17.5v.5"/>',
  "overbelast": '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z"/><path d="M8 12h8"/>',
  "nog niet compleet": '<circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.5"/>',
};
function oordeelIcoon(stand) {
  const svg = svgEl("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  svg.innerHTML = OORDEEL_ICOON[stand] || OORDEEL_ICOON["nog niet compleet"];
  return svg;
}

const SOORT = {
  loopje: { label: "Rustig lopen", kleur: "t-rustig", icoon: "lopen" },
  hard: { label: "Hard lopen", kleur: "t-hard", icoon: "lopen" },
  mtb: { label: "MTB", kleur: "t-mtb", icoon: "mtb" },
  rollen: { label: "Rollen · ERG", kleur: "t-rollen", icoon: "rollen" },
  kracht: { label: "Kracht + kine", kleur: "t-kracht", icoon: "kracht" },
  rust: { label: "Rust", kleur: "t-rust", icoon: "rust" },
  ander: { label: "Andere training", kleur: "t-rust", icoon: "wandel" },
};

// --- De weergave zelf ----------------------------------------------------------------------------------------

let staat = { D: null, acties: null, kop: null, vorigeStand: null, sleutel: null, diepte: 0 };
let tekenGrafieken = [];

/** Tekent de pagina uit D. `acties` doet de invoer (app.ts); `kop` zegt hoe het met de verbinding gaat. */
export function toon(D, acties, kop) {
  const herladen = staat.D !== null;
  staat = { ...staat, D, acties, kop };
  bouwNavigatie();
  bouwKop();
  teken({ behoudScroll: herladen });
}

function teken({ behoudScroll = false, wissel = false } = {}) {
  const { D } = staat;
  const r = route();
  const scroll = scrollY;
  bewaar.zet(BEWAARDE_TAB, r.tab);
  tekenGrafieken = [];
  const bouwers = { vandaag: schermVandaag, plan: schermPlan, logboek: schermLogboek, voortgang: schermVoortgang };
  for (const t of TABNAMEN) {
    const scherm = $("s-" + t);
    scherm.hidden = t !== r.tab;
    scherm.classList.remove("wissel");
    if (t !== r.tab) { scherm.replaceChildren(); continue; }
    scherm.replaceChildren(...bouwers[t](D, r));
    if (wissel && !RUSTIG.matches) { void scherm.offsetWidth; scherm.classList.add("wissel"); }
  }
  $("kolom").classList.toggle("breed", r.tab === "plan" || r.tab === "logboek");
  for (const a of document.querySelectorAll(".nav a.tab")) {
    if (a.dataset.tab === r.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  for (const f of tekenGrafieken) f();
  if (behoudScroll) scrollTo(0, scroll);
  else scrollTo(0, Number(bewaar.sessie("mycoach-scroll-" + r.sleutel)) || 0);
  staat.sleutel = r.sleutel;
  staat.vorigeStand = D.dagoordeel.stand;
}

function bouwNavigatie() {
  const ul = $("tabs");
  if (!ul.children.length) {
    for (const t of TABS) {
      const li = el("li"), a = el("a", "tab");
      a.href = "#" + t.naam; a.id = "tab-" + t.naam; a.dataset.tab = t.naam;
      a.append(icoon(t.icoon), el("span", null, t.label));
      // nog eens tikken op de actieve tab: naar boven
      a.addEventListener("click", (e) => {
        const r = route();
        if (r.tab === t.naam && r.sleutel === t.naam) { e.preventDefault(); scrollTo({ top: 0, behavior: RUSTIG.matches ? "auto" : "smooth" }); }
      });
      li.append(a);
      if (t.naam === "vandaag") { const chip = el("span", "chip-oordeel pil"); chip.id = "chip-oordeel"; li.append(chip); }
      ul.append(li);
    }
  }
  const o = staat.D.dagoordeel, chip = $("chip-oordeel");
  chip.replaceChildren(oordeelIcoon(o.stand), el("span", null, o.stand));
  chip.className = "chip-oordeel pil " + ({ "in orde": "ok", "let op": "warn", "overbelast": "bad" }[o.stand] || "neutraal");
}

function bouwKop() {
  const { D, kop } = staat;
  const tijd = D.gemaakt_op ? D.gemaakt_op.slice(11, 16) : "";
  const oud = D.momentopname !== kop.vandaag ? ` op ${kort(D.momentopname)}` : "";
  const wacht = kop.wacht ? ` · ${kop.wacht} ${kop.wacht > 1 ? "scores wachten" : "score wacht"}` : "";
  $("tijdstip").textContent = `Gegevens van ${tijd}${oud}${wacht}`;
  $("offline").hidden = !kop.offline && !kop.melding;
  $("offline").textContent = kop.offline ? `Offline · gegevens van ${tijd}${oud}${wacht}` : kop.melding || "";
}

addEventListener("hashchange", () => {
  if (!staat.D) return;
  if (staat.sleutel) bewaar.sessie("mycoach-scroll-" + staat.sleutel, String(scrollY));
  // "‹ terug" gaat alleen terug in de geschiedenis als er in deze sessie al genavigeerd werd naar een detail
  staat.diepte = route().sleutel.includes("/") ? staat.diepte + 1 : 0;
  const vorigeTab = staat.sleutel?.split("/")[0];
  teken({ wissel: vorigeTab !== route().tab });
  $("s-" + route().tab).focus({ preventScroll: true });
});
addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  const i = ["1", "2", "3", "4"].indexOf(e.key);
  if (i < 0) return;
  e.preventDefault();
  location.hash = "#" + TABNAMEN[i];
});
let scrollWacht;
addEventListener("scroll", () => {
  clearTimeout(scrollWacht);
  scrollWacht = setTimeout(() => { if (staat.sleutel) bewaar.sessie("mycoach-scroll-" + staat.sleutel, String(scrollY)); }, 150);
}, { passive: true });
let breedte = innerWidth, resizeWacht;
addEventListener("resize", () => {
  if (innerWidth === breedte || !staat.D) return;
  breedte = innerWidth;
  clearTimeout(resizeWacht);
  resizeWacht = setTimeout(() => teken({ behoudScroll: true }), 150);
});

function terugKnop(naar) {
  const knop = el("button", "link terug", "‹ terug");
  knop.onclick = () => { if (staat.diepte > 0) history.back(); else location.replace(naar); };
  return knop;
}

// --- Bouwstenen ------------------------------------------------------------------------------------------

// of een training hard is, staat in D (`hard`, berekend in paginadata.ts): hier alleen de kleur en het icoon
function soortVan(t) {
  if (!t.soort) return SOORT.ander;
  if (t.soort === "loopje" && t.hard) return SOORT.hard;
  return SOORT[t.soort] || SOORT.ander;
}
const kleur = (e, s) => { e.style.setProperty("--kleur", `var(--${s.kleur})`); return e; };

/** Blokjesgrafiek: per stap een blok; breedte = duur, hoogte = midden van het bereik t.o.v. LTHR of FTP. */
function blokjes(t, groot) {
  const Z = staat.D.zones;
  const intensiteit = (st) => {
    if (st.hartslag) { const m = (st.hartslag[0] + st.hartslag[1]) / 2; return { pct: m / Z.lthr, hard: m > Z.loop_z2_max }; }
    if (st.wattage && Z.ftp) { const m = (st.wattage[0] + st.wattage[1]) / 2; return { pct: m / Z.ftp, hard: m > Z.fiets_z2_pct / 100 * Z.ftp }; }
    return null;
  };
  const hoogte = (pct) => Math.max(14, Math.min(100, (pct - 0.4) * 170));
  const stappen = (t.stappen || []).filter((st) => st.duur_min && intensiteit(st));
  if (!stappen.length) return null;
  const g = kleur(el("div", "blokjes" + (groot ? " groot" : "")), soortVan(t));
  g.setAttribute("role", "img");
  g.setAttribute("aria-label", "Opbouw van de training: " + stappen.map((st) => `${st.duur_min} min ${st.naam}`).join(", "));
  const lijn = el("span", "z2"); lijn.title = "Grens van zone 2";
  lijn.style.bottom = hoogte(stappen[0].hartslag ? Z.loop_z2_max / Z.lthr : Z.fiets_z2_pct / 100) + "%"; g.append(lijn);
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
    const bereik = st.hartslag ? `hartslag ${st.hartslag[0]}–${st.hartslag[1]}` : st.wattage ? `${st.wattage[0]}–${st.wattage[1]} W (ERG)` : null;
    if (bereik) tekst.append(el("br"), el("span", "klein", bereik));
    li.append(el("b", null, st.duur_min + " min"), tekst);
    ul.append(li);
  }
  return ul;
}

/** Rustig lopen: groot de bovengrens van zone 2. */
function rustigeGrens(t) {
  if (t.soort !== "loopje" || t.hard) return null;
  return el("p", "max", `max ${t.hartslag_max ?? staat.D.zones.loop_z2_max} bpm, wandel als je erboven gaat`);
}

function pil(tekst, soort, ic) {
  const p = el("span", "pil " + (soort || ""));
  if (ic) p.append(icoon(ic, "pil-icoon"));
  p.append(tekst);
  return p;
}

/** Het chipje van gepland tegenover gedaan, met een eigen vorm: ✓ volgens plan, ▲ te hard of te lang, neutraal niet gepland. */
function oordeelChip(a) {
  if (a.koppeling === "niet gepland") return pil("niet gepland", "neutraal");
  if (!a.oordeel) return null;
  if (a.oordeel.soort === "volgens plan") return pil("volgens plan", "ok", "vink");
  return pil(`${a.oordeel.soort} · ${a.oordeel.chip}`, "warn", "driehoek");
}

/** De scores 0-10 in twee rijen, met "geen" en "ergst" aan de uiteinden; boven de grens in rood. */
function scores(huidig, opTik, label) {
  const grens = staat.D.pijn.grens;
  const blok = el("div", "scores");
  blok.setAttribute("role", "group");
  blok.setAttribute("aria-label", label);
  for (const [van, tot, cls] of [[0, 5, "scorerij"], [6, 10, "scorerij tweede"]]) {
    const rij = el("div", cls);
    for (let i = van; i <= tot; i++) {
      const k = el("button", i > grens ? "boven" : null, String(i));
      k.type = "button";
      k.setAttribute("aria-pressed", String(i === huidig));
      k.setAttribute("aria-label", `${i}${i === 0 ? ", geen pijn" : i === 10 ? ", ergste pijn" : ""}${i > grens ? ", boven de grens" : ""}`);
      k.onclick = () => { if (i !== huidig) opTik(i, k); };
      rij.append(k);
    }
    blok.append(rij);
  }
  const einden = el("div", "einden"); einden.append(el("span", null, "0 = geen"), el("span", null, "10 = ergst"));
  blok.append(einden);
  return blok;
}

function pijnschaalUitleg() {
  const det = el("details"), D = staat.D;
  det.append(el("summary", null, "hoe?"));
  const binnen = el("div", "uitleg-tekst klein");
  binnen.append(el("p", null, D.pijn.ochtendtest), el("p", null, D.pijn.uitleg));
  const lijst = el("ul");
  for (const s of D.pijn.schaal) lijst.append(el("li", null, `${s.score}: ${s.uitleg}`));
  binnen.append(lijst);
  det.append(binnen);
  return det;
}

/** Een score ingeven: de kaart krimpt weg, daarna bewaart app.ts (met een paar seconden om ongedaan te maken). */
function geefIn(kaart, invoer, omschrijving, notitie) {
  const doe = () => staat.acties.geefIn(invoer, omschrijving, notitie);
  if (!kaart || RUSTIG.matches) return doe();
  kaart.classList.add("krimp");
  setTimeout(doe, 200);
}

/** Na een score achteraf: verandert ze een week waarvoor al een plan is, dan moet de coach het nakijken. */
function planNakijken(dag) {
  return moetNakijken(staat.D, dag) ? "Laat de coach het plan nakijken." : null;
}

// --- Vandaag ---------------------------------------------------------------------------------------------

function schermVandaag(D) {
  const uit = [dagoordeelKaart(D)];
  const v = D.vandaag, getoond = new Set();
  if (D.checkins.ochtend.open && D.dagoordeel.stand !== "nog niet compleet") uit.push(ochtendCheckin(D));
  if (D.weekstatus.looppauze) uit.push(el("div", "kaart", looppauzeZin(D.weekstatus.looppauze, D.momentopname)));
  if (v.wedstrijd) {
    const k = kleur(el("div", "kaart streep"), SOORT.rust);
    const kop = el("div", "rij-kop"); kop.append(icoon("wedstrijd"), el("strong", null, "Wedstrijddag"));
    k.append(kop, el("h3", null, v.wedstrijd.naam || "Wedstrijd"),
      el("p", "klein", [v.wedstrijd.sport === "mtb" ? "MTB" : "lopen", v.wedstrijd.afstand_km ? `${getal(v.wedstrijd.afstand_km)} km` : null,
        `${v.wedstrijd.prioriteit}-wedstrijd`].filter(Boolean).join(" · ")));
    uit.push(k);
  } else if (!v.weekplan) {
    uit.push(el("div", "leeg", "Nog geen weekplan. Vraag het met /weekplan in Claude Code."));
  } else if (v.rustdag) {
    const k = kleur(el("div", "kaart streep"), SOORT.rust);
    const kop = el("div", "rij-kop"); kop.append(icoon("rust"), el("strong", null, "Rustdag"));
    k.append(kop, el("p", null, "Rustdag: wandelen of je kine-oefeningen mag. Herstel is ook training: je pees wordt sterker tussen de trainingen."));
    if (v.volgende) k.append(el("p", "klein", `Volgende training: ${v.volgende.naam || soortVan(v.volgende).label}, ${DAGEN[datum(v.volgende.datum).getDay()]} ${kort(v.volgende.datum)}.`));
    uit.push(k);
  }
  for (const t of v.trainingen) {
    const kaart = trainingKaart(t, D);
    if (t.uitkomst?.activiteit != null) getoond.add(String(t.uitkomst.activiteit));
    uit.push(kaart);
  }
  for (const k of D.checkins.knie) if (!getoond.has(String(k.activiteit))) uit.push(knieCheckin(k));
  const morgen = v.morgen;
  if (v.weekplan || morgen.length) {
    uit.push(el("p", "morgen", "Morgen: " + (morgen.length ? morgen.map((t) => `${t.naam || soortVan(t).label} · ${t.duur_min} min`).join(", ") : "rustdag")));
  }
  return uit;
}

function dagoordeelKaart(D) {
  const o = D.dagoordeel;
  const kaart = el("section", "kaart oordeel");
  kaart.dataset.stand = o.stand;
  kaart.setAttribute("aria-label", "Dagoordeel");
  if (staat.vorigeStand === "nog niet compleet" && o.stand !== "nog niet compleet") kaart.classList.add("nieuw");
  const woord = el("div", "woord"); woord.append(oordeelIcoon(o.stand), el("span", null, o.stand));
  kaart.append(woord);
  // zolang het nog niet compleet is, is het dagoordeel de ochtend-check-in zelf
  if (o.stand === "nog niet compleet" && D.checkins.ochtend.open) {
    kaart.append(el("p", "zin", "Hoeveel pijn deed je knie bij de ochtendtest?"),
      el("p", "klein", "Het ergste moment van de ochtendtest (5 keer langzaam tot stoelhoogte), niet de stijfheid bij het opstaan."),
      pijnschaalUitleg(),
      scores(null, (i) => geefIn(null, { soort: "ochtend", datum: D.momentopname, waarde: i }, `Ochtendpijn ${i}`), "Ochtendpijn van 0 tot 10"));
    return kaart;
  }
  kaart.append(el("p", "zin", o.zin));
  if (o.advies) kaart.append(el("p", "advies", o.advies));
  if (o.ochtendtest_te_doen && o.stand !== "in orde") kaart.append(el("p", "klein", "Ochtendtest nog te doen."));
  if (D.checkins.ochtend.wacht) kaart.append(el("p", "wacht", `Ochtendpijn ${D.checkins.ochtend.score} · wacht op verbinding`));
  if (o.lichter.length) {
    const ul = el("ul", "lichter");
    for (const l of o.lichter) {
      const li = el("li");
      li.append(el("b", null, `${l.training}${l.datum !== D.momentopname ? ` (${DAGEN[datum(l.datum).getDay()]})` : ""}: `), l.tekst);
      ul.append(li);
    }
    kaart.append(ul);
  }
  if (o.volgende_stap) kaart.append(el("p", "volgende-stap", o.volgende_stap));
  if (o.noot) kaart.append(el("p", "klein", o.noot));
  if (o.signalen.length) {
    const det = el("details");
    det.append(el("summary", null, o.signalen.length > 1 ? `Alle ${o.signalen.length} waarschuwingen` : "Uitleg"));
    const ul = el("ul", "signalen");
    for (const s of o.signalen) {
      const li = el("li"); li.append(el("b", null, s.titel), el("p", null, s.wat), el("p", "klein", s.advies)); ul.append(li);
    }
    det.append(ul);
    kaart.append(det);
  }
  for (const v of D.voorstellen) kaart.append(el("p", "klein", v));
  return kaart;
}

function ochtendCheckin(D) {
  const kaart = el("section", "kaart checkin");
  kaart.setAttribute("aria-label", "Ochtendpijn");
  kaart.append(el("strong", null, "Ochtendpijn"),
    el("p", "klein", "Het ergste moment van de ochtendtest, niet de stijfheid bij het opstaan."), pijnschaalUitleg(),
    scores(null, (i) => geefIn(kaart, { soort: "ochtend", datum: D.momentopname, waarde: i }, `Ochtendpijn ${i}`), "Ochtendpijn van 0 tot 10"));
  return kaart;
}

function knieCheckin(k) {
  const kaart = kleur(el("section", "kaart checkin streep"), soortVan(k));
  kaart.setAttribute("aria-label", "Kniepijn");
  const kop = el("div", "rij-kop"); kop.append(icoon(soortVan(k).icoon), el("strong", null, `Knie na ${k.naam || soortVan(k).label}`));
  kaart.append(kop, el("p", "klein", `${k.wanneer}, ${k.minuten} min · de hoogste pijn tijdens de training, geen stijfheid achteraf`));
  if (k.wacht) kaart.append(el("p", "wacht", `Kniepijn ${k.score} · wacht op verbinding`));
  else kaart.append(scores(null, (i) => geefIn(kaart, { soort: "knie", activiteit: k.activiteit, naam: k.naam, datum: k.datum, waarde: i },
    `Kniepijn ${i}`), "Kniepijn van 0 tot 10"));
  return kaart;
}

function trainingKaart(t, D) {
  const s = soortVan(t), u = t.uitkomst;
  const gedaan = u && (u.status === "gedaan" || u.status === "verschoven");
  const kaart = kleur(el(gedaan ? "div" : "a", "kaart streep"), s);
  if (!gedaan) kaart.href = naarTraining(t.datum, t.index);
  const kop = el("div", "rij-kop"); kop.append(icoon(s.icoon), el("span", "label", s.label));
  if (gedaan) kop.append(pil("gedaan", "ok", "vink"));
  kaart.append(kop, el("h3", null, t.naam || s.label));
  const duur = el("div", "duur"); duur.append(String(t.duur_min), el("small", null, " min"));
  kaart.append(duur);
  const g = blokjes(t); if (g) kaart.append(g);
  const grens = rustigeGrens(t); if (grens) kaart.append(grens);
  if (gedaan) {
    const a = D.logboek.find((x) => String(x.id) === String(u.activiteit));
    if (u.oordeel) {
      const regel = el("p", null, u.oordeel.soort === "volgens plan" ? "Volgens plan." : u.oordeel.regel);
      const chip = a && oordeelChip(a); if (chip && u.oordeel.soort !== "volgens plan") regel.prepend(chip, " ");
      kaart.append(regel);
    }
    const links = el("p", "invoer-rij");
    const opbouw = el("a", "link", "Opbouw"); opbouw.href = naarTraining(t.datum, t.index);
    links.append(opbouw);
    if (a) { const act = el("a", "link", "Activiteit"); act.href = naarActiviteit(a.id); links.append(act); }
    kaart.append(links);
    const k = D.checkins.knie.find((x) => String(x.activiteit) === String(u.activiteit));
    if (k) kaart.append(k.wacht ? el("p", "wacht", `Kniepijn ${k.score} · wacht op verbinding`) : el("strong", null, "Knie tijdens deze training?"),
      ...(k.wacht ? [] : [scores(null, (i) => geefIn(null, { soort: "knie", activiteit: k.activiteit, naam: k.naam, datum: k.datum, waarde: i }, `Kniepijn ${i}`), "Kniepijn van 0 tot 10")]));
  } else if (D.dagoordeel.stand === "overbelast") {
    kaart.classList.add("gedimd");
    kaart.append(el("p", "gedimd-tekst", "Volgens het dagoordeel: niet zo doen."));
  }
  return kaart;
}

// --- Plan ------------------------------------------------------------------------------------------------

function schermPlan(D, r) {
  const meester = el("div", "meester"), lijst = el("div", "scherm"), detail = el("div", "meester-detail scherm");
  lijst.style.paddingTop = "0";
  lijst.append(weekstatusKaart(D), ...weekLijst(D, D.plan.deze_week, "Deze week"), ...volgendeWeek(D), ...seizoensplan(D));
  if (r.datum) {
    meester.classList.add("met-detail");
    const t = [D.plan.deze_week, D.plan.volgende_week].flatMap((w) => w.trainingen)
      .find((x) => x.datum === r.datum && x.index === r.index);
    detail.append(...(t ? trainingDetail(t, D) : [terugKnop("#plan"), el("div", "leeg", "Deze training staat niet in deze of volgende week.")]));
  } else {
    detail.classList.add("leeg-detail");
    detail.append(el("div", "leeg", "Tik een training voor de opbouw en het waarom."));
  }
  meester.append(lijst, detail);
  return [meester];
}

const WEEKTYPE = { start: "Startweek", opbouw: "Opbouw", licht: "Lichte week", stap_terug: "Stap terug", geen_groei: "Geen groei (een kniescore ontbrak)",
  looppauze: "Looppauze van de kine", na_pauze: "Eerste week na de looppauze (geen groei)" };

/** De looppauze van de kine, in één zin: een voorzorg, geen overbelasting. */
function looppauzeZin(p, vandaag) {
  const voorbij = p.verwacht_tot < vandaag;
  return `Looppauze van de kine${p.reden ? ` (${p.reden})` : ""}, ` +
    (voorbij ? `verwacht tot ${kort(p.verwacht_tot)}: vraag de kine of je weer mag lopen.` : `verwacht tot ${kort(p.verwacht_tot)}.`) +
    " Niet lopen; fietsen en de oefeningen mogen.";
}

function weekstatusKaart(D) {
  const w = D.weekstatus, c = w.cijfers;
  const kaart = el("section", "kaart");
  kaart.setAttribute("aria-label", "Weekstatus");
  kaart.append(el("h2", null, `Weekstatus · week van ${kort(w.week)}`));
  const cijfers = el("div", "cijfers");
  const cijfer = (waarde, extra, label) => { const d = el("div"), b = el("b", null, waarde); if (extra) b.append(el("small", null, extra)); d.append(b, el("span", null, label)); return d; };
  cijfers.append(
    cijfer(String(c.loopvolume.gelopen), c.loopvolume.toegelaten != null ? "/" + c.loopvolume.toegelaten : null, "loopminuten"),
    cijfer(uurMin(c.fietstijd_min), null, "fietstijd"),
    cijfer(c.vorm == null ? "—" : String(Math.round(c.vorm)), null, "vorm" + (c.vormzone ? ` · ${c.vormzone}` : "")));
  kaart.append(cijfers);
  const ul = el("ul", "status-lijst");
  const regel = (...delen) => { const li = el("li"); li.append(...delen); ul.append(li); };
  const pr = w.pijnregel;
  if (pr.status === "in orde") regel(el("span", null, "Pijnregel:"), pil("in orde", "ok", "vink"));
  else if (pr.status === "niet in orde") regel(el("span", null, "Pijnregel:"), pil("niet in orde", "bad", "driehoek"), el("span", "klein", pr.redenen.join("; ")));
  else regel(el("span", null, "Pijnregel:"), pil("onvolledig", "warn", "driehoek"), el("span", "klein", "een loopje zonder kniescore telt niet als in orde"));
  if (w.looppauze) regel(pil("looppauze", "warn", "driehoek"), el("span", null, looppauzeZin(w.looppauze, D.momentopname)));
  regel(el("span", null, w.weken_in_orde === 1 ? "1 week na elkaar in orde" : `${w.weken_in_orde} weken na elkaar in orde`));
  if (w.weektype) {
    const lv = w.loopvolume;
    regel(el("span", null, `${WEEKTYPE[w.weektype] || w.weektype}: ${lv.toegelaten} loopminuten toegelaten, nog ${lv.over} over`));
  }
  regel(el("span", null, `Harde trainingen: ${w.harde_trainingen.gedaan} van ${w.harde_trainingen.toegelaten}`));
  if (w.ontbrekende_kniescores.length) {
    const li = el("li"); li.append(el("span", null, "Kniescore ontbreekt:"));
    for (const a of w.ontbrekende_kniescores) { const l = el("a", "link", `${lang(a.datum)} · ${a.naam || soortVan(a).label}`); l.href = naarActiviteit(a.id); li.append(l); }
    ul.append(li);
  }
  kaart.append(ul);
  return kaart;
}

const STATUS = {
  gedaan: ["gedaan", "ok", "vink"], verschoven: ["verschoven", "neutraal"], overgeslagen: ["overgeslagen", "neutraal"], "te doen": null,
};

function weekLijst(D, week, titel) {
  const uit = [el("h2", null, `${titel} · ${kort(week.week)} – ${kort(plusDagen(week.week, 6))}`)];
  if (!week.akkoord) {
    uit.push(el("div", "leeg", week.status === "voorstel" ? "Er is een voorstel, nog zonder akkoord. Bekijk het en geef akkoord met /weekplan in Claude Code."
      : "Nog geen weekplan. Vraag het met /weekplan in Claude Code."));
    return uit;
  }
  if (week.uitleg) {
    const det = el("details"); det.append(el("summary", null, "Waarom deze week zo is"), el("p", "uitleg-tekst", week.uitleg)); uit.push(det);
  }
  const dagen = el("div", "dagen");
  for (let i = 0; i < 7; i++) {
    const dag = plusDagen(week.week, i), d = datum(dag);
    const rij = el("div", "dag" + (dag === D.momentopname ? " vandaag" : dag < D.momentopname ? " voorbij" : ""));
    const dd = el("div", "dag-datum"); dd.append(el("span", null, DAGEN[d.getDay()].slice(0, 2)), el("b", null, String(d.getDate())));
    const items = el("div", "dag-items");
    for (const t of week.trainingen.filter((x) => x.datum === dag)) items.append(trainingRij(t, D));
    for (const a of D.logboek.filter((x) => x.datum === dag && week.niet_gepland.some((id) => String(id) === String(x.id)))) items.append(activiteitRij(a));
    if (!items.children.length) { const r = el("div", "rij rust"); r.append(icoon("rust"), el("span", null, "Rust"), el("span")); items.append(r); }
    rij.append(dd, items);
    dagen.append(rij);
  }
  uit.push(dagen);
  return uit;
}

function trainingRij(t, D) {
  const s = soortVan(t), u = t.uitkomst;
  const rij = kleur(el("a", "rij"), s);
  rij.href = naarTraining(t.datum, t.index);
  if (route().sleutel === `plan/${t.datum}/${t.index}`) rij.setAttribute("aria-current", "true");
  const naam = el("div", "naam"); naam.append(el("strong", null, t.naam || s.label));
  let sub = `${t.duur_min} min`;
  if (u?.status === "verschoven") sub += ` · gedaan op ${DAGEN[datum(u.gedaan_op).getDay()]}`;
  if (u?.status === "overgeslagen") sub += " · niet ingehaald, dat is goed";
  naam.append(el("span", null, sub));
  const rechts = el("div", "rechts");
  const st = u && STATUS[u.status];
  if (st) rechts.append(pil(st[0], st[1], st[2]));
  if (u?.oordeel && u.oordeel.soort !== "volgens plan") rechts.append(oordeelChip({ koppeling: "gepland", oordeel: u.oordeel }));
  rij.append(icoon(s.icoon), naam, rechts);
  return rij;
}

function volgendeWeek(D) {
  const w = D.plan.volgende_week;
  if (w.akkoord) return weekLijst(D, w, "Volgende week");
  if (w.status === "voorstel") return [el("p", "klein", `Volgende week (vanaf ${kort(w.week)}): voorstel klaar, nog geen akkoord. Geef akkoord met /weekplan in Claude Code.`)];
  return [];
}

function seizoensplan(D) {
  const p = D.progressie;
  if (p.leeg) return [el("h2", null, "Seizoensplan"), el("div", "leeg", p.melding)];
  const sp = p.seizoensplan, uit = [el("h2", null, `Seizoensplan · ${sp.doel.naam}`)];
  const ul = el("ol", "seizoen");
  for (const f of sp.fases) {
    const huidig = p.huidige_fase && p.huidige_fase.naam === f.naam, voorbij = !huidig && f.tot < D.momentopname;
    const li = el("li", "fase" + (huidig ? " huidig" : voorbij ? " voorbij" : ""));
    const kop = el("div", "fase-kop"); kop.append(el("strong", null, f.naam), el("span", "klein", `${kort(f.van)} – ${kort(f.tot)}`));
    if (huidig) kop.append(pil("je bent hier", "neutraal"));
    li.append(kop, el("p", "klein", `Per week ~${f.richtvolume_min} loopminuten` +
      (f.richtvolume_fiets_uur != null ? ` en ~${uurMin(f.richtvolume_fiets_uur * 60)} fietsen` : "")));
    if (f.doel && !voorbij) li.append(el("p", "klein", f.doel));
    const binnen = el("ul");
    for (const c of (p.checkpoints || []).filter((c) => f.van <= c.datum && c.datum <= f.tot)) {
      binnen.append(el("li", c.afgevinkt ? "voorbij" : null, `${kort(c.datum)} · kine-checkpoint${c.afgevinkt ? " (afgevinkt)" : ": bespreek met je kine of de wedstrijd haalbaar is"}`));
    }
    for (const w of (sp.wedstrijden || []).filter((w) => f.van <= w.datum && w.datum <= f.tot)) {
      binnen.append(el("li", w.datum < D.momentopname ? "voorbij" : null, `${kort(w.datum)} · ${w.naam} (${w.prioriteit}, ${w.sport === "mtb" ? "MTB" : "lopen"}${w.afstand_km ? `, ${getal(w.afstand_km)} km` : ""})`));
    }
    if (binnen.children.length) li.append(binnen);
    ul.append(li);
  }
  uit.push(ul);
  return uit;
}

function trainingDetail(t, D) {
  const s = soortVan(t), u = t.uitkomst;
  const uit = [terugKnop("#plan")];
  const kaart = kleur(el("article", "kaart streep"), s);
  const kop = el("div", "rij-kop"); kop.append(icoon(s.icoon), el("span", "label", s.label));
  kaart.append(kop, el("h3", null, t.naam || s.label), el("p", "klein", `${DAGEN[datum(t.datum).getDay()]} ${kort(t.datum)}`));
  const duur = el("div", "duur"); duur.append(String(t.duur_min), el("small", null, " min"));
  kaart.append(duur);
  if (u && STATUS[u.status]) {
    const rij = el("p", "invoer-rij"); const st = STATUS[u.status]; rij.append(pil(st[0], st[1], st[2]));
    if (u.oordeel) rij.append(el("span", null, u.oordeel.soort === "volgens plan" ? "volgens plan" : u.oordeel.regel));
    if (u.activiteit != null) { const l = el("a", "link", "Bekijk de activiteit"); l.href = naarActiviteit(u.activiteit); rij.append(l); }
    kaart.append(rij);
  }
  const g = blokjes(t, true); if (g) kaart.append(g);
  const grens = rustigeGrens(t); if (grens) kaart.append(grens);
  const lijst = stappenLijst(t); if (lijst) kaart.append(lijst);
  if (t.doel === "wattage") kaart.append(el("p", "klein", "Op vermogen, in ERG-modus; je hartslag is alleen een noodrem."));
  if (t.uitleg) kaart.append(el("h2", null, "Waarom"), el("p", "uitleg-tekst", t.uitleg));
  uit.push(kaart);
  if (t.oefeningen?.length) {
    const blok = el("section", "kaart");
    blok.append(el("h2", null, t.rondes ? `Circuit · ${t.rondes} rondes` : "Oefeningen"));
    if (t.rondes) blok.append(el("p", "klein", `Elke oefening één keer per ronde${t.rust_oefening_s ? `, ${t.rust_oefening_s} s rust ertussen` : ""}${t.rust_ronde_s ? `, ${t.rust_ronde_s} s na een ronde` : ""}.`));
    const ul = el("ul", "oefeningen");
    for (const o of t.oefeningen) ul.append(oefening(o, D));
    blok.append(ul);
    uit.push(blok);
  }
  if (t.soort === "mtb" || t.soort === "rollen") {
    const vragen = (D.kine.grenzen || []).filter((g) => /fiets|klim|staand/i.test(g));
    if (vragen.length) {
      const blok = el("section", "kaart"); blok.append(el("h2", null, "Van je kine"));
      for (const v of vragen) blok.append(el("p", "klein", v));
      uit.push(blok);
    }
  }
  return uit;
}

function oefening(o, D) {
  const tekst = `${o.naam} · ${o.sets ? o.sets + "×" : ""}${o.herhalingen ?? ""}`;
  const demo = (D.oefeningen || {})[o.code];
  if (!demo) return el("li", null, tekst);
  const li = el("li"), det = el("details"), kop = el("summary");
  kop.append(el("span", null, tekst), pil(demo.bron === "kine" ? "van je kine" : "voorstel van de coach", "neutraal"));
  det.append(kop);
  const trefwoord = (demo.grens_trefwoord || "").toLowerCase();
  if (trefwoord) for (const g of (D.kine?.grenzen || []).filter((g) => g.toLowerCase().includes(trefwoord))) li.append(el("p", "kine-grens", "Grens van je kine: " + g));
  if (!demo.goedgekeurd) li.append(el("p", "nieuw-figuur", "Nieuw figuurtje: zeg je coach of het klopt."));
  let blok;
  det.addEventListener("toggle", () => { if (!det.open) return; if (blok) blok.start(); else det.append(blok = toonDemo(demo)); });
  li.prepend(det);
  return li;
}

// Elke oefening als bewegend figuurtje: zijaanzicht, of vooraanzicht bij de step-down. De animatie beweegt heen en
// weer tussen begin- en eindhouding; met minder beweging staan ze naast elkaar.
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
  if (demo.bron === "coach") blok.append(el("p", "klein", "Dit is een oefening van je coach, niet van je kine. Vraag je kine of ze past."));
  return blok;
}

// --- Logboek ---------------------------------------------------------------------------------------------

function schermLogboek(D, r) {
  const meester = el("div", "meester"), lijst = el("div", "scherm"), detail = el("div", "meester-detail scherm");
  lijst.style.paddingTop = "0";
  if (!D.logboek.length) lijst.append(el("div", "leeg", "Je eerste activiteit verschijnt hier na je volgende training."));
  let week = null, groep = null;
  for (const a of D.logboek) {
    const w = maandag(a.datum);
    if (w !== week) { week = w; lijst.append(el("h2", "weekkop", w === maandag(D.momentopname) ? "Deze week" : `Week van ${kort(w)}`)); groep = el("div", "lijst"); lijst.append(groep); }
    groep.append(activiteitRij(a));
  }
  if (r.id) {
    meester.classList.add("met-detail");
    const a = D.logboek.find((x) => String(x.id) === r.id);
    detail.append(...(a ? activiteitDetail(a, D) : [terugKnop("#logboek"), el("div", "leeg", "Deze activiteit staat niet meer in het logboek.")]));
  } else {
    detail.classList.add("leeg-detail");
    if (D.logboek.length) detail.append(el("div", "leeg", "Tik een activiteit voor gepland tegenover gedaan."));
  }
  meester.append(lijst, detail);
  return [meester];
}

function activiteitRij(a) {
  const s = soortVan(a);
  const rij = kleur(el("a", "rij"), s);
  rij.href = naarActiviteit(a.id);
  if (route().id === String(a.id)) rij.setAttribute("aria-current", "true");
  const naam = el("div", "naam");
  naam.append(el("strong", null, a.naam || s.label), el("span", null, `${lang(a.datum)} · ${a.minuten} min`));
  const rechts = el("div", "rechts");
  const chip = oordeelChip(a); if (chip) rechts.append(chip);
  if (a.soort && a.kniepijn == null) rechts.append(el("span", "pil knie-vraag", "knie ?"));
  else if (a.wacht) rechts.append(el("span", "pil knie-vraag", `knie ${a.kniepijn} · wacht`));
  rij.append(icoon(s.icoon), naam, rechts);
  return rij;
}

function zonebalk(minuten, label) {
  const totaal = minuten.reduce((x, y) => x + y, 0);
  if (!totaal) return null;
  const blok = el("div");
  const balk = el("div", "zonebalk"); balk.setAttribute("role", "img");
  balk.setAttribute("aria-label", `${label}: ` + minuten.map((m, i) => `zone ${i + 1} ${Math.round(m)} min`).join(", "));
  const legenda = el("div", "zonelegenda");
  minuten.forEach((m, i) => {
    const z = `var(--z${Math.min(i + 1, 5)})`;
    if (m > 0) { const b = el("i"); b.style.width = (m / totaal * 100) + "%"; b.style.background = z; balk.append(b); }
    const l = el("span"), blokje = el("i"); blokje.style.background = z; l.append(blokje, `Z${i + 1} ${Math.round(m)}′`); legenda.append(l);
  });
  blok.append(el("p", "label", label), balk, legenda);
  return blok;
}

function activiteitDetail(a, D) {
  const s = soortVan(a);
  const uit = [terugKnop("#logboek")];
  const kaart = kleur(el("article", "kaart streep"), s);
  const kop = el("div", "rij-kop"); kop.append(icoon(s.icoon), el("span", "label", s.label));
  kaart.append(kop, el("h3", null, a.naam || s.label), el("p", "klein", `${DAGEN[datum(a.datum).getDay()]} ${kort(a.datum)}`));
  const t = a.training ? D.gepland_vs_gedaan.trainingen.find((x) => x.week === a.training.week && x.index === a.training.index) : null;
  const naast = el("div", "naast");
  const gepland = el("div"), gedaan = el("div");
  gepland.append(el("p", "label", "Gepland"));
  if (t) {
    gepland.append(el("strong", null, `${t.duur_min} min`), el("span", "klein", `${t.naam || soortVan(t).label}${t.datum !== a.datum ? `, ${DAGEN[datum(t.datum).getDay()]}` : ""}`));
    const g = blokjes({ ...t, soort: t.soort }); if (g) gepland.append(g);
    if (t.hartslag_max) gepland.append(el("span", "klein", `max ${t.hartslag_max} bpm`));
  } else gepland.append(el("span", "klein", "Niet gepland."));
  gedaan.append(el("p", "label", "Gedaan"), el("strong", null, `${a.minuten} min`));
  if (a.gem_hartslag) gedaan.append(el("span", "klein", `gemiddeld ${Math.round(a.gem_hartslag)} bpm`));
  if (a.belasting != null) gedaan.append(el("span", "klein", `belasting ${Math.round(a.belasting)}`));
  naast.append(gepland, gedaan);
  kaart.append(naast);
  const chip = oordeelChip(a);
  if (chip) { const r = el("div", "invoer-rij"); r.append(chip); kaart.append(r); }
  if (a.oordeel) kaart.append(el("p", null, a.oordeel.uitleg));
  else if (a.koppeling === "niet gepland") kaart.append(el("p", "klein", "Deze activiteit stond niet in je weekplan."));
  const hz = zonebalk(a.zones_hartslag || [], "Tijd per hartslagzone"); if (hz) kaart.append(hz);
  if (a.soort === "rollen") { const pz = zonebalk(a.zones_vermogen || [], "Tijd per vermogenszone"); if (pz) kaart.append(pz); }
  const link = el("a", "link", "Bekijk in intervals.icu"); link.href = `https://intervals.icu/activities/${encodeURIComponent(String(a.id))}`;
  link.target = "_blank"; link.rel = "noopener noreferrer";
  kaart.append(link);
  uit.push(kaart);

  if (a.soort) {
    const knie = el("section", "kaart checkin");
    knie.setAttribute("aria-label", "Kniepijn bij deze training");
    knie.append(el("h2", null, a.kniepijn == null ? "Knie ?" : `Kniepijn ${a.kniepijn}`),
      el("p", "klein", "De hoogste pijn tijdens de training, geen stijfheid achteraf."));
    if (a.wacht) knie.append(el("p", "wacht", "Wacht op verbinding."));
    const nakijken = planNakijken(a.datum);
    knie.append(scores(a.kniepijn, (i) => staat.acties.geefIn({ soort: "knie", activiteit: a.id, naam: a.naam, datum: a.datum, waarde: i },
      `Kniepijn ${i}`, nakijken), "Kniepijn van 0 tot 10"));
    if (nakijken) knie.append(el("p", "klein", "Er is al een plan voor de week erna: geef je hier een score in, laat de coach het plan dan nakijken."));
    uit.push(knie);
  }
  return uit;
}

// --- Voortgang -------------------------------------------------------------------------------------------

function schermVoortgang(D) {
  const secties = [];
  const sectie = (id, titel, ...inhoud) => { const s = el("section", "kaart sectie"); s.id = "v-" + id; s.append(el("h2", null, titel), ...inhoud); secties.push([id, titel, s]); return s; };
  const p = D.progressie;
  if (!p.leeg) sectie("wedstrijd", "A-wedstrijd", ...wedstrijdSectie(D));
  sectie("volume", "Volume", volumeSectie(D));
  sectie("vorm", "Vorm", ...vormSectie(D));
  sectie("tachtig", "80/20", ...tachtigSectie(D));
  sectie("pijn", "Pijn", ...pijnSectie(D));
  sectie("ftp", "FTP", ...ftpSectie(D));
  const sprong = el("nav", "sprong"); sprong.setAttribute("aria-label", "Naar een sectie");
  for (const [id, titel] of secties) {
    const a = el("a", null, titel); a.href = "#voortgang";
    a.onclick = (e) => { e.preventDefault(); $("v-" + id).scrollIntoView({ behavior: RUSTIG.matches ? "auto" : "smooth", block: "start" }); };
    sprong.append(a);
  }
  const vergeet = el("button", "link vergeet-gsm", "Vergeet de sleutel op dit toestel"); vergeet.dataset.actie = "vergeet";
  vergeet.onclick = () => staat.acties.vergeet();
  return [sprong, ...secties.map((s) => s[2]), vergeet];
}

function grootCijfer(waarde, extra, ...rest) {
  const g = el("div", "groot-cijfer"), b = el("b", null, waarde);
  if (extra) b.append(el("small", null, extra));
  g.append(b, ...rest.filter(Boolean));
  return g;
}

function hoeLees(...alineas) {
  const det = el("details"); det.append(el("summary", null, "Hoe lees ik dit?"));
  const b = el("div", "uitleg-tekst klein"); for (const a of alineas) b.append(typeof a === "string" ? el("p", null, a) : a);
  det.append(b);
  return det;
}

const hoogte = () => (BREED.matches ? 170 : 130);

function wedstrijdSectie(D) {
  const p = D.progressie, sp = p.seizoensplan, hf = p.huidige_fase;
  const fase = hf ? `fase ${hf.naam}, week ${Math.floor((datum(D.momentopname) - datum(hf.van)) / 864e5 / 7) + 1} van ${hf.weken}` : null;
  const uit = [el("p", "wedstrijd-naam", sp.doel.naam),
    grootCijfer(String(Math.max(p.aftelling.dagen, 0)), " dagen", D.schema && pil(D.schema.stand, D.schema.stand === "op schema" ? "ok" : "warn", D.schema.stand === "op schema" ? "vink" : "driehoek")),
    el("p", "klein", [sp.doel.sport === "mtb" ? "MTB" : "lopen", sp.doel.afstand_km ? `${getal(sp.doel.afstand_km)} km` : null, lang(sp.doel.datum), fase].filter(Boolean).join(" · "))];
  if (D.schema) uit.push(el("p", null, D.schema.uitleg));
  const fit = el("div", "grafiek");
  uit.push(el("p", "label", "Fitheid, de voorbije weken"), fit,
    hoeLees("Je fitheid is wat je lichaam gewend is, over ongeveer zes weken. Ze groeit traag, en dat is goed: zo krijgt je pees de tijd.",
      "Er is geen streeflijn: de coach stuurt het plan bij, er valt niets in te halen."));
  tekenGrafieken.push(() => {
    const rijen = D.belasting.filter((r) => r.fitheid != null);
    if (!rijen.length) { fit.replaceChildren(el("p", "klein", "Nog geen gegevens over je fitheid.")); return; }
    const max = Math.ceil(Math.max(...rijen.map((r) => r.fitheid)) / 10) * 10 + 10;
    grafiek(fit, { dagen: rijen.map((r) => r.datum), min: 0, max, ticks: [0, max / 2, max], label: "Fitheid per dag, de voorbije weken",
      teken(svg, x, y) { svg.append(svgEl("path", { d: pad(rijen.map((r, i) => [x(i), y(r.fitheid)])), fill: "none", stroke: "var(--z4)", "stroke-width": 2.5 })); },
      tip(d) { const r = rijen.find((q) => q.datum === d); return { kop: lang(d), regels: [`fitheid ${getal(r.fitheid)}`] }; } });
  });
  return uit;
}

function volumeSectie(D) {
  const twee = el("div", "twee");
  const c = D.weekstatus.cijfers, lv = c.loopvolume;
  const over = lv.toegelaten != null && lv.gelopen > lv.toegelaten;
  const loop = el("div"), fiets = el("div");
  const vol = el("div", "grafiek"), fg = el("div", "grafiek");
  loop.append(el("p", "label", "Loopvolume deze week"),
    grootCijfer(String(lv.gelopen), lv.toegelaten != null ? ` / ${lv.toegelaten} min` : " min",
      lv.toegelaten == null ? null : over ? pil(`${lv.gelopen - lv.toegelaten} min te veel`, "warn", "driehoek") : pil("binnen de grens", "ok", "vink")),
    vol, legende([["t-rustig", "gelopen"], ["warn", "boven het toegelaten"], ["ink", "toegelaten", true], ["muted", "richtvolume", true]]),
    hoeLees("Elke staaf is een week. Het stuk boven het toegelaten volume is oranje: dat is geen vooruitgang, want te snel meer lopen is precies hoe je pees overbelast raakte.",
      "De lijn is het toegelaten loopvolume (de pijnregel en de opbouw), de stippellijn het richtvolume van de fase."));
  fiets.append(el("p", "label", "Fietstijd deze week"), grootCijfer(uurMin(c.fietstijd_min), null), fg,
    legende([["t-mtb", "MTB en rollen"], ["muted", "richtvolume", true]]),
    hoeLees("Fietstijd groeit via langere ritten, niet via extra sessies. Ze heeft geen eigen groeiregel: de belasting en de vorm bewaken ze."));
  twee.append(loop, fiets);
  const weken = D.volume;
  const hier = weken.findIndex((w) => w.week === maandag(D.momentopname));
  tekenGrafieken.push(() => {
    const vmax = Math.ceil(Math.max(30, ...weken.map((w) => Math.max(w.werkelijk || 0, w.toegelaten || 0, w.richtvolume || 0))) / 30) * 30;
    grafiek(vol, { band: true, dagen: weken.map((w) => w.week), min: 0, max: vmax, ticks: [0, vmax / 2, vmax], label: "Loopvolume per week tegen het toegelaten volume",
      teken(svg, x, y, strook) {
        const b = Math.max(3, strook * 0.66);
        weken.forEach((w, i) => {
          if (!w.werkelijk) return;
          const binnen = w.toegelaten != null ? Math.min(w.werkelijk, w.toegelaten) : w.werkelijk;
          svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(binnen), width: b, height: y(0) - y(binnen), fill: "var(--t-rustig)" }));
          if (w.werkelijk > binnen) svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(w.werkelijk), width: b, height: y(binnen) - y(w.werkelijk), fill: "var(--warn)" }));
        });
        trap(svg, weken.map((w) => w.toegelaten), x, y, strook, { stroke: "var(--ink)", "stroke-width": 2 });
        trap(svg, weken.map((w) => w.richtvolume), x, y, strook, { stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "4 3" });
        if (hier >= 0) svg.append(svgEl("line", { x1: x(hier), x2: x(hier), y1: y(0), y2: y(vmax), stroke: "var(--muted)", "stroke-dasharray": "2 3" }));
      },
      tip(d) { const w = weken.find((q) => q.week === d); return { kop: `week van ${kort(d)}`, regels: [`gelopen ${w.werkelijk ?? "—"} · toegelaten ${w.toegelaten ?? "—"} · richtvolume ${w.richtvolume ?? "—"} min`] }; } });
    const uur = (m) => m == null ? null : Math.round(m / 6) / 10;
    const fmax = Math.ceil(Math.max(2, ...weken.map((w) => Math.max(uur(w.fietstijd) || 0, w.richtvolume_fiets_uur || 0))) / 2) * 2;
    grafiek(fg, { band: true, dagen: weken.map((w) => w.week), min: 0, max: fmax, ticks: [0, fmax / 2, fmax], label: "Fietstijd per week in uren",
      teken(svg, x, y, strook) {
        const b = Math.max(3, strook * 0.66);
        weken.forEach((w, i) => { if (w.fietstijd) svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(uur(w.fietstijd)), width: b, height: y(0) - y(uur(w.fietstijd)), fill: "var(--t-mtb)" })); });
        trap(svg, weken.map((w) => w.richtvolume_fiets_uur), x, y, strook, { stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "4 3" });
        if (hier >= 0) svg.append(svgEl("line", { x1: x(hier), x2: x(hier), y1: y(0), y2: y(fmax), stroke: "var(--muted)", "stroke-dasharray": "2 3" }));
      },
      tip(d) { const w = weken.find((q) => q.week === d); return { kop: `week van ${kort(d)}`, regels: [`gefietst ${w.fietstijd != null ? uurMin(w.fietstijd) : "—"} · richtvolume ${w.richtvolume_fiets_uur != null ? uurMin(w.richtvolume_fiets_uur * 60) : "—"}`] }; } });
  });
  return twee;
}

function legende(items) {
  const l = el("div", "legenda");
  for (const [k, tekst, lijn] of items) { const s = el("span"), i = el("i"); i.style.background = `var(--${k})`; if (lijn) i.style.height = "3px"; s.append(i, tekst); l.append(s); }
  return l;
}

function trap(svg, waarden, x, y, strook, attrs) {
  const punten = [];
  waarden.forEach((v, i) => { if (v != null) punten.push([x(i) - strook / 2, y(v)], [x(i) + strook / 2, y(v)]); });
  if (punten.length) svg.append(svgEl("path", { d: pad(punten), fill: "none", ...attrs }));
}

const ZONE_TINT = { "uitgerust": "ok", "normaal": "ok", "zware opbouw": "warn", "overbelast": "bad" };

function vormSectie(D) {
  const c = D.weekstatus.cijfers;
  const g = el("div", "grafiek");
  const zones = el("ul");
  for (const z of D.vormzones) {
    const grens = z.van == null ? `onder ${z.tot}` : z.tot == null ? `boven +${z.van}` : `${z.van} tot ${z.tot > 0 ? "+" : ""}${z.tot}`;
    const li = el("li"); li.append(el("b", null, z.naam), ` (${grens}): ${z.uitleg}`); zones.append(li);
  }
  const uit = [grootCijfer(c.vorm == null ? "—" : String(Math.round(c.vorm)), null, c.vormzone && pil(c.vormzone, ZONE_TINT[c.vormzone])),
    g, hoeLees("De lijn is je vorm: je fitheid min je vermoeidheid. De achtergrond toont de vormzones; de staafjes onderaan zijn de belasting per training, in de kleur van de soort. Tik of sleep om een dag te kiezen.", zones)];
  tekenGrafieken.push(() => tekenVorm(g, D));
  return uit;
}

function tekenVorm(doel, D) {
  const rijen = D.belasting.filter((r) => r.vorm != null);
  if (!rijen.length) { doel.replaceChildren(el("p", "klein", "Nog geen gegevens over je vorm.")); return; }
  const zones = D.vormzones, grenzen = zones.flatMap((z) => [z.van, z.tot]).filter((g) => g != null);
  const vormen = rijen.map((r) => r.vorm);
  const min = Math.min(Math.min(...grenzen) - 10, Math.floor(Math.min(...vormen) / 10) * 10);
  const max = Math.max(Math.max(...grenzen) + 15, Math.ceil(Math.max(...vormen) / 10) * 10);
  const onder = min - (max - min) * 0.4;
  const hoogsteBelasting = Math.max(1, ...rijen.map((r) => r.belasting || 0));
  const soortVanA = (a) => a.soort ? soortVan({ soort: a.soort, hard: a.hard && a.soort === "loopje" }) : SOORT.ander;
  grafiek(doel, {
    dagen: rijen.map((r) => r.datum), min: onder, max, hoogte: hoogte() + 40, ticks: [...new Set(grenzen)].sort((a, b) => a - b),
    label: "Vorm per dag op de vormzones, met de belasting per activiteit", band: true,
    teken(svg, x, y, strook) {
      const links = x(0) - strook / 2, rechts = x(rijen.length - 1) + strook / 2;
      for (const z of zones) {
        const boven = y(z.tot ?? max), beneden = y(z.van ?? min);
        if (z.naam === "zware opbouw" || z.naam === "overbelast") svg.append(svgEl("rect", { x: links, y: boven, width: rechts - links, height: beneden - boven, fill: `var(--${ZONE_TINT[z.naam]}-soft)` }));
      }
      const b = Math.max(3, Math.min(12, strook * 0.7)), ruimte = y(onder) - y(min) - 4;
      rijen.forEach((r, i) => {
        let bodem = y(onder);
        for (const a of r.activiteiten || []) {
          if (!a.belasting) continue;
          const h = (a.belasting / hoogsteBelasting) * ruimte;
          svg.append(svgEl("rect", { x: x(i) - b / 2, y: bodem - h, width: b, height: h, fill: `var(--${soortVanA(a).kleur})`, stroke: "var(--panel)", "stroke-width": 1 }));
          bodem -= h;
        }
      });
      svg.append(svgEl("path", { d: pad(rijen.map((r, i) => [x(i), y(r.vorm)])), fill: "none", stroke: "var(--ink)", "stroke-width": 2 }));
    },
    tip(d) {
      const r = rijen.find((q) => q.datum === d);
      const acts = (r.activiteiten || []).map((a) => `${soortVanA(a).label}${a.naam && a.naam !== soortVanA(a).label ? " · " + a.naam : ""}: ${a.belasting}`);
      return { kop: `${lang(d)} · vorm ${getal(r.vorm)} (${r.vormzone})`, regels: acts.length ? acts : ["geen training"] };
    },
  });
}

function tachtigSectie(D) {
  const weken = D.tachtig_twintig, deze = weken.at(-1), vorige = weken.at(-2);
  const toon = deze && deze.hard_pct != null ? deze : vorige;
  const g = el("div", "grafiek");
  const uit = [grootCijfer(toon && toon.hard_pct != null ? `${toon.hard_pct}%` : "—", " hard",
    toon && toon.hard_pct != null ? (toon.boven_20 ? pil("boven 20%", "warn", "driehoek") : pil("binnen 80/20", "ok", "vink")) : null),
    el("p", "klein", toon === deze ? "Deze week, in hartslagzones (lopen, MTB, rollen)." : "Vorige week, in hartslagzones (lopen, MTB, rollen)."),
    g, legende([["z2", "rustig (zone 1-2)"], ["z4", "hard (zone 3+)"], ["warn", "hard, boven 20%"], ["ink", "80%", true]]),
    hoeLees("Per week de tijd in hartslagzones, voor lopen, MTB en rollen; kracht telt niet. Zone 1 en 2 is rustig, zone 3 en hoger hard.",
      "80/20 is informatie. De regel blijft het aantal harde trainingen per week. Minder dan 20% hard is nooit een reden om meer hard te doen.")];
  tekenGrafieken.push(() => {
    grafiek(g, { band: true, dagen: weken.map((w) => w.week), min: 0, max: 100, ticks: [0, 50, 100], label: "Tijd per week rustig en hard, in procent",
      teken(svg, x, y, strook) {
        const b = Math.max(6, strook * 0.6);
        weken.forEach((w, i) => {
          if (w.hard_pct == null) return;
          svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(100), width: b, height: y(0) - y(100), fill: "var(--z2)" }));
          svg.append(svgEl("rect", { x: x(i) - b / 2, y: y(100), width: b, height: y(100 - w.hard_pct) - y(100), fill: w.boven_20 ? "var(--warn)" : "var(--z4)" }));
        });
        svg.append(svgEl("line", { x1: x(0) - strook / 2, x2: x(weken.length - 1) + strook / 2, y1: y(80), y2: y(80), stroke: "var(--ink)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
      },
      tip(d) { const w = weken.find((q) => q.week === d); return { kop: `week van ${kort(d)}`, regels: [w.hard_pct == null ? "geen training" : `rustig ${uurMin(w.rustig_min)} · hard ${uurMin(w.hard_min)} (${w.hard_pct}%)`] }; } });
  });
  return uit;
}

function pijnSectie(D) {
  const laatsteOchtend = D.pijn.ochtendpijn.at(-1), laatsteKnie = D.pijn.kniepijn.at(-1);
  const g = el("div", "grafiek");
  const uit = [grootCijfer(laatsteOchtend ? String(laatsteOchtend.score) : "—", " ochtend",
    el("span", "klein", laatsteOchtend ? (laatsteOchtend.datum === D.momentopname ? "vandaag" : lang(laatsteOchtend.datum)) : ""),
    laatsteKnie ? el("span", "klein", `· knie ${laatsteKnie.score} (${lang(laatsteKnie.datum)})`) : null),
    g, legende([["z4", "ochtendpijn"], ["t-rustig", "kniepijn na training"], ["bad", "grens", true]]),
    hoeLees("Elke dag van de voorbije weken. Een gat in de lijn is een dag zonder ochtendpijn: dan valt de vergelijking van de pijnregel weg.",
      D.pijn.kniepijn_uitleg)];
  // invoer voor een datum: ochtendpijn achteraf ingeven of wijzigen
  const invoer = el("div", "checkin");
  const dag = el("input"); dag.type = "date"; dag.max = D.momentopname; dag.value = D.momentopname; dag.setAttribute("aria-label", "Datum van de ochtendpijn");
  const plek = el("div");
  const tekenInvoer = () => {
    const d = dag.value || D.momentopname;
    const nu = D.pijn.ochtendpijn.find((p) => p.datum === d)?.score ?? null;
    plek.replaceChildren(scores(nu, (i) => staat.acties.geefIn({ soort: "ochtend", datum: d, waarde: i }, `Ochtendpijn ${i} (${kort(d)})`,
      d !== D.momentopname ? planNakijken(plusDagen(d, -1)) : null), "Ochtendpijn van 0 tot 10"));
  };
  dag.onchange = tekenInvoer;
  tekenInvoer();
  const rij = el("div", "invoer-rij"); rij.append(el("strong", null, "Ochtendpijn op"), dag);
  invoer.append(rij, plek);
  uit.push(invoer);
  tekenGrafieken.push(() => {
    const eerste = D.belasting[0]?.datum ?? plusDagen(D.momentopname, -41);
    const dagen = []; for (let d = eerste; d <= D.momentopname; d = plusDagen(d, 1)) dagen.push(d);
    const ochtend = new Map(D.pijn.ochtendpijn.map((p) => [p.datum, p.score]));
    grafiek(g, { dagen, min: 0, max: 10, ticks: [0, D.pijn.grens, 10], label: "Kniepijn en ochtendpijn per dag",
      teken(svg, x, y) {
        svg.append(svgEl("line", { x1: x(0), x2: x(dagen.length - 1), y1: y(D.pijn.grens), y2: y(D.pijn.grens), stroke: "var(--bad)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
        // de ochtendpijn als lijn met gaten: een ontbrekende dag breekt de lijn
        let stuk = [];
        const sluit = () => { if (stuk.length > 1) svg.append(svgEl("path", { d: pad(stuk), fill: "none", stroke: "var(--z4)", "stroke-width": 2 })); stuk = []; };
        dagen.forEach((d, i) => { if (ochtend.has(d)) stuk.push([x(i), y(ochtend.get(d))]); else sluit(); });
        sluit();
        dagen.forEach((d, i) => { if (ochtend.has(d)) svg.append(svgEl("circle", { cx: x(i), cy: y(ochtend.get(d)), r: 2.5, fill: "var(--z4)" })); });
        for (const p of D.pijn.kniepijn) {
          const i = dagen.indexOf(p.datum); if (i < 0) continue;
          svg.append(svgEl("circle", { cx: x(i), cy: y(p.score), r: 4.5, fill: p.score > D.pijn.grens ? "var(--bad)" : "var(--t-rustig)" }));
        }
      },
      tip(d) {
        const k = D.pijn.kniepijn.filter((p) => p.datum === d).map((p) => `knie ${p.score} (${p.training})`);
        return { kop: lang(d), regels: [ochtend.has(d) ? `ochtend ${ochtend.get(d)}` : "geen ochtendpijn", ...k] };
      } });
  });
  return uit;
}

function ftpSectie(D) {
  const f = D.ftp || {};
  const soort = f.melding?.soort;
  const uit = [grootCijfer(f.ingesteld ? String(f.ingesteld) : "—", " W", f.melding && pil(
    soort === "in_lijn" ? "in lijn" : soort === "bijwerken" ? "bijwerken" : soort === "verouderd" ? "verouderd" : "geen Garmin-FTP",
    soort === "in_lijn" ? "ok" : "warn", soort === "in_lijn" ? "vink" : "driehoek"))];
  uit.push(el("p", null, f.melding ? f.melding.tekst : "Er is nog geen FTP ingesteld in intervals.icu."));
  const regels = [];
  if (f.garmin) regels.push(`Garmin-FTP: ${f.garmin.waarde} W (${kort(f.garmin.datum)})`);
  if (f.eftp) regels.push(`eFTP: ${f.eftp} W`);
  if (regels.length) uit.push(el("p", "klein", regels.join(" · ")));
  if (f.eftp_uitleg) uit.push(hoeLees(f.eftp_uitleg));
  const knop = el("button", "stil", "Garmin-FTP ingeven");
  knop.onclick = () => staat.acties.openFtp();
  uit.push(knop);
  return uit;
}

// --- Grafieken: tikken of slepen kiest een dag; de details staan vast onder de grafiek -------------------------

const pad = (punten) => punten.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

function grafiek(doel, opts) {
  const breedte = Math.max(260, doel.clientWidth), h = opts.hoogte || hoogte();
  const m = { l: 28, r: 6, t: 8, b: 20 };
  const svg = svgEl("svg", { viewBox: `0 0 ${breedte} ${h}`, role: "img", "aria-label": opts.label });
  const dagen = opts.dagen, n = dagen.length, binnen = breedte - m.l - m.r;
  const strook = opts.band ? binnen / Math.max(n, 1) : (n < 2 ? 0 : binnen / (n - 1));
  const x = (i) => m.l + (opts.band ? (i + 0.5) * strook : i * strook);
  const y = (v) => h - m.b - ((v - opts.min) / (opts.max - opts.min)) * (h - m.t - m.b);
  for (const v of opts.ticks) {
    if (v < opts.min) continue;
    svg.append(svgEl("line", { x1: m.l, x2: breedte - m.r, y1: y(v), y2: y(v), stroke: "var(--line)", "stroke-width": 1 }));
    const t = svgEl("text", { x: m.l - 5, y: y(v) + 4, "text-anchor": "end" }); t.textContent = v; svg.append(t);
  }
  const labels = Math.max(2, Math.floor(binnen / 70)), stap = Math.max(1, Math.ceil(n / labels));
  dagen.forEach((d, i) => {
    if (i % stap === 0) { const t = svgEl("text", { x: x(i), y: h - 5, "text-anchor": i === 0 && !opts.band ? "start" : "middle" }); t.textContent = kort(d); svg.append(t); }
  });
  opts.teken(svg, x, y, strook);
  const markering = svgEl("g", { "pointer-events": "none" });
  svg.append(markering);
  const detail = el("div", "detail"); detail.setAttribute("aria-live", "polite");
  detail.style.minHeight = "2.9em";
  svg.tabIndex = 0;
  doel.replaceChildren(svg, detail);
  let vast = 0;
  dagen.forEach((d, i) => { if (d <= staat.D.momentopname) vast = i; });
  const toon = (i) => {
    markering.replaceChildren(svgEl("line", { x1: x(i), x2: x(i), y1: m.t, y2: h - m.b, stroke: "var(--ink)", "stroke-width": 1.5, opacity: 0.4 }));
    const inhoud = opts.tip(dagen[i]);
    detail.replaceChildren();
    if (!inhoud) { detail.append(el("b", null, kort(dagen[i]))); return; }
    detail.append(el("b", null, inhoud.kop));
    for (const regel of inhoud.regels || []) detail.append(el("div", null, regel));
  };
  const index = (e) => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (breedte / r.width);
    const i = opts.band ? Math.floor((px - m.l) / strook) : Math.round((px - m.l) / (strook || 1));
    return Math.min(Math.max(i, 0), n - 1);
  };
  svg.addEventListener("pointermove", (e) => { const i = index(e); if (e.pointerType !== "mouse") vast = i; toon(i); });
  svg.addEventListener("pointerdown", (e) => { vast = index(e); toon(vast); });
  svg.addEventListener("pointerleave", () => toon(vast));
  svg.addEventListener("keydown", (e) => {
    const stapje = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!stapje) return;
    e.preventDefault(); vast = Math.min(Math.max(vast + stapje, 0), n - 1); toon(vast);
  });
  if (n) toon(vast);
}
