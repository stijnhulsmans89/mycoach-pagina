// De pagina-data: alles wat de pagina toont, en de keuzes die ze maakt (dagoordeel, check-ins, gepland tegenover
// gedaan, 80/20, weekstatus). De pagina tekent alleen; zo is wat ze beslist getest. Bevat nooit de API-sleutel.

                                                                   
                                                
import { dagenTussen, maandag, plusDagen,            } from "./datum.js";
import { isHard } from "./controle.js";
import * as dagoordeel from "./dagoordeel.js";
import * as gg from "./geplandgedaan.js";
import * as momentopname from "./momentopname.js";
                                                
import { pyRound } from "./py.js";
import * as regels from "./regels.js";
import * as seizoen from "./seizoen.js";

export const ACHTER_MARGE_FITHEID = 3;
/** De versie van de pagina-data: een momentopname met een andere versie toont de pagina niet (eerst verbinding nodig). */
export const VERSIE = 2;
const PIJN_CODES = new Set(["kniepijn", "ochtendpijn"]);

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
  const toegelaten = new Map(status.opbouw.weken.map((w) => [w.week, w.toegelaten]));
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
      toegelaten: toegelaten.get(week) ?? null,
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

                                                         

/**
 * Op schema of achter, voor de A-wedstrijd: achter als de fitheid ver onder de verwachte ligt, of als je de vorige
 * week veel minder liep dan gepland. Zonder gat om in te halen: de coach stuurt het plan bij.
 */
function schema(prog            , vandaag       )                                                           {
  if (prog.leeg) return null;
  const fitheid = prog.fitheid;
  // alleen afgelopen weken: een week die nog loopt, is nog niet achter
  const vorige = prog.loopvolume.filter((w) => w.gepland && w.werkelijk !== null && plusDagen(w.week, 6) < vandaag);
  const laatste = vorige[vorige.length - 1];
  const fitheidAchter = fitheid.huidig !== null && fitheid.verwacht !== null && fitheid.huidig < fitheid.verwacht - ACHTER_MARGE_FITHEID;
  const volumeAchter = Boolean(laatste && laatste.werkelijk  < 0.8 * laatste.gepland );
  if (fitheidAchter || volumeAchter) {
    return { stand: "achter", uitleg: (fitheidAchter ? "Je fitheid groeit trager dan het seizoensplan verwachtte." :
      "Je liep vorige week minder dan gepland.") + " De coach stuurt het plan bij: er valt niets in te halen." };
  }
  return { stand: "op schema", uitleg: "De opbouw loopt volgens het seizoensplan." };
}

/** Loopvolume, toegelaten volume en fietstijd per week: tot de A-wedstrijd, of zonder A-wedstrijd de voorbije 6 weken. */
function volume(status        , prog            , vandaag       ) {
  if (!prog.leeg) return prog.loopvolume;
  const ma = maandag(vandaag);
  const loop = new Map(status.loopvolume_per_week.map((w) => [w.week, w.minuten]));
  const fiets = new Map(status.fietstijd_per_week.map((w) => [w.week, w.minuten]));
  const toegelaten = new Map(status.opbouw.weken.map((w) => [w.week, w.toegelaten]));
  const weken = [];
  for (let week = plusDagen(ma, -35); week <= ma; week = plusDagen(week, 7)) {
    weken.push({ week, gepland: null, richtvolume: null, werkelijk: loop.get(week) ?? 0, fietstijd: fiets.get(week) ?? 0,
                 richtvolume_fiets_uur: null, toegelaten: toegelaten.get(week) ?? null });
  }
  return weken;
}

// --- Het plan van deze en volgende week, met gepland tegenover gedaan ----------------------------

/** Een week op de pagina: alleen een weekplan met akkoord heeft trainingen; een voorstel staat er alleen als status. */
function weekVoorPagina(plan            , week       , uitkomsten                       , nietGepland                            ,
                        drempels          ) {
  const status = plan?.voorstel ? "voorstel" : plan?.akkoord ? "akkoord" : "geen";
  if (!plan?.akkoord) return { week, status, akkoord: false, akkoord_op: null, bijsturing_vanaf: null, uitleg: null, trainingen: [], niet_gepland: [] };
  return {
    week, status, akkoord: true,
    akkoord_op: plan.akkoord_op ?? null, bijsturing_vanaf: plan.bijsturing_vanaf ?? null, uitleg: plan.akkoord.uitleg ?? null,
    trainingen: (plan.akkoord.trainingen         ).map((t, index)                                                                => ({
      ...t, index, hard: isHard(t, drempels), uitkomst: uitkomsten.find((u) => u.week === week && u.index === index) ?? null,
    })),
    niet_gepland: nietGepland,
  };
}

                                                        

