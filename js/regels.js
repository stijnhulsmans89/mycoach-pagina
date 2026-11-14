// De domeinregels uit de glossary, zonder in- of uitvoer.
// Alle functies werken op activiteiten, wellnessdagen en de atleet in domeintaal (uit intervals.ts) en op het
// profiel; geen enkele kent een veldnaam van intervals.icu.
// Vertaald uit de vroegere Python-versie; afronden gebeurt nog altijd zoals Python (zie py.ts).

                                                           
import { dagenTussen, maandag, plusDagen,            } from "./datum.js";
import {                               KENMERK, LOOPTYPES, soortVanType, TYPES_PER_SOORT,                  } from "./intervals.js";
import { pyFixed0, pyRound } from "./py.js";

export { maandag };

export { KENMERK, LOOPTYPES, TYPES_PER_SOORT };
export const FIETSSOORTEN = ["mtb", "rollen"];

export function isLoopje(activiteit            )          {
  return activiteit.soort === "loopje";
}

/** De soort training (loopje, mtb, rollen, kracht) bij een sporttype, of null. */
export function soortVan(activiteit                         )                {
  return soortVanType(activiteit.type);
}

export function minuten(activiteit            )         {
  return pyRound(activiteit.seconden / 60);
}

// --- Loopvolume ---------------------------------------------------------------

                                         

function minutenPerWeek(activiteiten              , eersteMaandag       , laatsteMaandag       ,
                        telt                            )          {
  const totaal          = new Map();
  for (let week = eersteMaandag; week <= laatsteMaandag; week = plusDagen(week, 7)) totaal.set(week, 0);
  for (const activiteit of activiteiten) {
    const week = maandag(activiteit.datum);
    if (telt(activiteit) && totaal.has(week)) totaal.set(week, totaal.get(week)  + activiteit.seconden);
  }
  return new Map([...totaal].map(([week, s]) => [week, pyRound(s / 60)]));
}

/** Totale looptijd in minuten per week, ook voor weken zonder loopjes. */
export function loopvolumePerWeek(activiteiten              , eersteMaandag       , laatsteMaandag       )          {
  return minutenPerWeek(activiteiten, eersteMaandag, laatsteMaandag, isLoopje);
}

/** Totale tijd op de fiets (MTB en rollen) in minuten per week. */
export function fietstijdPerWeek(activiteiten              , eersteMaandag       , laatsteMaandag       )          {
  return minutenPerWeek(activiteiten, eersteMaandag, laatsteMaandag,
    (a) => FIETSSOORTEN.includes(a.soort ?? ""));
}

// --- Profiel en FTP -----------------------------------------------------------

/** De drempels uit intervals.icu, aangevuld met die uit het profiel. */
export function atleetprofiel(atleet        , profiel         )      {
  const basis = profiel.atleet;
  return {
    ...basis,
    lthr: atleet.loop.lthr || basis.lthr,
    max_hartslag: atleet.loop.max_hartslag || basis.max_hartslag,
    ftp: atleet.fiets.ftp || basis.ftp,
  };
}

export function eftp(activiteiten              )                {
  const gesorteerd = [...activiteiten].sort((a, b) => vergelijk(b.start, a.start));
  for (const activiteit of gesorteerd) {
    if (activiteit.eftp) return activiteit.eftp;
  }
  return null;
}

/** Vergelijkt zoals Python `<` op tekst of getallen. */
export function vergelijk(a                 , b                 )         {
  return a < b ? -1 : a > b ? 1 : 0;
}

const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Een datum zoals op de pagina: '3 nov'. */
export function kort(dag       )         {
  const [, maand, d] = dag.split("-").map(Number);
  return `${d} ${MAANDEN[maand - 1]}`;
}

                                                                        

/**
 * De ingestelde FTP naast de Garmin-FTP (de maatstaf) en de eFTP (alleen ter informatie).
 * Geeft één melding met een titel en een tekst. De eFTP komt alleen uit ritten met vermogen,
 * en die zijn er alleen op de rollen: ze telt niet mee.
 */
