// De pagina-data: alles wat de pagina toont, en de keuzes die ze maakt (standaardtraining, herinneringen,
// ernst van een waarschuwing). De pagina tekent alleen; zo is wat ze beslist getest. Bevat nooit de API-sleutel.

                                                         
                                                
import { dagenTussen, maandag, plusDagen, weekdag,            } from "./datum.js";
import * as momentopname from "./momentopname.js";
                                                
import { pyRound } from "./py.js";
import * as regels from "./regels.js";
import * as seizoen from "./seizoen.js";

export const ACHTER_MARGE_FITHEID = 3;
const ROOD = new Set(["kniepijn", "ochtendpijn", "kine"]);

// Bewust verschillend: de pagina toont een voorstel als dat er is (met "nog geen akkoord" erbij), maar het
// geplande loopvolume telt alleen wat akkoord heeft. De notities in intervals.icu bevatten nooit een voorstel.
function weekplanKort(plan     ) {
  const huidig = plan.voorstel || plan.akkoord;
  return { week: plan.week, status: plan.status, trainingen: huidig.trainingen, uitleg: huidig.uitleg ?? null };
}

/** De week op de pagina: deze week, of volgende week zodra die akkoord heeft. */
async function weekschema(opslag        , vandaag       ) {
  const deze = maandag(vandaag);
  const volgende = plusDagen(deze, 7);
  const planVolgende = await opslag.weekplan(volgende);
  if (planVolgende && planVolgende.akkoord) {
    return { week: volgende, weekplan: weekplanKort(planVolgende), volgende_week: null };
  }
  const plan = await opslag.weekplan(deze);
  let vooruit                                        ;
  if (planVolgende && planVolgende.voorstel) vooruit = { week: volgende, status: "voorstel" };
  else if (weekdag(vandaag) === 6) vooruit = { week: volgende, status: "geen" };
  else vooruit = null;
  return { week: deze, weekplan: plan ? weekplanKort(plan) : null, volgende_week: vooruit };
}

async function geplandLoopvolume(opslag        , week       )                         {
  const plan = await opslag.weekplan(week);
  if (!plan) return null;
  const huidig = plan.akkoord || plan.voorstel;
  return (huidig.trainingen         ).filter((t) => t.soort === "loopje").reduce((som, t) => som + t.duur_min, 0);
}

async function checkpoints(opslag        , wedstrijden                     ) {
  const weken = (await opslag.profiel()).drempels.kine_checkpoint_weken;
  const afgevinkt = (await opslag.checkpoints()).afgevinkt;
  return wedstrijden.filter((w) => w.prioriteit === "A").map((w) => ({
    datum: plusDagen(w.datum, -7 * weken), wedstrijd: w.datum, afgevinkt: w.datum in afgevinkt,
  }));
}

async function progressie(opslag        , status        , vandaag       ) {
  const seizoensplan = status.seizoensplan;
  if (!seizoensplan) {
    return { leeg: true         , melding: "Nog geen seizoensplan. Geef een wedstrijd door met /wedstrijd, dan maakt " +
      "de coach een seizoensplan met fases richting je A-wedstrijd." };
  }
  const start        = seizoensplan.start || seizoensplan.fases[0].van;
  const doeldag        = seizoensplan.doel.datum;
  const werkelijk = new Map(status.loopvolume_per_week.map((w) => [w.week, w.minuten]));
  const fietstijd = new Map(status.fietstijd_per_week.map((w) => [w.week, w.minuten]));
  const loopvolume = [];
  for (let week = maandag(start); week <= maandag(doeldag); week = plusDagen(week, 7)) {
    const fase = seizoen.faseOp(seizoensplan, week);
    loopvolume.push({
      week,
      gepland: await geplandLoopvolume(opslag, week),
      richtvolume: fase ? fase.richtvolume_min : null,
      werkelijk: week <= vandaag ? werkelijk.get(week) ?? null : null,
      fietstijd: week <= vandaag ? fietstijd.get(week) ?? null : null,
      richtvolume_fiets_uur: fase ? fase.richtvolume_fiets_uur ?? null : null,
    });
  }

  const huidig = status.belasting.fitheid;
  const startFitheid = seizoensplan.start_fitheid ?? null, streef = seizoensplan.streef_fitheid ?? null;
  let verwacht                = null;
  if (startFitheid !== null && streef !== null && doeldag > start) {
    const aandeel = Math.min(Math.max(dagenTussen(start, vandaag) / dagenTussen(start, doeldag), 0), 1);
    verwacht = pyRound(startFitheid + (streef - startFitheid) * aandeel, 1);
  }
  return {
    leeg: false         ,
    seizoensplan,
    huidige_fase: status.huidige_fase,
    loopvolume,
    aftelling: { week: Math.floor(dagenTussen(maandag(start), maandag(vandaag)) / 7) + 1,
                 weken: loopvolume.length, dagen: dagenTussen(vandaag, doeldag) },
    checkpoints: await checkpoints(opslag, status.wedstrijden),
    fitheid: { huidig, verwacht, streef, streefdatum: doeldag, start: { datum: start, waarde: startFitheid } },
  };
}

                                                         