/** De dag van vandaag: de trainingen (alleen uit een akkoord), een wedstrijd, morgen en de volgende training. */
function vandaagVoorPagina(vandaag       , deze                , volgende                , wedstrijden                     ) {
  const alle = [...deze.trainingen, ...volgende.trainingen];
  const kort = (t     ) => ({ datum: t.datum         , soort: t.soort          , naam: (t.naam ?? null)                 ,
                              duur_min: t.duur_min          , hard: Boolean(t.hard) });
  const morgen = plusDagen(vandaag, 1);
  const na = alle.filter((t) => t.datum > vandaag).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  const wedstrijd = wedstrijden.find((w) => w.datum === vandaag) ?? null;
  return {
    datum: vandaag,
    weekplan: deze.akkoord,
    trainingen: deze.trainingen.filter((t) => t.datum === vandaag),
    rustdag: deze.akkoord && !wedstrijd && !deze.trainingen.some((t) => t.datum === vandaag),
    wedstrijd,
    morgen: alle.filter((t) => t.datum === morgen).map(kort),
    volgende: na.length ? kort(na[0]) : null,
  };
}

/**
 * Moet de coach het plan nakijken als de pijnscore van `dag` verandert? Ja als de week erna al een weekplan met
 * akkoord heeft: de pijnregel van een week bepaalt het plan van de week erna. Voor ochtendpijn geef je de dag van
 * de training (de dag ervoor), want ochtendpijn telt bij de training van gisteren.
 */
export function planNakijken(D                          , dag       )          {
  const na = plusDagen(maandag(dag), 7);
  return [D.plan.deze_week, D.plan.volgende_week].some((w) => w.akkoord && w.week === na);
}

/** Wat het dagoordeel nodig heeft, uit de pagina-data: zo rekent de pagina het opnieuw met een wachtende score. */
function dagoordeelInvoer(D            , waarschuwingen                       , ochtendpijnVandaag         )                              {
  const v = D.vandaag;
  const open = v.trainingen.filter((t) => !t.uitkomst || t.uitkomst.status === "te doen");
  return {
    vandaag: v.datum, waarschuwingen, vormzone: D.weekstatus.cijfers.vormzone,
    ochtendpijn_vandaag: ochtendpijnVandaag,
    open_vandaag: open.map((t) => ({ datum: t.datum, soort: t.soort, naam: t.naam ?? null, duur_min: t.duur_min, hard: Boolean(t.hard) })),
    gepland_vandaag: v.trainingen.length > 0, volgende: v.volgende,
    wedstrijd: v.wedstrijd ? { naam: v.wedstrijd.naam } : null, weekplan: v.weekplan,
  };
}

/**
 * De pagina-data met de scores die op dit toestel nog wachten op verbinding: ze tellen al mee in de pijnsignalen,
 * het dagoordeel, de check-ins en het logboek. Zonder wachtende scores verandert er niets.
 */
export function metWachtend(D            , wachtend                       )             {
  const knie = new Map(wachtend.filter((w) => w.soort === "knie").map((w) => [String(w.activiteit), w.waarde]));
  const logboek = D.logboek.map((a) => knie.has(String(a.id)) ? { ...a, kniepijn: knie.get(String(a.id)) , wacht: true } : a);
  const ochtend = new Map(D.pijn.ochtendpijn.map((p) => [p.datum, p.score          ]));
  for (const w of wachtend) if (w.soort === "ochtend") ochtend.set(w.datum, w.waarde);
  const pijn = regels.pijnWaarschuwingen(logboek.slice().reverse(), ochtend, { kniepijn_max: D.pijn.kniepijn_max }            ,
    D.momentopname, 7, D.pijn.ochtendtest_start);
  const waarschuwingen = [...pijn, ...D.waarschuwingen.filter((w) => !PIJN_CODES.has(w.code))]
    .map((w) => ({ ...w, ernst: dagoordeel.ernst(w.code) }));
  const vandaag = D.momentopname;
  return {
    ...D,
    logboek,
    waarschuwingen,
    dagoordeel: dagoordeel.dagoordeel(dagoordeelInvoer(D, waarschuwingen, ochtend.has(vandaag))),
    checkins: dagoordeel.checkins(vandaag, plusDagen(vandaag, -1), D.logboek.slice().reverse(),
      D.pijn.ochtendpijn.find((p) => p.datum === vandaag)?.score ?? null, wachtend),
  };
}