export function ftpVergelijking(ingesteld               , geschat               , drempels          ,
                                garmin                                                     , vandaag       ) {
  const resultaat   
                                                                                                   
                                                                                      
    = { ingesteld, eftp: geschat, garmin: garmin ?? null, afwijking_pct: null, eftp_uitleg: null, melding: null };
  if (geschat) {
    resultaat.eftp_uitleg =
      `eFTP van intervals.icu: ${geschat} W. De eFTP is de FTP die intervals.icu schat uit het zwaarste ` +
      "stuk van je ritten met vermogen, en vermogen heb je alleen op de rollen. Rij je daar rustig, dan is " +
      "dat zwaarste stuk een rustig stuk, en ligt de eFTP te laag. Rij je er af en toe hard, dan wordt ze " +
      "betrouwbaarder. Je Garmin blijft de maatstaf.";
  }
  if (!ingesteld) return resultaat;
  const nu = `Ingesteld in intervals.icu: ${ingesteld} W.`;
  if (!garmin) {
    resultaat.melding = {
      soort: "geen_garmin", titel: "FTP: geef de FTP van je Garmin door",
      tekst: `${nu} Geef de FTP door die je Garmin schat, dan vergelijkt de coach ze.`,
    };
    return resultaat;
  }
  const datum = garmin.datum;
  const afwijking = (garmin.waarde - ingesteld) / ingesteld * 100;
  resultaat.afwijking_pct = pyRound(afwijking, 1);
  const weken = drempels.garmin_ftp_max_weken;
  if (dagenTussen(datum, vandaag) > weken * 7) {
    resultaat.melding = {
      soort: "verouderd", titel: `FTP: je Garmin-FTP is ouder dan ${weken} weken`,
      tekst: `${nu} De laatste FTP van je Garmin (${garmin.waarde} W) is van ${kort(datum)}. ` +
        "Geef de schatting van nu door, dan vergelijkt de coach ze opnieuw.",
    };
  } else if (Math.abs(afwijking) > drempels.ftp_afwijking_pct) {
    resultaat.melding = {
      soort: "bijwerken", titel: `FTP: stel ${garmin.waarde} W in`,
      tekst: `Je Garmin schat je FTP op ${garmin.waarde} W (${kort(datum)}), ${pyFixed0(Math.abs(afwijking))}% ` +
        `${afwijking < 0 ? "lager" : "hoger"} dan de ${ingesteld} W in intervals.icu. ` +
        `Stel ${garmin.waarde} W in, dan kloppen je wattagezones bij het rollen. Dat doe je in ` +
        "intervals.icu bij Settings → Cycling → FTP. Jij beslist.",
    };
  } else {
    resultaat.melding = {
      soort: "in_lijn", titel: `FTP: ${ingesteld} W, in lijn met je Garmin`,
      tekst: `${nu} Je Garmin schat ${garmin.waarde} W (${kort(datum)}). Dat scheelt minder dan ` +
        `${drempels.ftp_afwijking_pct}%, dus er is niets te doen.`,
    };
  }
  return resultaat;
}

                                                           

/** De laatste FTP die de atleet van zijn Garmin doorgaf: een eigen wellness-veld in intervals.icu. */
export function garminFtp(wellness               , totEnMet        )                   {
  let laatste                   = null;
  for (const record of wellness) {
    const datum = record.datum;
    if (record.garmin_ftp == null || (totEnMet && datum > totEnMet)) continue;
    if (!laatste || datum >= laatste.datum) laatste = { waarde: record.garmin_ftp, datum };
  }
  return laatste;
}

// --- Activiteiten en wellness in domeintaal ------------------------------------

                                         
                             
               
                      
                      
                  
                           
                              
                          
                                                          
                           
                                                                  
                           
                                                                                           
                                        
 

