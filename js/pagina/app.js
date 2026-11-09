// De pagina op de gsm en de Mac: leest intervals.icu live, rekent met dezelfde regels als de coach, en zet pijnscores en de
// Garmin-FTP rechtstreeks in intervals.icu. Zonder verbinding toont ze de laatste momentopname en bewaart ze wat je
// ingeeft tot er weer verbinding is. De sleutel staat alleen in de browseropslag van de gsm en van één web-app op de Mac.

import { AdapterFout,          } from "../bronnen.js";
import { paginaData } from "../paginadata.js";
import { lokaalTijdstip, lokaleDatum,            } from "../datum.js";
import { Intervals,             } from "../intervals.js";
import { ftpFout, PIJN_MAX, PIJN_MIN } from "../invoer.js";
import { browserTransport, GeenVerbinding, INTERVALS, NotitieOpslag } from "./bronnen.js";
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
  return lokaleDatum(new Date());
}

/** Alleen op de eigen Mac (proefserver) praat de pagina met een nagebootste intervals.icu op hetzelfde adres. */
function apiBasis()         {
  return ["localhost", "127.0.0.1"].includes(location.hostname) ? `${location.origin}/api/v1` : INTERVALS;
}

// --- Invoer: wat je ingeeft, gaat rechtstreeks naar intervals.icu ---------------------

             
                                                                                              
                                                      
                                                   


async function schrijf(intervals           , invoer        )                {
  if (invoer.soort === "knie") await intervals.zetKniepijn(invoer.activiteit, invoer.waarde);
  else if (invoer.soort === "ochtend") await intervals.zetOchtendpijn(invoer.datum, invoer.waarde);
  else await intervals.zetGarminFtp(invoer.datum, invoer.waarde);
}

function wachtrij()           {
  return opslag.json          (WACHTRIJ, []);
}