/** `gemaakt_op` is het tijdstip van de berekening, tot op de minuut (`2026-11-08T21:05`). */
export async function paginaData(intervals           , opslag        , vandaag       , gemaaktOp        ) {
  const { status, data, planweek } = await momentopname.statusMetData(intervals, opslag, vandaag);
  const [schaal, profiel, oefeningen] = await Promise.all([opslag.pijnschaal(), opslag.profiel(), opslag.oefeningen()]);
  const drempels = profiel.drempels;
  const ma = maandag(vandaag), volgendeMa = plusDagen(ma, 7);
  const eersteMa = maandag(plusDagen(vandaag, -momentopname.TOON_DAGEN));

  // gepland tegenover gedaan: de weekplannen met akkoord van de getoonde weken, tot en met volgende week
  const plannen = new Map                   ();
  for (let week = eersteMa; week <= volgendeMa; week = plusDagen(week, 7)) plannen.set(week, await opslag.weekplan(week));
  const gepland = [...plannen.values()].flatMap(gg.geplandUit);
  const events = new Map((await intervals.geplandeTrainingen(eersteMa, plusDagen(volgendeMa, 6)))
    .map((e) => [String(e.id), e.kenmerk]));
  const getoond = data.activiteiten.filter((a) => a.datum >= eersteMa);
  const zones = { loop_z2_max: status.profiel.loop_z2_max, ftp: status.profiel.ftp ?? null,
                  loopvolume_marge_pct: drempels.loopvolume_marge_pct };
  const gekoppeld = gg.koppel(gepland, getoond, events, vandaag, zones);
  const nietGepland = (week       ) => gekoppeld.activiteiten
    .filter((a) => a.koppeling === "niet gepland" && maandag(a.datum) === week).map((a) => a.id);
  const dezeWeek = weekVoorPagina(plannen.get(ma) ?? null, ma, gekoppeld.trainingen, nietGepland(ma), drempels);
  const volgendeWeek = weekVoorPagina(plannen.get(volgendeMa) ?? null, volgendeMa, gekoppeld.trainingen, [], drempels);

  // het logboek: de gedane activiteiten van de getoonde weken, nieuwste eerst, met hun koppeling en oordeel
  const logboek = getoond.map((a, i) => {
    const reden = regels.hardeTraining(a, drempels);
    const k = gekoppeld.activiteiten[i];
    return { ...regels.activiteitSamenvatting(a), soort: a.soort, hard: reden !== null, koppeling: k.koppeling,
             training: k.training, oordeel: k.oordeel, wacht: false };
  }).reverse();

  // de weekstatus: de stand van deze week
  const pijnregelDeze = planweek.pijnregel.get(ma)
    ?? regels.pijnregelWeek(ma, data.activiteiten, planweek.ochtendpijn, drempels, regels.ochtendtestStart(profiel));
  const pijnregelTot = new Map([...planweek.pijnregel].filter(([w]) => w < ma));
  const inOrde = regels.wekenInOrde(pijnregelTot, ma, planweek.pauzeweken);
  const opbouwDeze = status.opbouw.weken.find((w) => w.week === ma) ?? null;
  const gelopen = status.loopvolume_per_week.find((w) => w.week === ma)?.minuten ?? 0;
  const fietstijd = status.fietstijd_per_week.find((w) => w.week === ma)?.minuten ?? 0;
  const dezeWeekActiviteiten = logboek.filter((a) => a.datum >= ma && a.datum <= vandaag).reverse();
  const vorm = status.belasting.vorm;
  const weekstatus = {
    week: ma,
    pijnregel: { status: pijnregelDeze.status, redenen: pijnregelDeze.redenen, loopjes_zonder_kniepijn: pijnregelDeze.loopjes_zonder_kniepijn },
    weken_in_orde: inOrde,
    weektype: opbouwDeze?.soort ?? null,
    loopvolume: { gelopen, toegelaten: opbouwDeze?.toegelaten ?? null,
                  over: opbouwDeze ? Math.max(opbouwDeze.toegelaten - gelopen, 0) : null },
    harde_trainingen: { gedaan: dezeWeekActiviteiten.filter((a) => a.hard).length,
                        toegelaten: opbouwDeze?.soort === "stap_terug" ? 0 : regels.hardeTrainingenMax(inOrde, drempels) },
    // de looppauze van de kine die vandaag loopt: een voorzorg, apart getoond, zonder invloed op het dagoordeel
    looppauze: status.looppauze,
    ontbrekende_kniescores: dezeWeekActiviteiten.filter((a) => a.soort && a.kniepijn === null)
      .map((a) => ({ id: a.id, datum: a.datum, naam: a.naam, soort: a.soort })),
    cijfers: { loopvolume: { gelopen, toegelaten: opbouwDeze?.toegelaten ?? null }, fietstijd_min: fietstijd,
               vorm, vormzone: regels.vormzone(vorm, drempels) },
  };

  const oud = await basisData(status, opslag, vandaag, schaal, profiel, oefeningen);
  const D = {
    versie: VERSIE,
    ...oud,
    gemaakt_op: gemaaktOp,
    pijn: { ...oud.pijn, kniepijn_max: drempels.kniepijn_max, ochtendtest_start: regels.ochtendtestStart(profiel) },
    waarschuwingen: status.waarschuwingen.map((w) => ({ ...w, ernst: dagoordeel.ernst(w.code) })),
    vandaag: vandaagVoorPagina(vandaag, dezeWeek, volgendeWeek, status.wedstrijden),
    plan: { deze_week: dezeWeek, volgende_week: volgendeWeek },
    weekstatus,
    logboek,
    gepland_vs_gedaan: gekoppeld,
    tachtig_twintig: gg.tachtigTwintig(data.activiteiten, maandag(plusDagen(ma, -35)), ma),
    // het dagoordeel en de check-ins rekent metWachtend, zodat de pagina ze met een wachtende score hetzelfde rekent
    dagoordeel: null                                    ,
    checkins: null                                  ,
  };
  return metWachtend(D, []);
}

                                                                  
                 
                                                                                                                  
                                                                               
                                                
                                                                     
                                                                      
                                                                                                             
                                                  
                                           
                                    
                                
  