export function activiteitSamenvatting(activiteit            )                         {
  const inMinuten = (seconden          ) => seconden.map((s) => pyRound(s / 60, 1));
  return {
    id: activiteit.id,
    datum: activiteit.datum,
    naam: activiteit.naam,
    type: activiteit.type,
    minuten: minuten(activiteit),
    belasting: activiteit.belasting,
    gem_hartslag: activiteit.gem_hartslag,
    kniepijn: activiteit.kniepijn,
    zones_hartslag: inMinuten(activiteit.zone_seconden),
    zones_vermogen: inMinuten(activiteit.vermogen_zone_seconden),
    gepland_event: activiteit.gepland_event,
  };
}

                                       
               
                         
                              
                      
                     
                              
                           
                             
 

export function wellnessSamenvatting(record             )                       {
  const [fitheid, vermoeidheid] = [record.fitheid, record.vermoeidheid].map((w) => w !== null ? pyRound(w, 1) : null);
  const slaap = record.slaap_seconden;
  return {
    datum: record.datum,
    fitheid,
    vermoeidheid,
    vorm: fitheid !== null && vermoeidheid !== null ? pyRound(fitheid - vermoeidheid, 1) : null,
    hrv: record.hrv,
    rusthartslag: record.rusthartslag,
    slaap_uur: slaap ? pyRound(slaap / 3600, 1) : null,
    ochtendpijn: record.ochtendpijn,
  };
}

export function huidigeBelasting(wellness                        ) {
  for (const record of [...wellness].reverse()) {
    if (record.fitheid !== null && record.vermoeidheid !== null) {
      return { fitheid: record.fitheid, vermoeidheid: record.vermoeidheid, vorm: record.vorm };
    }
  }
  return { fitheid: null, vermoeidheid: null, vorm: null };
}

// --- Harde training -----------------------------------------------------------

/** Een harde training door zijn belasting of door intensiteit boven zone 2. Geeft de reden of null. */
export function hardeTraining(activiteit            , drempels          )                {
  const belasting = activiteit.belasting || 0;
  if (belasting > drempels.harde_training_belasting) {
    return `belasting ${belasting} boven ${drempels.harde_training_belasting}`;
  }
  const zones = activiteit.zone_seconden;
  const bovenZ2 = zones.slice(2).reduce((som, s) => som + s, 0) / 60;
  if (bovenZ2 >= drempels.harde_training_min_boven_z2) return `${pyFixed0(bovenZ2)} minuten boven zone 2`;
  return null;
}

// --- Pijnregel ----------------------------------------------------------------

                                             

export function ochtendpijnPerDag(wellness               )              {
  return new Map(wellness.filter((r) => r.ochtendpijn != null).map((r) => [r.datum, r.ochtendpijn ]));
}

/** De eerste ochtend met de vaste ochtendtest (de nulmeting), of null. */
export function ochtendtestStart(profiel         )               {
  return profiel.ochtendtest_start || null;
}

/**
 * Twee ochtendpijnscores zijn alleen vergelijkbaar als ze allebei voor of allebei vanaf de ochtendtest liggen.
 * De eerste ochtend met de test is zo een nulmeting: hij kan de pijnregel niet doen afgaan.
 */
export function vergelijkbaar(eerder       , later       , start              )          {
  return start === null || (eerder < start) === (later < start);
}

                                
              
                                                                                        
                                                    
                                                                                                    
                   
                    
                                   
 

/**
 * Lopen mag vooruit als de kniepijn hoogstens de grens is en de ochtendpijn de dag erna niet hoger.
 * Een loopje zonder kniescore maakt de week onvolledig: een ontbrekende score telt niet als in orde.
 */
export function pijnregelWeek(week       , activiteiten              , ochtendpijn             ,
                              drempels          , start               = null)                {
  const redenen           = [];
  const zonderScore          = [];
  const trainingsdagen = new Set       ();
  for (const activiteit of activiteiten) {
    const dag = activiteit.datum;
    if (maandag(dag) !== week) continue;
    trainingsdagen.add(dag);
    const score = activiteit.kniepijn;
    if (score == null) {
      if (isLoopje(activiteit)) zonderScore.push(dag);
    } else if (score > drempels.kniepijn_max) {
      redenen.push(`kniepijn ${score} na ${activiteit.naam || activiteit.type} op ${dag}`);
    }
  }
  for (const dag of [...trainingsdagen].sort()) {
    const morgen = plusDagen(dag, 1);
    const voor = ochtendpijn.get(dag), na = ochtendpijn.get(morgen);
    if (voor !== undefined && na !== undefined && na > voor && vergelijkbaar(dag, morgen, start)) {
      redenen.push(`ochtendpijn steeg van ${voor} naar ${na} de dag na de training van ${dag}`);
    }
  }
  const status = redenen.length ? "niet in orde" : zonderScore.length ? "onvolledig" : "in orde";
  return { week, status, in_orde: status === "in orde", redenen, loopjes_zonder_kniepijn: zonderScore };
}

