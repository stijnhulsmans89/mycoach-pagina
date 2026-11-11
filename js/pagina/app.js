// De pagina op de gsm en de Mac: leest intervals.icu live, rekent met dezelfde regels als de coach, en zet pijnscores en de
// Garmin-FTP rechtstreeks in intervals.icu. Zonder verbinding toont ze de laatste momentopname en bewaart ze wat je
// ingeeft tot er weer verbinding is. De sleutel staat alleen in de browseropslag van de gsm en van één web-app op de Mac.
//
// Wat je ingeeft, gaat eerst in een wachtrij op het toestel: zo telt een score meteen mee in het dagoordeel (ook
// offline), en kun je ze een paar seconden ongedaan maken voor ze naar intervals.icu gaat.

import { AdapterFout } from "../bronnen.js";
                                                 
import { metWachtend, paginaData,                  VERSIE } from "../paginadata.js";
import { lokaalTijdstip, lokaleDatum,            } from "../datum.js";
import { Intervals,             } from "../intervals.js";
import { ftpFout } from "../invoer.js";
import { browserTransport, GeenVerbinding, INTERVALS, NotitieOpslag } from "./bronnen.js";
// @ts-expect-error: weergave.js is gewoon JavaScript, zonder types
import { toon } from "./weergave.js";

const SLEUTEL = "mycoach-sleutel";
const LAATSTE = "mycoach-laatste";
const WACHTRIJ = "mycoach-wachtrij";
/** Zo lang kun je een score ongedaan maken voor ze naar intervals.icu gaat. */
const ONGEDAAN_MS = 5000;

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

// --- Invoer: eerst in de wachtrij, na een paar seconden naar intervals.icu ---------------------

               
                                                                                                     
                                                      
                                                  
                                 

async function schrijf(intervals           , invoer        )                {
  if (invoer.soort === "knie") await intervals.zetKniepijn(invoer.activiteit, invoer.waarde);
  else if (invoer.soort === "ochtend") await intervals.zetOchtendpijn(invoer.datum, invoer.waarde);
  else await intervals.zetGarminFtp(invoer.datum, invoer.waarde);
}

function wachtrij()           {
  return opslag.json          (WACHTRIJ, []);
}

function zetWachtrij(lijst          )       {
  if (lijst.length) opslag.zet(WACHTRIJ, JSON.stringify(lijst)); else opslag.wis(WACHTRIJ);
}

/** Wat in de wachtrij staat en niet meer ongedaan kan, alsnog versturen. Geeft het aantal verstuurde items. */
async function verstuurWachtrij(intervals           )                  {
  let verstuurd = 0;
  for (const invoer of wachtrij()) {
    if ((invoer.na ?? 0) > Date.now()) continue;
    try {
      await schrijf(intervals, invoer);
      verstuurd++;
      zetWachtrij(wachtrij().filter((i) => i.id !== invoer.id));
    } catch (fout) {
      if (!(fout instanceof GeenVerbinding)) {
        // een fout van intervals.icu zelf: niet blijven proberen, wel zeggen
        zetWachtrij(wachtrij().filter((i) => i.id !== invoer.id));
        toast(`Dat lukte niet: ${(fout         ).message}`);
      }
      break;
    }
  }
  return verstuurd;
}

/** De wachtende pijnscores, zoals het dagoordeel ze meetelt. */
function wachtend()             {
  return wachtrij().flatMap((i)             => i.soort === "knie" ? [{ soort: "knie", activiteit: i.activiteit, waarde: i.waarde }]
    : i.soort === "ochtend" ? [{ soort: "ochtend", datum: i.datum, waarde: i.waarde }] : []);
}

// --- Laden en tonen -------------------------------------------------------------------

                                                                        

let bezig = false;
let huidige                                                                       = null;
let intervals                   = null;

/** De laatste momentopname, alleen als ze van deze versie van de pagina is. */
function laatste()                      {
  const m = opslag.json                     (LAATSTE, null);
  return m && m.versie === VERSIE ? m : null;
}

