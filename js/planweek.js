// De planweek: de week waarvoor de coach een weekplan of bijsturing maakt, en de regels die er gelden.
// Rekent alleen, zonder ophalen: de data komt uit `momentopname.haalData`. `status`, `controleer` en
// `plaats` gebruiken deze module, zodat de knieregels voor een week maar op één plek afgeleid worden.

                                                         
import { maandag, plusDagen, weekdag,            } from "./datum.js";
                                                                      
import * as regels from "./regels.js";
import * as seizoen from "./seizoen.js";

/** De data die de regels nodig hebben, in domeintaal, gesorteerd (activiteiten op start, wellness op dag). */
                                                                                                            

/** De planweek van `status`: deze week op maandag, anders de volgende. */
export function planweekVoor(vandaag       )        {
  return weekdag(vandaag) === 0 ? vandaag : plusDagen(maandag(vandaag), 7);
}

function weken(van       , tot       )          {
  const resultaat          = [];
  for (let week = van; week <= tot; week = plusDagen(week, 7)) resultaat.push(week);
  return resultaat;
}

/** Pijnregel, opbouw, toegelaten loopvolume, harde trainingen, loopintensiteit, looppauze en Garmin-FTP voor `week`. */
export function planweek(data      , profiel         , checkpoints             , week       ) {
  const { drempels } = profiel;
  const activiteiten = data.activiteiten;
  const ochtendpijn = regels.ochtendpijnPerDag(data.wellness);
  const start = [maandag(profiel.opbouw_start), week].sort()[0];
  const opbouwweken = weken(start, week);
  const volume = regels.loopvolumePerWeek(activiteiten, start, week);
  const startTest = regels.ochtendtestStart(profiel);
  const pijnregel = new Map(opbouwweken.map((w) =>
    [w, regels.pijnregelWeek(w, activiteiten, ochtendpijn, drempels, startTest)]));
  const pauzeweken = seizoen.pauzeweken(checkpoints, opbouwweken);
  const opbouw = regels.opbouw(opbouwweken, volume, pijnregel, profiel, pauzeweken);

  const laatste = opbouw[opbouw.length - 1];
  // ook in een looppauze: na een week die niet in orde was, is fietsen alleen rustig
  const vorige = opbouw.length > 1 ? pijnregel.get(opbouw[opbouw.length - 2].week)  : null;
  const stapTerug = laatste.soort === "stap_terug"
    || (laatste.soort === "looppauze" && vorige?.status === "niet in orde");
  const inOrde = regels.wekenInOrde(pijnregel, week, pauzeweken);
  const vorigeWeekGelopen = opbouw.length > 1 ? opbouw[opbouw.length - 2].werkelijk : 0;
  return {
    week,
    opbouw,
    pijnregel,
    ochtendpijn,
    toegelaten: laatste.toegelaten,
    stap_terug: stapTerug,
    weken_in_orde: inOrde,
    harde_trainingen_max: regels.hardeTrainingenMax(inOrde, drempels),
    loopintensiteit: regels.loopintensiteit(inOrde, vorigeWeekGelopen, stapTerug,
      seizoen.kineAkkoordLoopintensiteit(checkpoints), week, drempels),
    garmin_ftp: regels.garminFtp(data.wellness),
    pauzeweken,
    // de dagen van de week waarop de kine lopen afraadt: daar mag geen loopje staan
    looppauze_dagen: seizoen.looppauzeDagen(checkpoints, week),
  };
}

                                                   