// --- Opbouw en stap terug ------------------------------------------------------

                                                                                                 

/**
 * Het toegelaten loopvolume per week, van de start van de opbouw tot en met de planweek.
 * Elke week is `start`, `opbouw` (+groei), `licht` (elke vierde opbouwweek) of
 * `stap_terug` (na een week waarin de pijnregel niet in orde was) of `geen_groei` (na een onvolledige week:
 * een loopje zonder kniescore laat het volume niet groeien, maar zet geen stap terug).
 * Een week volledig in een looppauze van de kine is `looppauze` (0 minuten) en neutraal: ze telt niet als
 * opbouwweek. De eerste week erna is `na_pauze`: terug op het laatste echte loopvolume, zonder groei.
 */
export function opbouw(weken         , volume         , pijnregel                           ,
                       profiel         , pauzeweken             = new Set())               {
  const drempels = profiel.drempels;
  const groei = 1 + drempels.groei_pct / 100;
  const licht = drempels.lichte_week_pct / 100;
  const resultaat               = [];
  let teller = 0;

  // het volume waarop verder gebouwd wordt: zoals het echt was, maar niet boven het toegelaten
  const effectief = (i        ) => Math.min(resultaat[i].werkelijk, resultaat[i].toegelaten);

  // de laatste week voor k waarin echt gelopen werd en die geen lichte week was;
  // een week zonder loopjes (ziek, gemist) laat de opbouw niet groeien en zet ze ook niet op nul
  const basis = (k        ) => {
    for (let i = k - 1; i >= 0; i--) {
      if (resultaat[i].soort !== "licht" && resultaat[i].werkelijk) return effectief(i);
    }
    return profiel.start_loopvolume;
  };

  weken.forEach((week, k) => {
    const werkelijk = volume.get(week) ?? 0;
    let soort        , toegelaten        ;
    if (pauzeweken.has(week)) {
      [soort, toegelaten] = ["looppauze", 0];
    } else if (k === 0) {
      [soort, toegelaten, teller] = ["start", profiel.start_loopvolume, 1];
    } else if (pijnregel.get(weken[k - 1]) .status === "onvolledig") {
      // een ontbrekende kniescore: niet in orde om op te bouwen, maar ook geen pijn; het volume groeit niet
      [soort, toegelaten] = ["geen_groei", basis(k)];
    } else if (!pijnregel.get(weken[k - 1]) .in_orde) {
      [soort, teller] = ["stap_terug", 1];
      // de laatste week in orde waarin echt gelopen kon worden: een pauzeweek heeft geen loopvolume
      const goed = weken.slice(0, k - 1).map((_, i) => i)
        .filter((i) => pijnregel.get(weken[i]) .in_orde && !pauzeweken.has(weken[i]));
      toegelaten = goed.length ? effectief(goed[goed.length - 1]) : pyRound(licht * basis(k));
    } else if (pauzeweken.has(weken[k - 1])) {
      // na een looppauze: één week op hetzelfde niveau, om te zien of de pees het lopen weer aankan
      [soort, toegelaten] = ["na_pauze", basis(k)];
    } else {
      teller += 1;
      if (teller === drempels.lichte_week_elke) {
        [soort, toegelaten, teller] = ["licht", pyRound(licht * basis(k)), 0];
      } else {
        [soort, toegelaten] = ["opbouw", pyRound(groei * basis(k))];
      }
    }
    resultaat.push({ week, soort, toegelaten, werkelijk });
  });
  return resultaat;
}

