// Het weekbeeld: alles wat de regels nodig hebben, één keer opgehaald bij intervals.icu en uit de opslag. Daarna
// rekent alles zonder ophalen: `status` hieronder, de pagina-data (paginadata.ts) en de weekplannen (weekplan.ts)
// zijn projecties van hetzelfde weekbeeld. Een test geeft een vast weekbeeld mee, zonder intervals.icu.

                                                                      
                                                            
import { maandag, plusDagen, weekdag,            } from "./datum.js";
import {            planweek,                planweekVoor } from "./planweek.js";
import * as regels from "./regels.js";
import * as seizoen from "./seizoen.js";

// zes weken: lang genoeg om een opbouw en een lichte week te zien
export const TOON_DAGEN = 42;
export const WELLNESS_DAGEN = 60;
// zo ver terug zoekt de coach de laatste Garmin-FTP (een wellness-veld)
export const FTP_DAGEN = 365;

const opStart = (a            , b            ) => regels.vergelijk(a.start, b.start);

/** Alle ruwe data die de regels nodig hebben. */
export async function haalData(intervals           , vandaag       , profiel         )                {
  const oudste = [plusDagen(vandaag, -WELLNESS_DAGEN), plusDagen(profiel.opbouw_start, -7)].sort()[0];
  const oudsteWellness = [oudste, plusDagen(vandaag, -FTP_DAGEN)].sort()[0];
  const [activiteiten, wellness, atleet] = await Promise.all([
    intervals.activiteiten(oudste, vandaag), intervals.wellness(oudsteWellness, vandaag), intervals.atleet()]);
  return {
    atleet,
    activiteiten: [...activiteiten].sort(opStart),
    wellness: [...wellness].sort((a, b) => regels.vergelijk(a.datum, b.datum)),
    oudste,
  };
}

/** Wat de regels op `vandaag` nodig hebben: de data van intervals.icu, de wedstrijden en de opslag van de coach. */
                            
                 
                   
             
                                                                             
                                   
                           
                           
 

export async function haalWeekbeeld(intervals           , opslag        , vandaag       )                     {
  const profiel = await opslag.profiel();
  const [data, wedstrijden, seizoensplan, checkpoints] = await Promise.all([
    haalData(intervals, vandaag, profiel), seizoen.haalWedstrijden(intervals, vandaag),
    opslag.seizoensplan(), opslag.checkpoints()]);
  return { vandaag, profiel, data, wedstrijden, seizoensplan, checkpoints };
}

/** De regels voor `week` (pijnregel, opbouw, toegelaten loopvolume, harde trainingen, ...): zie planweek.ts. */
export function regelsVoor(beeld           , week       )           {
  return planweek(beeld.data, beeld.profiel, beeld.checkpoints, week);
}

export async function status(intervals           , opslag        , vandaag       ) {
  return statusUit(await haalWeekbeeld(intervals, opslag, vandaag));
}

/** De status van `node coach status`: de regels van de planweek, de waarschuwingen en de data van de voorbije weken. */
export function statusUit(beeld           ) {
  const { vandaag, profiel, data, checkpoints, seizoensplan } = beeld;
  const { drempels } = profiel;
  const { activiteiten, atleet } = data;
  const planweek = planweekVoor(vandaag);

  const atleetprofiel = regels.atleetprofiel(atleet, profiel);
  const regelsPlanweek = regelsVoor(beeld, planweek);
  const ftp = regels.ftpVergelijking(atleetprofiel.ftp, regels.eftp(activiteiten), drempels, regelsPlanweek.garmin_ftp, vandaag);
  const voorstellen           = [];
  const wellness = data.wellness.map((r) => regels.wellnessSamenvatting(r));
  const eersteWeek = maandag(plusDagen(vandaag, -WELLNESS_DAGEN));
  const volume = regels.loopvolumePerWeek(activiteiten, eersteWeek, maandag(vandaag));
  const fietstijd = regels.fietstijdPerWeek(activiteiten, eersteWeek, maandag(vandaag));
  const opbouw = regelsPlanweek.opbouw;
  const laatste = opbouw[opbouw.length - 1];
  const planweekOpbouw = { week: laatste.week, soort: laatste.soort, toegelaten: laatste.toegelaten };
  const toonVanaf = plusDagen(vandaag, -TOON_DAGEN);

  if (seizoensplan && seizoensplan.doel.datum < vandaag) {
    voorstellen.push(`Je A-wedstrijd van ${seizoensplan.doel.datum} is voorbij. Tijd voor een nieuw ` +
      "seizoensplan richting je volgende A-wedstrijd.");
  }
  const waarschuwingen = [
    ...regels.pijnWaarschuwingen(activiteiten, regelsPlanweek.ochtendpijn, drempels, vandaag, 7,
      regels.ochtendtestStart(profiel)),
    ...regels.herstelWaarschuwingen(wellness, drempels, vandaag),
    ...regels.opbouwWaarschuwingen(opbouw, drempels),
    ...seizoen.checkpointWaarschuwingen(beeld.wedstrijden, vandaag, drempels, checkpoints),
  ];

  const samenvatting = (activiteit            ) => {
    const reden = regels.hardeTraining(activiteit, drempels);
    return { ...regels.activiteitSamenvatting(activiteit), hard: reden !== null, hard_reden: reden };
  };

  return {
    vandaag,
    planweek,
    profiel: atleetprofiel,
    ftp,
    voorstellen,
    loopvolume_per_week: [...volume].map(([week, minuten]) => ({ week, minuten })),
    fietstijd_per_week: [...fietstijd].map(([week, minuten]) => ({ week, minuten })),
    activiteiten: activiteiten.filter((a) => a.datum >= toonVanaf).map(samenvatting),
    wellness: wellness.filter((w) => w.datum >= toonVanaf),
    belasting: regels.huidigeBelasting(wellness),
    pijnregel: [...regelsPlanweek.pijnregel].filter(([w]) => w < planweek).map(([, p]) => p),
    opbouw: {
      weken: opbouw, planweek: planweekOpbouw,
      // midweek bouwt de planweek op een week die nog niet af is: plan best op zondag
      basisweek_loopt_nog: planweek > vandaag && weekdag(vandaag) < 6,
    },
    toegelaten_loopvolume: regelsPlanweek.toegelaten,
    fietsen_alleen_rustig: regelsPlanweek.stap_terug,
    harde_trainingen_max: regelsPlanweek.harde_trainingen_max,
    loopintensiteit: regelsPlanweek.loopintensiteit,
    waarschuwingen,
    wedstrijden: beeld.wedstrijden.filter((w) => w.datum >= vandaag),
    seizoensplan,
    huidige_fase: seizoen.faseOp(seizoensplan, vandaag),
    planweek_fase: seizoen.faseOp(seizoensplan, planweek),
  };
}

                                                  