async function basisData(status        , opslag        , vandaag       , schaal     , profiel         , oefeningen     ) {
  // per dag de activiteiten in volgorde, met hun soort: de staafjes op de pagina krijgen de kleur van de soort
  const activiteitenPerDag = new Map                                                                                          ();
  for (const activiteit of status.activiteiten) {
    const lijst = activiteitenPerDag.get(activiteit.datum) ?? [];
    lijst.push({ soort: regels.soortVan({ type: activiteit.type }), hard: activiteit.hard, naam: activiteit.naam,
      belasting: activiteit.belasting || 0 });
    activiteitenPerDag.set(activiteit.datum, lijst);
  }
  const prog = await progressie(opslag, status, vandaag);
  const kine = profiel.kine;
  return {
    momentopname: vandaag,
    voorstellen: status.voorstellen,
    pijn: {
      kniepijn: status.activiteiten.filter((a) => a.kniepijn !== null)
        .map((a) => ({ id: a.id, datum: a.datum, score: a.kniepijn, training: a.naam })),
      ochtendpijn: status.wellness.filter((w) => w.ochtendpijn !== null)
        .map((w) => ({ datum: w.datum, score: w.ochtendpijn })),
      grens: schaal.grens,
      schaal: schaal.schaal,
      uitleg: schaal.uitleg,
      ochtendtest: schaal.ochtendtest,
      kniepijn_uitleg: schaal.kniepijn,
    },
    belasting: status.wellness.map((w) => ({
      datum: w.datum, belasting: (activiteitenPerDag.get(w.datum) ?? []).reduce((som, a) => som + a.belasting, 0),
      fitheid: w.fitheid, vermoeidheid: w.vermoeidheid, vorm: w.vorm, vormzone: regels.vormzone(w.vorm, profiel.drempels),
      activiteiten: activiteitenPerDag.get(w.datum) ?? [],
    })),
    vormzones: regels.vormzones(profiel.drempels),
    toegelaten_loopvolume: status.toegelaten_loopvolume,
    // voor de blokjesgrafiek: hoogte = intensiteit t.o.v. LTHR of FTP, met de grens van zone 2
    zones: { lthr: status.profiel.lthr, loop_z2_max: status.profiel.loop_z2_max, ftp: status.profiel.ftp,
             fiets_z2_pct: gg.STANDAARD_VERMOGENSZONES[1] },
    ftp: status.ftp,
    kine: { oefeningen: kine.oefeningen ?? [], grenzen: kine.grenzen ?? [] },
    oefeningen,
    wedstrijden: status.wedstrijden,
    progressie: prog,
    schema: schema(prog, vandaag),
    volume: volume(status, prog, vandaag),
  };
}