// --- Harde trainingen en loopintensiteit ----------------------------------------

export const TREDEN = ["versnellingen", "tempoblokken", "intervallen"];

/**
 * Het aantal weken op rij voor `week` waarin de pijnregel in orde was. Een pauzeweek in orde is neutraal:
 * ze verbreekt de reeks niet en telt niet mee. Stijgt de ochtendpijn in een pauzeweek, dan verbreekt ze de reeks wel.
 */
export function wekenInOrde(pijnregel                           , week       ,
                            pauzeweken             = new Set())         {
  let aantal = 0;
  for (const w of [...pijnregel.keys()].filter((w) => w < week).sort().reverse()) {
    if (!pijnregel.get(w) .in_orde) break;
    if (pauzeweken.has(w)) continue;
    aantal += 1;
  }
  return aantal;
}

/** Voorlopig één harde training per week; twee als de pijnregel een paar weken op rij in orde is. */
export function hardeTrainingenMax(inOrde        , drempels          )         {
  if (inOrde >= drempels.harde_rol_na_weken_in_orde) return drempels.max_harde_trainingen_na_orde;
  return drempels.max_harde_trainingen;
}

/**
 * Of een loopje intensiteit mag hebben in `week`, en tot welke trede.
 * Pas na genoeg weken met de pijnregel in orde, genoeg echt gelopen loopvolume (`gelopen`, de vorige week)
 * zonder stap terug en groen licht van de kine. De treden tellen vanaf de eerste week waarin dat allemaal
 * klopt: elke `loopintensiteit_trede_weken` zonder stap terug komt er een trede bij, zodat er nooit een
 * trede overgeslagen wordt, ook niet na een vroeg groen licht of na een stap terug.
 */
export function loopintensiteit(inOrde        , gelopen        , stapTerug         , kineAkkoord              ,
                                week       , drempels          ) {
  const akkoord = kineAkkoord && maandag(kineAkkoord) <= week ? kineAkkoord : null;
  const voorwaarden = {
    weken_in_orde: { nu: inOrde, nodig: drempels.loopintensiteit_weken_in_orde,
                     ok: inOrde >= drempels.loopintensiteit_weken_in_orde },
    loopvolume: { nu: gelopen, nodig: drempels.loopintensiteit_min_volume,
                  ok: gelopen >= drempels.loopintensiteit_min_volume && !stapTerug },
    kine: { akkoord, ok: akkoord !== null },
  };
  if (!Object.values(voorwaarden).every((v) => v.ok)) return { toegelaten: false, trede: null, voorwaarden };
  const wekenToegelaten = Math.min(Math.floor(dagenTussen(maandag(akkoord ), week) / 7),
                                   inOrde - drempels.loopintensiteit_weken_in_orde);
  const index = Math.min(Math.floor(wekenToegelaten / drempels.loopintensiteit_trede_weken), TREDEN.length - 1);
  return { toegelaten: true, trede: TREDEN[index], voorwaarden };
}

// --- Waarschuwingen -----------------------------------------------------------

                                                                                          

/** `titel` is één korte regel voor de pagina; `wat` en `advies` geven de volledige uitleg. */
function waarschuwing(code        , titel        , wat        , advies        )               {
  return { code, titel, wat, advies };
}

/** Wat de pijnwaarschuwingen van een training nodig hebben: ook de pagina rekent ze opnieuw, met een wachtende score. */
                                                                                      

