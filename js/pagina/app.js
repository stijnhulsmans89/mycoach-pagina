// De pagina op de gsm en de Mac: leest intervals.icu live, rekent met dezelfde regels als de coach, en zet pijnscores en de
// Garmin-FTP rechtstreeks in intervals.icu. Zonder verbinding toont ze de laatste momentopname en bewaart ze wat je
// ingeeft tot er weer verbinding is. De sleutel staat alleen in de browseropslag van de gsm en van één web-app op de Mac.

import { AdapterFout,          } from "../bronnen.js";
import { dashboardData } from "../dashboard.js";
                                         
import { BrowserAdapter, GeenVerbinding, INTERVALS, NotitieOpslag } from "./bronnen.js";
// @ts-expect-error: weergave.js is gewoon JavaScript, zonder types
import { toon } from "./weergave.js";

const SLEUTEL = "mycoach-sleutel";
const LAATSTE = "mycoach-laatste";
const WACHTRIJ = "mycoach-wachtrij";

// --- Browseropslag: kan ontbreken (privévenster), dus altijd met try ---------------

const opslag = {
  lees(k        )                { try { return localStorage.getItem(k); } catch { return null; } },
  zet(k        , v        )       { try { localStorage.setItem(k, v); } catch { /* geen opslag: dan niet */ } },
  wis(k        )       { try { localStorage.removeItem(k); } catch { /* idem */ } },
  json   (k        , standaard   )    { try { return JSON.parse(opslag.lees(k) ?? "")     ; } catch { return standaard; } },
};

const $ =                                      (id        ) => document.getElementById(id)     ;

