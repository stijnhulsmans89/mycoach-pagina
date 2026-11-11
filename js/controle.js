// Voorstelcontrole: het weekritme en de verdeelregels, zonder in- of uitvoer.
//
// Een training in een voorstel heeft minstens `datum`, `soort` (loopje, mtb, rollen of kracht) en `duur_min`.
// Optioneel: `hartslag_max`, `zone`, `belasting`, `hard`, `doel` (hartslag of wattage), `ramptest` en, bij kracht,
// `rondes` (het circuit), `rust_oefening_s`, `rust_ronde_s` en `oefeningen`: elk met een `code` uit de
// oefeningenlijst (`data/oefeningen.json`), `herhalingen` en optioneel `stap` (korte naam op het horloge).

                                                  
import { dagenTussen, plusDagen,            } from "./datum.js";
import { FIETSSOORTEN as FIETSEN, TREDEN } from "./regels.js";

// een tijd zoals 3s, 1m, 2h of 10' in een stapnaam leest intervals.icu als de duur van de stap
const TIJD_IN_STAP = /\d+\s*(s|m|h|min|sec|'|")(?![a-z])/i;

export const SOORTEN = ["loopje", "mtb", "rollen", "kracht"];

                                                              

                          
                     
                      
                     
                      
                        
                                
                                                                         
                      
                  
               
                            
 

/** De belasting uit het voorstel; voor een MTB-rit zonder schatting ongeveer één per minuut. */
export function geschatteBelasting(training     )         {
  if (training.belasting != null) return training.belasting;
  return training.soort === "mtb" ? training.duur_min : 0;
}

export function isHard(training     , drempels          )          {
  return Boolean(
    training.hard
    || training.intensiteit
    || training.ramptest
    || (training.zone || 0) > 2
    || geschatteBelasting(training) > drempels.harde_training_belasting,
  );
}

/** Gelijkheid zoals Python `==` op JSON-waarden. */
export function gelijk(a         , b         )          {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length &&
    ka.every((k) => k in b && gelijk((a                           )[k], (b                           )[k]));
}

function overtreding(regel        , uitleg        )              {
  return { regel, uitleg };
}

function isGeheel(waarde         )                   {
  // Python telt True als geheel getal (bool is een int)
  return Number.isInteger(waarde) || typeof waarde === "boolean";
}

/**
 * Geeft de overtredingen van een voorstel terug. Een lege lijst betekent geldig.
 * `vast` zijn trainingen die al voorbij zijn en niet meer veranderen (bij een bijsturing).
 */
export function controleer(voorstel     , context         )                {
  const drempels = context.drempels;
  const week        = voorstel.week;
  const weekdagen = Array.from({ length: 7 }, (_, i) => plusDagen(week, i));
  const eigen        = voorstel.trainingen;
  const trainingen        = [...(context.vast ?? []), ...eigen];
  const beschikbaarheid      = voorstel.beschikbaarheid || {};
  const overtredingen                = [];
  const inVoorstel = (t     ) => eigen.some((e) => gelijk(e, t));

  for (const t of eigen) {
    if (!SOORTEN.includes(t.soort)) {
      overtredingen.push(overtreding("soort", `'${t.soort ?? "None"}' op ${t.datum} is geen loopje, mtb, rollen of kracht.`));
    }
    if (!weekdagen.includes(t.datum)) {
      overtredingen.push(overtreding("buiten_week", `${t.datum} valt niet in de week van ${voorstel.week} (maandag tot zondag).`));
    }
  }

  const lijst      = context.oefeningen ?? {};
  for (const t of eigen) {
    for (const o of t.oefeningen || []) {
      const oefening = Object.hasOwn(lijst, o.code) ? lijst[o.code] : undefined;
      if (oefening == null) {
        overtredingen.push(overtreding(
          "oefening_onbekend", `'${o.naam ?? "None"}' op ${t.datum} heeft geen code uit de oefeningenlijst; ` +
            "elke oefening heeft een figuurtje nodig voor ze in een weekplan komt."));
      } else if (!oefening.goedgekeurd) {
        overtredingen.push(overtreding(
          "oefening_niet_goedgekeurd", `Het figuurtje van '${oefening.naam}' (${o.code}) is nog niet ` +
            "goedgekeurd door de atleet."));
      }
    }
  }

  // kracht is een circuit: één aantal rondes, per oefening alleen herhalingen (zie spec kracht-garmin)
  for (const t of eigen) {
    if (t.soort !== "kracht" || !t.oefeningen?.length) continue;
    if (!isGeheel(t.rondes) || Number(t.rondes) < 1) {
      overtredingen.push(overtreding(
        "kracht_circuit", `De krachttraining van ${t.datum} is een circuit en heeft een aantal \`rondes\` nodig.`));
    }
    for (const o of t.oefeningen) {
      if ("sets" in o) {
        overtredingen.push(overtreding(
          "kracht_circuit", `'${o.naam ?? "None"}' op ${t.datum} heeft eigen sets; in een circuit tellen alleen ` +
            "de rondes van de training."));
      }
      if (o.stap && TIJD_IN_STAP.test(o.stap)) {
        overtredingen.push(overtreding(
          "kracht_circuit", `De stapnaam '${o.stap}' op ${t.datum} bevat een tijd; intervals.icu leest die ` +
            "als de duur van de stap. Schrijf bv. '3 tel' in plaats van '3s'."));
      }
      if (!o.herhalingen) {
        overtredingen.push(overtreding("kracht_circuit", `'${o.naam ?? "None"}' op ${t.datum} heeft geen \`herhalingen\`.`));
      }
    }
  }

  const loopjes = trainingen.filter((t) => t.soort === "loopje")
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  const zondag = weekdagen[6];
  if (!beschikbaarheid.geen_mtb && !trainingen.some((t) => t.soort === "mtb" && t.datum === zondag)) {
    overtredingen.push(overtreding("mtb_zondag", "De mountainbike op zondag ligt vast in het weekritme en ontbreekt."));
  }

  const vereist = context.vereiste_loopjes ?? 2;
  if (loopjes.length > 2 || loopjes.length < vereist) {
    overtredingen.push(overtreding("twee_loopjes", `Het weekritme vraagt twee loopjes, het voorstel heeft er ${loopjes.length}.`));
    if (loopjes.length < vereist && eigen.some((t) => t.soort === "rollen" || t.soort === "kracht")) {
      overtredingen.push(overtreding(
        "loopjes_eerst", "Bij weinig tijd valt eerst de tweede krachttraining weg, dan het rollen; een loopje " +
          "wordt korter, maar valt niet weg."));
    }
  }

  // Een volledig weekplan (geen bijsturing): wat er bij weinig tijd wegvalt, gebeurt in een vaste volgorde.
  if (context.vast === undefined) {
    const kracht = trainingen.filter((t) => t.soort === "kracht");
    if (!kracht.length) {
      overtredingen.push(overtreding(
        "kracht_blijft", "Er is geen krachttraining. Eén krachttraining blijft altijd: ze is je revalidatie bij de kine."));
    }
    if (kracht.length >= 2 && !trainingen.some((t) => t.soort === "rollen")) {
      overtredingen.push(overtreding(
        "weglaten_volgorde", "Het rollen valt weg terwijl er twee krachttrainingen zijn. Bij weinig tijd valt eerst " +
          "de tweede krachttraining weg, pas daarna het rollen."));
    }
  }

  for (const t of eigen) {
    if (t.soort === "mtb" && !t.hartslag_max) {
      overtredingen.push(overtreding(
        "mtb_doel", `De MTB-rit van ${t.datum} heeft een hartslagdoel nodig (\`hartslag_max\`): buiten heb je ` +
          "geen vermogen, dus de rit wordt op hartslag gestuurd, rustig of hard."));
    }
  }

  for (let i = 0; i + 1 < loopjes.length; i++) {
    const [eerste, tweede] = [loopjes[i], loopjes[i + 1]];
    if (dagenTussen(eerste.datum, tweede.datum) < 2) {
      overtredingen.push(overtreding(
        "48_uur", `Tussen de loopjes van ${eerste.datum} en ${tweede.datum} zit minder dan 48 uur; je pees heeft die tijd nodig om te herstellen.`));
    }
  }

  const trainingsdagen = new Set(trainingen.map((t) => t.datum));
  if (weekdagen.every((dag) => trainingsdagen.has(dag))) {
    overtredingen.push(overtreding("rustdag", "Er is geen rustdag. Elke week heeft minstens één dag zonder training."));
  }

  const harde = trainingen.filter((t) => isHard(t, drempels));
  const maximum = context.harde_trainingen_max ?? drempels.max_harde_trainingen;
  if (harde.length > maximum) {
    overtredingen.push(overtreding(
      "harde_trainingen",
      `Het voorstel heeft ${harde.length} harde trainingen (${harde.map((t) => t.datum).join(", ")}); ` +
        `voorlopig mag er hoogstens ${maximum}.`));
  }
  if (harde.length > 1 && harde.some((t) => t.soort === "kracht")) {
    overtredingen.push(overtreding(
      "harde_trainingen", "Een tweede harde training is een fietstraining (of, na groen licht, een loopje met " +
        "intensiteit), geen krachttraining."));
  }
  const hardeLoopjes = harde.filter((t) => t.soort === "loopje");
  if (hardeLoopjes.length > 1) {
    overtredingen.push(overtreding(
      "harde_loopjes", `Er zijn ${hardeLoopjes.length} harde loopjes (${hardeLoopjes.map((t) => t.datum).join(", ")}); ` +
        "er is er hoogstens één per week, de rest van het lopen blijft rustig voor je pees."));
  }

  // intensiteit bij het lopen: pas na de voorwaarden (pijnregel, loopvolume, kine), en trede per trede
  const intensiteit = context.loopintensiteit || { toegelaten: false, trede: null };
  for (const t of loopjes) {
    if (!inVoorstel(t) || !isHard(t, drempels)) continue;
    if (!intensiteit.toegelaten) {
      overtredingen.push(overtreding(
        "loopintensiteit", `Het loopje van ${t.datum} heeft intensiteit, maar lopen blijft rustig tot de ` +
          "pijnregel vier weken op rij in orde is, het toegelaten loopvolume minstens 90 minuten " +
          "is en de kine groen licht gaf."));
    } else if (!TREDEN.includes(t.intensiteit) || TREDEN.indexOf(t.intensiteit) > TREDEN.indexOf(intensiteit.trede )) {
      overtredingen.push(overtreding(
        "loop_trede", `Het loopje van ${t.datum} vraagt '${t.intensiteit ?? "None"}', maar de trede van nu is ` +
          `'${intensiteit.trede}' (${TREDEN.join(", ")}; elke trede minstens twee weken).`));
    }
  }

  for (const t of loopjes) {
    if (inVoorstel(t) && !isHard(t, drempels)) {
      const plafond = t.hartslag_max;
      if (plafond == null || plafond > context.loop_z2_max) {
        overtredingen.push(overtreding(
          "rustig_loopje_hartslag",
          `Het rustige loopje van ${t.datum} moet een hartslagplafond van hoogstens ${context.loop_z2_max} hebben (zone 2), desnoods met wandelpauzes.`));
      }
    }
  }

  const loopvolume = loopjes.reduce((som, t) => som + t.duur_min, 0);
  // bij een bijsturing ligt wat al gelopen is vast: alleen nieuwe loopminuten kunnen te veel zijn
  const nieuweLoopminuten = eigen.filter((t) => t.soort === "loopje").reduce((som, t) => som + t.duur_min, 0);
  if (loopvolume > context.toegelaten && nieuweLoopminuten) {
    overtredingen.push(overtreding(
      "loopvolume", `Het loopvolume is ${loopvolume} minuten, meer dan de toegelaten ${context.toegelaten} minuten.`));
  }

  const niet = new Set        (beschikbaarheid.niet || []);
  const maxMin                         = beschikbaarheid.max_min || {};
  for (const [dag, max] of Object.entries(maxMin).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const totaal = eigen.filter((t) => t.datum === dag).reduce((som, t) => som + t.duur_min, 0);
    if (totaal > max) {
      overtredingen.push(overtreding("beschikbaarheid", `Op ${dag} is er hoogstens ${max} minuten, het voorstel plant er ${totaal}.`));
    }
  }
  for (const t of eigen) {
    if (niet.has(t.datum)) {
      overtredingen.push(overtreding("beschikbaarheid", `Op ${t.datum} ben je niet beschikbaar, maar er staat ${t.soort} gepland.`));
    }
  }

  if (context.stap_terug) {
    for (const t of eigen) {
      if (FIETSEN.includes(t.soort) && isHard(t, drempels)) {
        overtredingen.push(overtreding(
          "stap_terug_fietsen",
          `Na een overtreden pijnregel mag fietsen alleen pijnvrij en als rustige training; ${t.soort} op ${t.datum} is een harde training.`));
      }
    }
  }

  // Hard rollen mag, maar pas als de pijnregel een paar weken op rij in orde is; de Garmin-FTP is de
  // maatstaf voor de wattagezones, dus een ramptest is niet meer nodig (wel nog mogelijk).
  for (const t of eigen) {
    if (t.soort !== "rollen") continue;
    const nodig = drempels.harde_rol_na_weken_in_orde;
    if (isHard(t, drempels) && context.weken_in_orde < nodig) {
      overtredingen.push(overtreding(
        "harde_rol", `Een harde rit op de rollen komt pas als de pijnregel ${nodig} weken op rij in orde is ` +
          `(nu ${context.weken_in_orde}); ${t.datum} is een harde rit.`));
    }
    if (t.doel === "wattage" && !context.garmin_ftp) {
      overtredingen.push(overtreding(
        "rollen_op_hartslag", `Zolang er geen Garmin-FTP is, rol je op hartslag, niet op wattage (${t.datum}).`));
    }
  }
  return overtredingen;
}