export function pijnWaarschuwingen(activiteiten                  , ochtendpijn             , drempels          ,
                                   vandaag       , dagen = 7, start               = null)                 {
  const waarschuwingen                 = [];
  const vanaf = plusDagen(vandaag, -dagen);
  const teHoog = activiteiten.filter((a) => a.datum >= vanaf && (a.kniepijn || 0) > drempels.kniepijn_max);
  if (teHoog.length) {
    const laatste = teHoog[teHoog.length - 1];
    waarschuwingen.push(waarschuwing(
      "kniepijn",
      `Kniepijn ${laatste.kniepijn}: niet lopen`,
      `Je kniepijn was ${laatste.kniepijn} na ${laatste.naam || laatste.type} op ` +
        `${laatste.datum}, boven de grens van ${drempels.kniepijn_max}.`,
      "Niet lopen tot de pijn weer op of onder 3 zit. Koel en ontzie de knie vandaag, doe alleen de " +
        "kine-oefeningen die pijnvrij gaan, en fiets hoogstens rustig en pijnvrij. Het lopen zet volgende " +
        "week een stap terug. Blijft de pijn boven 3 of wordt ze erger, contacteer dan je kine.",
    ));
  }
  const recent = [...ochtendpijn].filter(([d]) => d >= vanaf)
    .sort(([d1, s1], [d2, s2]) => vergelijk(d1, d2) || vergelijk(s1, s2));
  if (recent.length >= 2) {
    const [vorigeDag, vorige] = recent[recent.length - 2];
    const [dag, score] = recent[recent.length - 1];
    if (score > vorige && vergelijkbaar(vorigeDag, dag, start)) {
      waarschuwingen.push(waarschuwing(
        "ochtendpijn",
        `Ochtendpijn steeg van ${vorige} naar ${score}`,
        `Je ochtendpijn steeg van ${vorige} (${vorigeDag}) naar ${score} (${dag}). ` +
          "De training van gisteren werkt dus nog na in je pees.",
        "Plan vandaag geen loopje en geen harde training. Kies rust, de kine-oefeningen of rustig fietsen " +
          "als dat pijnvrij gaat, en geef morgen opnieuw je ochtendpijn door.",
      ));
    }
  }
  return waarschuwingen;
}

function gemiddelde(waarden                   )                {
  const echte = waarden.filter((w)              => w !== null);
  return echte.length ? echte.reduce((som, w) => som + w, 0) / echte.length : null;
}

// --- Vormzones ----------------------------------------------------------------

                                                                               

/** De vier vormzones, van boven naar onder. De rode grens is `vorm_min`, dezelfde als de waarschuwing van de coach. */
export function vormzones(drempels          ) {
  const { vorm_uitgerust: uitgerust, vorm_opbouw: opbouw, vorm_min: min } = drempels;
  return [
    { naam: "uitgerust"            , van: uitgerust, tot: null,
      uitleg: "Je vermoeidheid ligt onder je fitheid: je bent fris. Goed voor een wedstrijd of een harde training." },
    { naam: "normaal"            , van: opbouw, tot: uitgerust,
      uitleg: "Je traint ongeveer wat je gewend bent. Hier zit je meestal tijdens een gewone trainingsweek." },
    { naam: "zware opbouw"            , van: min, tot: opbouw,
      uitleg: "Je traint meer dan je gewend bent, bijvoorbeeld na een lange MTB-rit. Dat maakt je sterker, " +
        "maar alleen als er daarna rustige dagen volgen." },
    { naam: "overbelast"            , van: null, tot: min,
      uitleg: "Je vermoeidheid ligt veel hoger dan je fitheid. Hier stijgt het risico op een blessure: " +
        "neem rust tot je vorm weer uit deze zone is." },
  ];
}

export function vormzone(vorm               , drempels          )                  {
  if (vorm === null) return null;
  if (vorm > drempels.vorm_uitgerust) return "uitgerust";
  if (vorm >= drempels.vorm_opbouw) return "normaal";
  if (vorm >= drempels.vorm_min) return "zware opbouw";
  return "overbelast";
}