function indicator(waarschuwingen                       , prog            , vandaag       ) {
  if (waarschuwingen.length) return { stand: "pas op", uitleg: "Er zijn waarschuwingen. Lees ze en volg het advies." };
  if (!prog.leeg) {
    const fitheid = prog.fitheid;
    if (fitheid.huidig !== null && fitheid.verwacht !== null && fitheid.huidig < fitheid.verwacht - ACHTER_MARGE_FITHEID) {
      return { stand: "achter", uitleg: `Je fitheid (${fitheid.huidig}) ligt onder de lijn naar je ` +
        `streefwaarde (${fitheid.verwacht} verwacht vandaag).` };
    }
    // alleen afgelopen weken: een week die nog loopt, is nog niet achter
    const vorige = prog.loopvolume.filter((w) => w.gepland && w.werkelijk !== null && plusDagen(w.week, 6) < vandaag);
    const laatste = vorige[vorige.length - 1];
    if (laatste && laatste.werkelijk  < 0.8 * laatste.gepland ) {
      return { stand: "achter", uitleg: `In de week van ${laatste.week} liep je ` +
        `${laatste.werkelijk} van de ${laatste.gepland} geplande minuten.` };
    }
  }
  return { stand: "op schema", uitleg: "Geen waarschuwingen en de opbouw loopt volgens plan." };
}

// Voor het oordeel over de vorm: welke waarschuwingen wegen het zwaarst, en hoe ze daar heten
const PIJN_SIGNAAL                         = { kniepijn: "Kniepijn: zie Pijn", ochtendpijn: "Ochtendpijn: zie Pijn" };
const MIN_DAGEN_VORM = 7;

const VORM_ZIN                                  = {
  "uitgerust": "Je bent uitgerust en er zijn geen signalen van overbelasting.",
  "normaal": "Je vorm zit in de normale zone en er zijn geen signalen van overbelasting.",
  "zware opbouw": "Je traint meer dan je gewend bent. Dat maakt je sterker, als er nu rustige dagen volgen.",
  "overbelast": "Je vermoeidheid ligt veel hoger dan je fitheid: je bent overbelast. Neem rust tot je vorm uit de rode zone is.",
};

/** Het oordeel bovenaan de tab Belasting: in orde, let op of overbelast. Het zwaarste signaal wint. */
function vormOordeel(status        , drempels                     ) {
  const metFitheid = status.wellness.filter((w) => w.fitheid !== null && w.vermoeidheid !== null);
  const zone = regels.vormzone(status.belasting.vorm, drempels);
  // de vorm zelf toont de grafiek al; de andere waarschuwingen staan bovenaan uitgelegd
  const andere = status.waarschuwingen.filter((w) => w.code !== "vorm");
  const rood = andere.filter((w) => ROOD.has(w.code));
  const signalen = andere.map((w) => PIJN_SIGNAAL[w.code] ?? w.titel);
  let stand                                            , zin        ;
  if (zone === "overbelast" || rood.length) {
    stand = "overbelast";
    zin = zone === "overbelast" ? VORM_ZIN.overbelast
      : "Er is een waarschuwing die je moet volgen. Lees het advies bovenaan en doe het rustig aan.";
  } else if (zone === "zware opbouw" || andere.length) {
    stand = "let op";
    zin = andere.length ? "Je lichaam geeft signalen dat het minder goed herstelt. Lees het advies bovenaan."
      : VORM_ZIN["zware opbouw"];
  } else if (zone) {
    stand = "in orde";
    zin = VORM_ZIN[zone];
  } else {
    stand = null;
    zin = "Nog geen gegevens over je vorm.";
  }
  return { stand, zin, signalen, vormzone: zone, weinig_gegevens: metFitheid.length > 0 && metFitheid.length < MIN_DAGEN_VORM };
}

/** Wat er deze week al gedaan is, voor de grote cijfers en de kaart Vandaag. */
function dezeWeek(status        , vandaag       ) {
  const ma = maandag(vandaag);
  const opbouw = status.opbouw.weken.find((w) => w.week === ma);
  const gelopen = status.loopvolume_per_week.find((w) => w.week === ma)?.minuten ?? 0;
  const gedaan = status.activiteiten.filter((a) => ma <= a.datum && a.datum <= vandaag).map((a) => ({
    datum: a.datum, soort: regels.soortVan({ type: a.type }), naam: a.naam, minuten: a.minuten,
  }));
  return { loopvolume: { gelopen, toegelaten: opbouw ? opbouw.toegelaten : null }, gedaan };
}