async function laad()                {
  const sleutel = opslag.lees(SLEUTEL);
  if (!sleutel) return vraagSleutel();
  if (bezig) return;
  bezig = true;
  // de eigen velden: uit de laatste momentopname, tot de gegevensnotitie geladen is
  let velden                = laatste()?.velden ?? null;
  intervals = new Intervals(browserTransport(sleutel, apiBasis()), () => {
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
    if (wachtrij().length) await verstuurWachtrij(intervals);
    const D = await paginaData(intervals, notities, vandaag, lokaalTijdstip(new Date(), false));
    const m = { versie: VERSIE, D, velden: geladen };
    opslag.zet(LAATSTE, JSON.stringify(m));
    teken(m, false, null);
  } catch (fout) {
    const vorige = laatste();
    if (fout instanceof AdapterFout && !(fout instanceof GeenVerbinding) && /sleutel/.test(fout.message)) {
      vraagSleutel(fout.message);
    } else if (vorige) {
      teken(vorige, fout instanceof GeenVerbinding, fout instanceof GeenVerbinding ? null : (fout         ).message);
    } else {
      toonFout(fout instanceof GeenVerbinding
        ? (opslag.lees(LAATSTE) ? "Eerst verbinding nodig: de pagina is vernieuwd en haalt je gegevens opnieuw op zodra je verbinding hebt."
          : "Geen verbinding met intervals.icu. Probeer het opnieuw zodra je verbinding hebt.")
        : (fout         ).message);
    }
  } finally {
    bezig = false;
  }
}

function toonFout(tekst        )       {
  $("laden").hidden = false;
  $("laden-tekst").textContent = tekst;
  for (const s of $("laden").querySelectorAll(".skelet")) (s               ).hidden = true;
}

function vraagSleutel(fout = "")       {
  $("laden").hidden = true;
  $("inhoud").hidden = true;
  $("sleutel").hidden = false;
  $("sleutel-bericht").textContent = fout;
  $("sleutel-bericht").className = "bericht" + (fout ? " fout" : "");
  $                  ("sleutel-veld").focus();
}

function teken(m              , offline         , melding               )       {
  huidige = { m, offline, melding };
  $("laden").hidden = true;
  $("sleutel").hidden = true;
  $("inhoud").hidden = false;
  const open = wachtrij().length;
  toon(metWachtend(m.D, wachtend()), acties, { offline, melding, wacht: open, vandaag: vandaagLokaal() });
}

/** Opnieuw tekenen met de huidige momentopname, bv. na een score die nu in de wachtrij staat. */
function hertekenen()       {
  if (huidige) teken(huidige.m, huidige.offline, huidige.melding);
}

// --- Toast met ongedaan maken -----------------------------------------------------------

let toastTimer                                           ;

function toast(tekst        , ongedaan             , duur = ONGEDAAN_MS)       {
  clearTimeout(toastTimer);
  $("toast-tekst").textContent = tekst;
  $("toast-knop").hidden = !ongedaan;
  $("toast-knop").onclick = () => { ongedaan?.(); $("toast").hidden = true; };
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, duur);
}

let verstuurTimer                                           ;

/** Na het venster om ongedaan te maken: versturen en opnieuw rekenen. */
function planVersturen()       {
  clearTimeout(verstuurTimer);
  verstuurTimer = setTimeout(async () => {
    if (!intervals) return;
    await verstuurWachtrij(intervals);
    await laad();
  }, ONGEDAAN_MS + 100);
}

const acties = {
  /** Een score of FTP ingeven: meteen zichtbaar (wachtend), na een paar seconden naar intervals.icu. */
  geefIn(invoer        , omschrijving        , notitie                = null)       {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // een nieuwe score voor dezelfde training of dag vervangt de vorige die nog wacht
    const zelfde = (i        ) => i.soort === invoer.soort && (invoer.soort === "knie"
      ? String((i                           ).activiteit) === String(invoer.activiteit) : i.datum === invoer.datum);
    zetWachtrij([...wachtrij().filter((i) => !zelfde(i)), { ...invoer, id, na: Date.now() + ONGEDAAN_MS }]);
    hertekenen();
    toast(`${omschrijving} bewaard.${notitie ? ` ${notitie}` : ""}`, () => {
      zetWachtrij(wachtrij().filter((i) => i.id !== id));
      hertekenen();
    }, notitie ? ONGEDAAN_MS + 3000 : ONGEDAAN_MS);
    planVersturen();
  },
  ververs()       { void laad(); },
  vergeet()       {
    if (!confirm("De sleutel en de laatste momentopname op dit toestel wissen?")) return;
    for (const k of [SLEUTEL, LAATSTE, WACHTRIJ]) opslag.wis(k);
    vraagSleutel();
  },
  openFtp()       {
    const blad = $                   ("ftp-blad");
    $                  ("ftp-datum").value = vandaagLokaal();
    $                  ("ftp-datum").max = vandaagLokaal();
    $("ftp-bericht").textContent = "";
    blad.showModal();
    $("ftp-waarde").focus();
  },
};

$("ftp-bewaar").onclick = () => {
  const waarde = Number($                  ("ftp-waarde").value);
  const fout = ftpFout(waarde);
  if (fout) {
    $("ftp-bericht").textContent = fout;
    $("ftp-bericht").className = "bericht fout";
    $("ftp-waarde").focus();
    return;
  }
  const datum = $                  ("ftp-datum").value || vandaagLokaal();
  $                   ("ftp-blad").close();
  acties.geefIn({ soort: "ftp", datum, waarde }, `Garmin-FTP ${waarde} W`);
};
$("ftp-sluit").onclick = () => $                   ("ftp-blad").close();
$("ververs").onclick = () => { $("tijdstip").textContent = "Bezig met verversen…"; void laad(); };
for (const knop of document.querySelectorAll             ('[data-actie="vergeet"]')) knop.onclick = () => acties.vergeet();

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

// meteen de laatste momentopname, en stil verversen
const bewaard = laatste();
if (bewaard && opslag.lees(SLEUTEL)) teken(bewaard, false, null);
addEventListener("online", () => void laad());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void laad(); });
void laad();

