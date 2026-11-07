// De gegevens voor het dashboard. Bevat nooit de API-sleutel.

                                                         
import { dagenTussen, maandag, plusDagen, weekdag,            } from "./datum.js";
import * as momentopname from "./momentopname.js";
                                                
import { pyRound } from "./py.js";
import * as regels from "./regels.js";
import * as seizoen from "./seizoen.js";

export const ACHTER_MARGE_FITHEID = 3;
const ROOD = new Set(["kniepijn", "ochtendpijn", "kine"]);

function weekplanKort(plan     ) {
  const huidig = plan.voorstel || plan.akkoord;
  return { week: plan.week, status: plan.status, trainingen: huidig.trainingen, uitleg: huidig.uitleg ?? null };
}

/** De week op het dashboard: deze week, of volgende week zodra die akkoord heeft. */
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

function lokaalNuInMinuten()         {
  const nu = new Date();
  const twee = (n        ) => String(n).padStart(2, "0");
  return `${nu.getFullYear()}-${twee(nu.getMonth() + 1)}-${twee(nu.getDate())}T${twee(nu.getHours())}:${twee(nu.getMinutes())}`;
}

export async function dashboardData(adapter         , opslag        , vandaag       ) {
  const status = await momentopname.status(adapter, opslag, vandaag);
  const [schaal, profiel, oefeningen] = await Promise.all([opslag.pijnschaal(), opslag.profiel(), opslag.oefeningen()]);
  const belastingPerDag = new Map               ();
  for (const activiteit of status.activiteiten) {
    belastingPerDag.set(activiteit.datum, (belastingPerDag.get(activiteit.datum) ?? 0) + (activiteit.belasting || 0));
  }
  const prog = await progressie(opslag, status, vandaag);
  const kine = profiel.kine;
  const gisteren = plusDagen(vandaag, -1);
  return {
    momentopname: vandaag,
    gemaakt_op: lokaalNuInMinuten(),
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
      loopjes_zonder_kniepijn: status.activiteiten
        .filter((a) => regels.LOOPTYPES.has(a.type ?? "") && a.kniepijn === null && a.datum >= gisteren)
        .map((a) => ({ datum: a.datum, training: a.naam })),
      grens: schaal.grens,
      schaal: schaal.schaal,
      uitleg: schaal.uitleg,
      ochtendtest: schaal.ochtendtest,
      kniepijn_uitleg: schaal.kniepijn,
    },
    belasting: status.wellness.map((w) => ({
      datum: w.datum, belasting: belastingPerDag.get(w.datum) ?? 0, fitheid: w.fitheid,
      vermoeidheid: w.vermoeidheid, vorm: w.vorm,
    })),
    toegelaten_loopvolume: status.toegelaten_loopvolume,
    deze_week: dezeWeek(status, vandaag),
    // voor de blokjesgrafiek: hoogte = intensiteit t.o.v. LTHR of FTP, met de grens van zone 2
    zones: { lthr: status.profiel.lthr, loop_z2_max: status.profiel.loop_z2_max, ftp: status.profiel.ftp },
    fietstijd_deze_week: status.fietstijd_per_week.find((w) => w.week === maandag(vandaag))?.minuten ?? 0,
    ftp: status.ftp,
    kine: { oefeningen: kine.oefeningen ?? [], grenzen: kine.grenzen ?? [] },
    oefeningen,
    wedstrijden: status.wedstrijden,
    // de trainingen van de laatste week, om er op de pagina kniepijn bij te zetten
    activiteiten_recent: status.activiteiten.filter((a) => a.datum >= plusDagen(vandaag, -7)).reverse().map((a) => ({
      id: a.id, datum: a.datum, naam: a.naam, type: a.type, soort: regels.soortVan({ type: a.type }), minuten: a.minuten,
      kniepijn: a.kniepijn,
    })),
    progressie: prog,
  };
}