/** HRV, rusthartslag en vorm. `wellness` is de lijst in domeintaal, oplopend op datum. */
export function herstelWaarschuwingen(wellness                        , drempels          ,
                                      vandaag       )                 {
  const waarschuwingen                 = [];
  const laatste = (dagen        , sleutel                        ) => {
    const vanaf = plusDagen(vandaag, -(dagen - 1));
    return wellness.filter((r) => r.datum >= vanaf).map((r) => r[sleutel]);
  };

  const hrv7 = gemiddelde(laatste(7, "hrv")), hrv60 = gemiddelde(laatste(60, "hrv"));
  if (hrv7 && hrv60 && hrv7 < hrv60 * (1 - drempels.hrv_daling_pct / 100)) {
    const daling = (1 - hrv7 / hrv60) * 100;
    waarschuwingen.push(waarschuwing(
      "hrv",
      `HRV ${pyFixed0(daling)}% onder normaal`,
      `Je HRV over 7 dagen (${pyFixed0(hrv7)}) ligt ${pyFixed0(daling)}% onder je gemiddelde over 60 dagen ` +
        `(${pyFixed0(hrv60)}). Je lichaam herstelt minder goed dan normaal.`,
      "Maak de komende dagen alles rustig: geen harde training, eerder korter dan langer, en let op " +
        "slaap en stress. Herstel gaat voor.",
    ));
  }

  const rust30 = gemiddelde(laatste(30, "rusthartslag"));
  if (rust30) {
    let reeks = 0;
    for (const record of [...wellness].reverse()) {
      if (record.rusthartslag !== null && record.rusthartslag >= rust30 + drempels.rusthartslag_boven) reeks += 1;
      else break;
    }
    if (reeks >= drempels.rusthartslag_dagen) {
      waarschuwingen.push(waarschuwing(
        "rusthartslag",
        `Rusthartslag ${reeks} dagen verhoogd`,
        `Je rusthartslag ligt al ${reeks} dagen op rij ${drempels.rusthartslag_boven} of meer slagen ` +
          `boven je gemiddelde over 30 dagen (${pyFixed0(rust30)}). Dat wijst op vermoeidheid of een ` +
          "beginnende ziekte.",
        "Neem een rustdag of train heel rustig, en voel je je ziek, train dan niet. Wacht met harde " +
          "trainingen tot je rusthartslag weer normaal is.",
      ));
    }
  }

  const vorm = huidigeBelasting(wellness).vorm;
  if (vorm !== null && vorm < drempels.vorm_min) {
    waarschuwingen.push(waarschuwing(
      "vorm",
      `Vorm ${vorm}: overbelast`,
      `Je vorm is ${vorm}, onder ${drempels.vorm_min}. Je vermoeidheid ligt veel hoger dan je fitheid: ` +
        "je bent overbelast.",
      "Bouw een paar rustigere dagen in en schrap de harde training deze week, tot je vorm weer boven " +
        `${drempels.vorm_min} zit.`,
    ));
  }
  return waarschuwingen;
}

export function opbouwWaarschuwingen(opbouwweken              , drempels          )                 {
  const waarschuwingen                 = [];
  if (opbouwweken.length >= 2) {
    const vorige = opbouwweken[opbouwweken.length - 2];
    // een loopje loopt al eens een minuut uit: pas boven de marge is het te veel
    const marge = 1 + drempels.loopvolume_marge_pct / 100;
    if (vorige.werkelijk > vorige.toegelaten * marge) {
      waarschuwingen.push(waarschuwing(
        "loopvolume",
        `Loopvolume: ${vorige.werkelijk} van ${vorige.toegelaten} min`,
        `Je liep in de week van ${vorige.week} ${vorige.werkelijk} minuten, meer dan de toegelaten ` +
          `${vorige.toegelaten} minuten. Te snel opbouwen is precies hoe je pees overbelast raakte.`,
        "Hou je volgende week aan het toegelaten loopvolume. De coach bouwt verder vanaf het toegelaten " +
          "volume, niet vanaf wat je extra liep.",
      ));
    }
  }
  if (opbouwweken.length >= 2 && opbouwweken.slice(-2).every((w) => w.soort === "stap_terug")) {
    waarschuwingen.push(waarschuwing(
      "kine",
      "Twee weken stap terug: bel je kine",
      "Het lopen zet voor de tweede week na elkaar een stap terug. De knie reageert niet zoals verwacht.",
      "Contacteer je kine en bespreek de kniepijn en de opbouw, voor je verder bouwt. De grenzen van je " +
        "kine gaan voor op het plan.",
    ));
  }
  return waarschuwingen;
}