function vandaagLokaal()        {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Alleen op de eigen Mac (proefserver) praat de pagina met een nagebootste intervals.icu op hetzelfde adres. */
function apiBasis()         {
  return ["localhost", "127.0.0.1"].includes(location.hostname) ? `${location.origin}/api/v1` : INTERVALS;
}

// --- Invoer: wat je ingeeft, gaat rechtstreeks naar intervals.icu ---------------------

             
                                                                                              
                                                      
                                                   

                                                                              

async function schrijf(adapter                , velden        , invoer        )                {
  if (invoer.soort === "knie") await adapter.wijzigActiviteit(invoer.activiteit, { [velden.kniepijn]: invoer.waarde });
  else if (invoer.soort === "ochtend") await adapter.wijzigWellness(invoer.datum, { [velden.ochtendpijn]: invoer.waarde });
  else await adapter.wijzigWellness(invoer.datum, { [velden.garmin_ftp]: invoer.waarde });
}

function wachtrij()           {
  return opslag.json          (WACHTRIJ, []);
}

/** Wat offline ingegeven is, alsnog versturen. Geeft het aantal verstuurde items. */
async function verstuurWachtrij(adapter                , velden        )                  {
  const rest           = [];
  let verstuurd = 0;
  for (const invoer of wachtrij()) {
    try {
      await schrijf(adapter, velden, invoer);
      verstuurd++;
    } catch (fout) {
      rest.push(invoer);
      if (!(fout instanceof GeenVerbinding)) break;
    }
  }
  if (rest.length) opslag.zet(WACHTRIJ, JSON.stringify(rest)); else opslag.wis(WACHTRIJ);
  return verstuurd;
}

// --- Laden en tonen -------------------------------------------------------------------

                                                 

let bezig = false;

async function laad()                {
  const sleutel = opslag.lees(SLEUTEL);
  if (!sleutel) return vraagSleutel();
  if (bezig) return;
  bezig = true;
  const adapter = new BrowserAdapter(sleutel, apiBasis());
  try {
    const profielVelden = opslag.json                     (LAATSTE, null)?.velden;
    if (profielVelden && wachtrij().length) await verstuurWachtrij(adapter, profielVelden);
    const vandaag = vandaagLokaal();
    const notities = await NotitieOpslag.laad(adapter, vandaag);
    const D = await dashboardData(adapter, notities, vandaag);
    const velden = (await notities.profiel()).velden          ;
    if (wachtrij().length) await verstuurWachtrij(adapter, velden);
    opslag.zet(LAATSTE, JSON.stringify({ D, velden }));
    teken({ D, velden }, adapter, "");
  } catch (fout) {
    const laatste = opslag.json                     (LAATSTE, null);
    if (fout instanceof AdapterFout && !(fout instanceof GeenVerbinding) && /sleutel/.test(fout.message)) {
      vraagSleutel(fout.message);
    } else if (laatste) {
      const melding = fout instanceof GeenVerbinding ? "Geen verbinding" : (fout         ).message;
      teken(laatste, adapter, `${melding}: dit is de laatste momentopname, van ${laatste.D.gemaakt_op.slice(11, 16)}` +
        (laatste.D.momentopname !== vandaagLokaal() ? ` op ${laatste.D.momentopname}` : "") + ".");
    } else {
      toonFout(fout instanceof GeenVerbinding ? "Geen verbinding met intervals.icu. Probeer het opnieuw zodra je verbinding hebt."
        : (fout         ).message);
    }
  } finally {
    bezig = false;
  }
}

function toonFout(tekst        )       {
  $("laden").hidden = false;
  $("laden").textContent = tekst;
}

function vraagSleutel(fout = "")       {
  $("laden").hidden = true;
  $("inhoud").hidden = true;
  $("sleutel").hidden = false;
  $("sleutel-bericht").textContent = fout;
  $("sleutel-bericht").className = "bericht" + (fout ? " fout" : "");
  $                  ("sleutel-veld").focus();
}

function teken(m              , adapter                , verbinding        )       {
  $("laden").hidden = true;
  $("sleutel").hidden = true;
  $("inhoud").hidden = false;
  const hulp = toon(m.D);
  const open = wachtrij().length;
  $("verbinding").textContent = [verbinding, open ? `${open} ingave${open > 1 ? "n" : ""} wacht${open > 1 ? "en" : ""} op verbinding.` : ""]
    .filter(Boolean).join(" ");
  $("verbinding").className = "bericht" + (verbinding ? " fout" : "");
  bindInvoer(m, adapter, hulp);
  $("ververs").onclick = () => { $("verbinding").textContent = "Bezig met verversen…"; void laad(); };
  $("vergeet").onclick = () => {
    if (!confirm("De sleutel en de laatste momentopname op dit toestel wissen?")) return;
    for (const k of [SLEUTEL, LAATSTE, WACHTRIJ]) opslag.wis(k);
    vraagSleutel();
  };
}

// --- De invoervelden ------------------------------------------------------------------

const DAG = new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "short" });
const SOORTNAAM                         = { loopje: "Loopje", mtb: "MTB", rollen: "Rollen", kracht: "Kracht" };