/** Wat offline ingegeven is, alsnog versturen. Geeft het aantal verstuurde items. */
async function verstuurWachtrij(intervals           )                  {
  const rest           = [];
  let verstuurd = 0;
  for (const invoer of wachtrij()) {
    try {
      await schrijf(intervals, invoer);
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
  // de eigen velden: uit de laatste momentopname, tot de gegevensnotitie geladen is
  let velden                = opslag.json                     (LAATSTE, null)?.velden ?? null;
  const intervals = new Intervals(browserTransport(sleutel, apiBasis()), () => {
    if (!velden) throw new AdapterFout("De gegevens van de coach zijn nog niet geladen.");
    return velden;
  });
  try {
    if (velden && wachtrij().length) await verstuurWachtrij(intervals);
    const vandaag = vandaagLokaal();
    const notities = await NotitieOpslag.laad(intervals, vandaag);
    // de velden uit de gegevensnotitie: nodig om activiteiten en wellness te lezen
    const geladen = (await notities.profiel()).velden          ;
    velden = geladen;
    const D = await paginaData(intervals, notities, vandaag, lokaalTijdstip(new Date(), false));
    if (wachtrij().length) await verstuurWachtrij(intervals);
    opslag.zet(LAATSTE, JSON.stringify({ D, velden: geladen }));
    teken({ D, velden: geladen }, intervals, "");
  } catch (fout) {
    const laatste = opslag.json                     (LAATSTE, null);
    if (fout instanceof AdapterFout && !(fout instanceof GeenVerbinding) && /sleutel/.test(fout.message)) {
      vraagSleutel(fout.message);
    } else if (laatste) {
      const melding = fout instanceof GeenVerbinding ? "Geen verbinding" : (fout         ).message;
      teken(laatste, intervals, `${melding}: dit is de laatste momentopname, van ${laatste.D.gemaakt_op.slice(11, 16)}` +
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

function teken(m              , intervals           , verbinding        )       {
  $("laden").hidden = true;
  $("sleutel").hidden = true;
  $("inhoud").hidden = false;
  const hulp = toon(m.D);
  const open = wachtrij().length;
  $("verbinding").textContent = [verbinding, open ? `${open} ingave${open > 1 ? "n" : ""} wacht${open > 1 ? "en" : ""} op verbinding.` : ""]
    .filter(Boolean).join(" ");
  $("verbinding").className = "bericht" + (verbinding ? " fout" : "");
  bindInvoer(m, intervals, hulp);
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

                                    

// Wat je in het pijnblok koos. Dit blijft staan als de pagina na het bewaren opnieuw tekent.
const pijnStand                                                                                                                =
  { soort: null, open: false, waarKiezen: false, training: null, datum: null };

function bindInvoer(m              , intervals           , hulp     )       {
  const { D } = m;
  const { kies, toonMeldingen, kort, el } = hulp;
  const vandaag = vandaagLokaal();
  $("pijninvoer").hidden = false;
  $("ftp-invoer").hidden = false;
  const ftpDatum = $                  ("ftp-datum");
  ftpDatum.value = vandaag;
  ftpDatum.max = vandaag;
  const ochtendDatum = $                  ("ochtend-datum");
  ochtendDatum.max = vandaag;
  ochtendDatum.value = pijnStand.datum ?? vandaag;

                                                          
  const bericht = (soort                 , tekst        , cls = "", herstel          ) => {
    const b = $(soort === "ftp" ? "ftp-bericht" : "pijn-bericht");
    b.replaceChildren(tekst);
    b.className = "bericht" + (cls ? ` ${cls}` : "");
    if (!herstel) return;
    const knop = el("button", "link", "ongedaan maken");
    knop.onclick = () => void geefIn(herstel.invoer, herstel.omschrijving);
    b.append(knop);
  };

  async function geefIn(invoer        , omschrijving        , herstel          )                {
    bericht(invoer.soort, "Bezig…");
    try {
      await schrijf(intervals, invoer);
      bericht(invoer.soort, `✓ ${omschrijving} bewaard. De pagina rekent opnieuw…`, "ok");
      await laad();
      bericht(invoer.soort, `✓ ${omschrijving} bewaard.`, "ok", herstel);
    } catch (fout) {
      if (fout instanceof GeenVerbinding) {
        opslag.zet(WACHTRIJ, JSON.stringify([...wachtrij(), invoer]));
        bericht(invoer.soort, `Geen verbinding: ${omschrijving} wacht op dit toestel tot er verbinding is.`, "ok", herstel);
      } else {
        bericht(invoer.soort, `Dat lukte niet: ${(fout         ).message}`, "fout");
      }
    }
  }

  // --- Het pijnblok: één schakelaar Knie | Ochtend, de training of dag als tekst, één tik op een score bewaart ---

  const trainingen        = D.activiteiten_recent ?? [];
  // een kort label van de pagina zelf: een naam uit Garmin kan eindeloos lang zijn
  const label = (a     ) => `${DAG.format(new Date(`${a.datum}T12:00:00`))} · ${SOORTNAAM[a.soort] ?? a.type} · ${a.minuten} min`;
  const keuzeKnie = $                   ("knie-training");
  keuzeKnie.replaceChildren();
  for (const a of trainingen) {
    const optie = el("option", null, label(a) + (a.kniepijn != null ? ` · nu ${a.kniepijn}` : ""));
    optie.value = String(a.id);
    keuzeKnie.append(optie);
  }
  // de standaard kiest de pagina-data (een loopje van gisteren of vandaag zonder score, anders de laatste training)
  const standaard = trainingen.find((a) => String(a.id) === pijnStand.training)
    ?? trainingen.find((a) => a.id === D.pijn.standaard_kniepijn) ?? trainingen[0];
  if (standaard) keuzeKnie.value = String(standaard.id);

  const training = () => trainingen.find((a) => String(a.id) === keuzeKnie.value);
  const ochtendOp = (datum       )                => D.pijn.ochtendpijn.find((p     ) => p.datum === datum)?.score ?? null;
  const huidig = (soort           )                =>
    soort === "knie" ? training()?.kniepijn ?? null : ochtendOp(ochtendDatum.value || vandaag);

  // wat nog in te geven is (de herinneringen); 's ochtends eerst de ochtendpijn
  const ontbreekt = new Set(((D.herinneringen ?? [])         ).map((h) => h.soort             ));
  const soortNu = ()            => {
    if (!trainingen.length) return "ochtend";
    if (pijnStand.soort) return pijnStand.soort;
    if (ontbreekt.has("ochtend") && (!ontbreekt.has("knie") || new Date().getHours() < 12)) return "ochtend";
    return "knie";
  };

  // alles ingegeven en nog niets aangeraakt: één regel
  const ingeklapt = !ontbreekt.size && !pijnStand.open && !pijnStand.soort;
  $("pijn-klaar").hidden = !ingeklapt;
  $("pijn-blok").hidden = ingeklapt;
  if (ingeklapt) {
    const laatsteKnie = trainingen.find((a) => a.kniepijn != null);
    $("pijn-klaar-tekst").textContent = `Ingegeven: ochtend ${ochtendOp(vandaag) ?? "–"}` +
      (laatsteKnie ? ` · knie ${laatsteKnie.kniepijn} (${DAG.format(new Date(`${laatsteKnie.datum}T12:00:00`))})` : "");
  }
  $("pijn-open").onclick = () => { pijnStand.open = true; $("pijn-klaar").hidden = true; $("pijn-blok").hidden = false; toonPijn(); };

  const scores = $("pijn-scores");
  scores.replaceChildren();
  for (let i = PIJN_MIN; i <= PIJN_MAX; i++) {
    const k = el("button", i > D.pijn.grens ? "boven" : null, String(i));
    k.onclick = () => {
      const soort = soortNu();
      const vorige = huidig(soort);
      if (i === vorige) return;
      pijnStand.soort = soort;
      for (const b of scores.children) b.setAttribute("aria-pressed", String(b === k));
      if (soort === "knie") {
        const a = training();
        if (!a) return;
        pijnStand.training = String(a.id);
        const invoer = (waarde        )         => ({ soort, activiteit: a.id, naam: a.naam, datum: a.datum, waarde });
        void geefIn(invoer(i), `Kniepijn ${i} (${kort(a.datum)})`,
          vorige == null ? undefined : { invoer: invoer(vorige), omschrijving: `Kniepijn terug op ${vorige}` });
      } else {
        const datum = ochtendDatum.value || vandaag;
        pijnStand.datum = datum;
        void geefIn({ soort, datum, waarde: i }, `Ochtendpijn ${i} (${kort(datum)})`,
          vorige == null ? undefined : { invoer: { soort, datum, waarde: vorige }, omschrijving: `Ochtendpijn terug op ${vorige}` });
      }
    };
    scores.append(k);
  }

  function toonPijn()       {
    const soort = soortNu();
    const knopKnie = $("soort-knie"), knopOchtend = $("soort-ochtend");
    knopKnie.hidden = !trainingen.length;
    knopKnie.textContent = `Knie · ${huidig("knie") ?? "–"}`;
    knopOchtend.textContent = `Ochtend · ${huidig("ochtend") ?? "–"}`;
    knopKnie.setAttribute("aria-pressed", String(soort === "knie"));
    knopOchtend.setAttribute("aria-pressed", String(soort === "ochtend"));
    const datum = ochtendDatum.value || vandaag;
    const a = training();
    $("pijn-waar").textContent = soort === "knie"
      ? (a ? `na ${label(a)}` : "")
      : `ochtend van ${datum === vandaag ? "vandaag" : DAG.format(new Date(`${datum}T12:00:00`))}`;
    $("knie-keuze").hidden = !(pijnStand.waarKiezen && soort === "knie");
    $("ochtend-keuze").hidden = !(pijnStand.waarKiezen && soort === "ochtend");
    $("pijn-wijzig").setAttribute("aria-expanded", String(pijnStand.waarKiezen));
    scores.setAttribute("aria-label", `${soort === "knie" ? "Kniepijn" : "Ochtendpijn"} van 0 tot 10`);
    const nu = huidig(soort);
    for (const b of scores.children) b.setAttribute("aria-pressed", String(Number(b.textContent) === nu));
  }

  const kiesSoort = (soort           ) => { pijnStand.soort = soort; toonPijn(); };
  $("soort-knie").onclick = () => kiesSoort("knie");
  $("soort-ochtend").onclick = () => kiesSoort("ochtend");
  $("pijn-wijzig").onclick = () => { pijnStand.waarKiezen = !pijnStand.waarKiezen; toonPijn(); };
  keuzeKnie.onchange = () => { pijnStand.training = keuzeKnie.value; toonPijn(); };
  ochtendDatum.onchange = () => { pijnStand.datum = ochtendDatum.value || null; toonPijn(); };
  toonPijn();

  $("ftp-bewaar").onclick = () => {
    const waarde = Number($                  ("ftp-waarde").value);
    const fout = ftpFout(waarde);
    if (fout) {
      bericht("ftp", fout, "fout");
      $("ftp-waarde").focus();
      return;
    }
    const datum = $                  ("ftp-datum").value || vandaag;
    void geefIn({ soort: "ftp", datum, waarde }, `Garmin-FTP ${waarde} W op ${kort(datum)}`);
  };

  // Herinnering bovenaan: wat de pagina-data nog in te geven vindt; de knop opent het pijnblok op de juiste plaats
  const doel = $("herinnering");
  doel.replaceChildren();
  const items = (D.herinneringen ?? [])         ;
  if (items.length) {
    const kaart = el("div", "herinnering");
    kaart.append(el("span", null, "Nog ingeven:"));
    for (const h of items) {
      const knop = el("button", null, h.tekst);
      knop.onclick = () => {
        kies("pijn");
        pijnStand.soort = h.soort;
        pijnStand.open = true;
        if (h.soort === "knie") { keuzeKnie.value = String(h.activiteit); pijnStand.training = keuzeKnie.value; }
        else { ochtendDatum.value = h.datum; pijnStand.datum = h.datum; }
        $("pijn-klaar").hidden = true;
        $("pijn-blok").hidden = false;
        toonPijn();
        $("pijninvoer").scrollIntoView({ behavior: "smooth", block: "start" });
        (scores.firstElementChild                      )?.focus({ preventScroll: true });
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