/** `gemaakt_op` is het tijdstip van de berekening, tot op de minuut (`2026-11-08T21:05`). */
export async function paginaData(intervals           , opslag        , vandaag       , gemaaktOp        ) {
  const status = await momentopname.status(intervals, opslag, vandaag);
  const [schaal, profiel, oefeningen] = await Promise.all([opslag.pijnschaal(), opslag.profiel(), opslag.oefeningen()]);
  const belastingPerDag = new Map               ();
  for (const activiteit of status.activiteiten) {
    belastingPerDag.set(activiteit.datum, (belastingPerDag.get(activiteit.datum) ?? 0) + (activiteit.belasting || 0));
  }
  const prog = await progressie(opslag, status, vandaag);
  const kine = profiel.kine;
  const gisteren = plusDagen(vandaag, -1);
  // de trainingen van de laatste week, nieuwste eerst, om er op de pagina kniepijn bij te zetten
  const recent = status.activiteiten.filter((a) => a.datum >= plusDagen(vandaag, -7)).reverse().map((a) => ({
    id: a.id, datum: a.datum, naam: a.naam, type: a.type, soort: regels.soortVan({ type: a.type }), minuten: a.minuten,
    kniepijn: a.kniepijn,
  }));
  // loopjes van gisteren en vandaag zonder kniepijn: de pijnregel draait om het lopen
  const zonderKniepijn = status.activiteiten
    .filter((a) => regels.LOOPTYPES.has(a.type ?? "") && a.kniepijn === null && a.datum >= gisteren);
  // standaard bij het ingeven van kniepijn: zo'n loopje, anders de laatste training
  const standaard = recent.find((a) => a.soort === "loopje" && a.kniepijn === null && a.datum >= gisteren) ?? recent[0];
  return {
    momentopname: vandaag,
    gemaakt_op: gemaaktOp,
    indicator: indicator(status.waarschuwingen, prog, vandaag),
    waarschuwingen: status.waarschuwingen.map((w) => ({ ...w, ernst: ROOD.has(w.code) ? "rood" : "gewoon" })),
    voorstellen: status.voorstellen,
    ...(await weekschema(opslag, vandaag)),
    pijn: {
      kniepijn: status.activiteiten.filter((a) => a.kniepijn !== null)
        .map((a) => ({ datum: a.datum, score: a.kniepijn, training: a.naam })),
      ochtendpijn: status.wellness.filter((w) => w.ochtendpijn !== null)
        .map((w) => ({ datum: w.datum, score: w.ochtendpijn })),
      // voor de herinnering: loopjes van gisteren en vandaag zonder kniepijn (de pijnregel draait om het lopen)
      loopjes_zonder_kniepijn: zonderKniepijn.map((a) => ({ id: a.id, datum: a.datum, training: a.naam })),
      standaard_kniepijn: standaard?.id ?? null,
      grens: schaal.grens,
      schaal: schaal.schaal,
      uitleg: schaal.uitleg,
      ochtendtest: schaal.ochtendtest,
      kniepijn_uitleg: schaal.kniepijn,
    },
    belasting: status.wellness.map((w) => ({
      datum: w.datum, belasting: belastingPerDag.get(w.datum) ?? 0, fitheid: w.fitheid,
      vermoeidheid: w.vermoeidheid, vorm: w.vorm, vormzone: regels.vormzone(w.vorm, profiel.drempels),
    })),
    vorm_oordeel: vormOordeel(status, profiel.drempels),
    vormzones: regels.vormzones(profiel.drempels),
    toegelaten_loopvolume: status.toegelaten_loopvolume,
    deze_week: dezeWeek(status, vandaag),
    // voor de blokjesgrafiek: hoogte = intensiteit t.o.v. LTHR of FTP, met de grens van zone 2
    zones: { lthr: status.profiel.lthr, loop_z2_max: status.profiel.loop_z2_max, ftp: status.profiel.ftp },
    fietstijd_deze_week: status.fietstijd_per_week.find((w) => w.week === maandag(vandaag))?.minuten ?? 0,
    ftp: status.ftp,
    kine: { oefeningen: kine.oefeningen ?? [], grenzen: kine.grenzen ?? [] },
    oefeningen,
    wedstrijden: status.wedstrijden,
    activiteiten_recent: recent,
    // bovenaan de pagina: wat de atleet nog moet ingeven
    herinneringen: [
      ...zonderKniepijn.map((a) => ({ soort: "knie"         , activiteit: a.id,
                                      tekst: `Knie na loopje ${a.datum === vandaag ? "vandaag" : "gisteren"}` })),
      ...(status.wellness.some((w) => w.datum === vandaag && w.ochtendpijn !== null)
        ? [] : [{ soort: "ochtend"         , datum: vandaag, tekst: "Ochtendpijn" }]),
    ],
    progressie: prog,
  };
}