function bindInvoer(m              , adapter                , hulp     )       {
  const { D, velden } = m;
  const { kies, toonMeldingen, kort, el } = hulp;
  const vandaag = vandaagLokaal();
  $("pijninvoer").hidden = false;
  $("ftp-invoer").hidden = false;
  for (const id of ["ochtend-datum", "ftp-datum"]) {
    const veld = $                  (id);
    veld.value = vandaag;
    veld.max = vandaag;
  }

  const bericht = (soort        , tekst        , cls = "") => {
    const b = $(`${soort}-bericht`);
    b.textContent = tekst;
    b.className = "bericht" + (cls ? ` ${cls}` : "");
  };

  async function geefIn(invoer        , omschrijving        )                {
    bericht(invoer.soort, "Bezig…");
    try {
      await schrijf(adapter, velden, invoer);
      bericht(invoer.soort, `✓ ${omschrijving} staat in intervals.icu. De pagina rekent opnieuw…`, "ok");
      await laad();
      bericht(invoer.soort, `✓ ${omschrijving} staat in intervals.icu.`, "ok");
    } catch (fout) {
      if (fout instanceof GeenVerbinding) {
        opslag.zet(WACHTRIJ, JSON.stringify([...wachtrij(), invoer]));
        bericht(invoer.soort, `Geen verbinding: ${omschrijving} is bewaard op dit toestel en gaat naar intervals.icu zodra er verbinding is.`, "ok");
      } else {
        bericht(invoer.soort, `Dat lukte niet: ${(fout         ).message}`, "fout");
      }
    }
  }

  // Kniepijn: bij een training van de laatste week, standaard het laatste loopje zonder score
  const trainingen        = D.activiteiten_recent ?? [];
  const keuzeKnie = $                   ("knie-training");
  keuzeKnie.replaceChildren();
  for (const a of trainingen) {
    // een kort label van de pagina zelf: een naam uit Garmin kan eindeloos lang zijn
    const optie = el("option", null, `${DAG.format(new Date(`${a.datum}T12:00:00`))} · ${SOORTNAAM[a.soort] ?? a.type} · ${a.minuten} min` +
      (a.kniepijn != null ? ` · nu ${a.kniepijn}` : ""));
    optie.value = String(a.id);
    keuzeKnie.append(optie);
  }
  // standaard: een loopje van gisteren of vandaag zonder score (de pijnregel draait om het lopen), anders de laatste training
  const gisteren = new Date(Date.now() - 86_400_000);
  const sinds = `${gisteren.getFullYear()}-${String(gisteren.getMonth() + 1).padStart(2, "0")}-${String(gisteren.getDate()).padStart(2, "0")}`;
  const standaard = trainingen.find((a) => a.soort === "loopje" && a.kniepijn == null && a.datum >= sinds) ?? trainingen[0];
  if (standaard) keuzeKnie.value = String(standaard.id);
  $("knie-veld").hidden = !trainingen.length;

  const keuze                                            = { knie: null, ochtend: null };
  const huidigeWaarde = (soort                    )                => {
    if (soort === "knie") return trainingen.find((a) => String(a.id) === keuzeKnie.value)?.kniepijn ?? null;
    const datum = $                  ("ochtend-datum").value || vandaag;
    return D.pijn.ochtendpijn.find((p     ) => p.datum === datum)?.score ?? null;
  };

  function vernieuw(soort                    )       {
    const huidig = huidigeWaarde(soort);
    const gekozen = keuze[soort] ?? huidig;
    for (const b of $(`${soort}-scores`).children) b.setAttribute("aria-pressed", String(Number(b.textContent) === gekozen));
    const knop = $                   (`${soort}-bevestig`);
    const naam = soort === "knie" ? "kniepijn" : "ochtendpijn";
    if (keuze[soort] == null || keuze[soort] === huidig) {
      knop.disabled = true;
      knop.textContent = huidig == null ? "Kies eerst een score" : `Staat op ${huidig}: kies een andere score om te wijzigen`;
    } else {
      knop.disabled = false;
      knop.textContent = huidig == null ? `Bewaar ${naam} ${keuze[soort]}` : `Wijzig ${naam} van ${huidig} naar ${keuze[soort]}`;
    }
  }

  for (const soort of ["knie", "ochtend"]         ) {
    const scores = $(`${soort}-scores`);
    scores.replaceChildren();
    for (let i = 0; i <= 10; i++) {
      const k = el("button", i > D.pijn.grens ? "boven" : null, String(i));
      k.setAttribute("aria-pressed", "false");
      k.onclick = () => { keuze[soort] = i; bericht(soort, ""); vernieuw(soort); };
      scores.append(k);
    }
    $(`${soort}-bevestig`).onclick = async () => {
      const waarde = keuze[soort];
      if (waarde == null) return;
      keuze[soort] = null;
      if (soort === "knie") {
        const a = trainingen.find((t) => String(t.id) === keuzeKnie.value);
        if (!a) return;
        await geefIn({ soort, activiteit: a.id, naam: a.naam, datum: a.datum, waarde }, `Kniepijn ${waarde} na ${a.naam || a.type} (${kort(a.datum)})`);
      } else {
        const datum = $                  ("ochtend-datum").value || vandaag;
        await geefIn({ soort, datum, waarde }, `Ochtendpijn ${waarde} op ${kort(datum)}`);
      }
    };
    vernieuw(soort);
  }
  keuzeKnie.onchange = () => { keuze.knie = null; bericht("knie", ""); vernieuw("knie"); };
  $("ochtend-datum").onchange = () => { keuze.ochtend = null; bericht("ochtend", ""); vernieuw("ochtend"); };

  $("ftp-bewaar").onclick = () => {
    const waarde = Number($                  ("ftp-waarde").value);
    if (!Number.isInteger(waarde) || waarde < 50 || waarde > 600) {
      bericht("ftp", "Een FTP is een getal tussen 50 en 600 W.", "fout");
      $("ftp-waarde").focus();
      return;
    }
    const datum = $                  ("ftp-datum").value || vandaag;
    void geefIn({ soort: "ftp", datum, waarde }, `Garmin-FTP ${waarde} W op ${kort(datum)}`);
  };

  // Herinnering bovenaan: kniepijn na een loopje van gisteren of vandaag, en de ochtendpijn van vandaag
  const items                                                    = [];
  for (const l of D.pijn.loopjes_zonder_kniepijn ?? []) {
    const a = trainingen.find((t) => t.datum === l.datum && t.naam === l.training && t.kniepijn == null);
    if (!a) continue;
    const wanneer = l.datum === vandaag ? "vandaag" : "gisteren";
    items.push({ tekst: `Knie na loopje ${wanneer}`, ga: () => { keuzeKnie.value = String(a.id); return "knie"; } });
  }
  if (!D.pijn.ochtendpijn.some((p     ) => p.datum === vandaag)) {
    items.push({ tekst: "Ochtendpijn", ga: () => { $                  ("ochtend-datum").value = vandaag; return "ochtend"; } });
  }
  const doel = $("herinnering");
  doel.replaceChildren();
  if (items.length) {
    const kaart = el("div", "herinnering");
    kaart.append(el("span", null, "Nog ingeven:"));
    for (const item of items) {
      const knop = el("button", null, item.tekst);
      knop.onclick = () => {
        kies("pijn");
        const soort = item.ga();
        keuze[soort] = null; bericht(soort, ""); vernieuw(soort);
        $(`${soort}-veld`).scrollIntoView({ behavior: "smooth", block: "start" });
        ($(`${soort}-scores`).firstElementChild                      )?.focus({ preventScroll: true });
      };
      kaart.append(knop);
    }
    doel.append(kaart);
  }
  doel.hidden = !items.length;
  toonMeldingen();
}

// --- Start ------------------------------------------------------------------------------

$                 ("sleutel-form").onsubmit = (e) => {
  e.preventDefault();
  const sleutel = $                  ("sleutel-veld").value.trim();
  if (!/^[A-Za-z0-9_-]{8,}$/.test(sleutel)) {
    $("sleutel-bericht").textContent = "Dat lijkt geen API-sleutel van intervals.icu. Kopieer ze opnieuw.";
    $("sleutel-bericht").className = "bericht fout";
    return;
  }
  opslag.zet(SLEUTEL, sleutel);
  $                  ("sleutel-veld").value = "";
  $("sleutel").hidden = true;
  $("laden").hidden = false;
  void laad();
};

// de bestanden van de pagina op het toestel houden, voor zonder verbinding (eerst het netwerk, dus altijd de nieuwste versie)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* zonder service worker werkt de pagina ook, alleen niet offline */ });
}

addEventListener("online", () => void laad());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void laad(); });
void laad();
