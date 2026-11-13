// De planweek: de week waarvoor de coach een weekplan of bijsturing maakt, en de regels die er gelden.
// Rekent alleen, zonder ophalen: de data komt uit `momentopname.haalData`. `status`, `controleer`, `plaats` en de
// weekstatus van de pagina gebruiken deze module, zodat de knieregels voor een week maar op één plek afgeleid worden.

                                                         
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

/**
 * Pijnregel, opbouw, toegelaten loopvolume, harde trainingen, loopintensiteit en Garmin-FTP voor `week`: de
 * planweek van `status` en `controleer`, maar ook de lopende week van de weekstatus op de pagina.
 * `pijnregel` bevat de weken tot en met `week`; `weken_in_orde` telt alleen de weken ervoor.
 */
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
  const opbouw = regels.opbouw(opbouwweken, volume, pijnregel, profiel);

  const laatste = opbouw[opbouw.length - 1];
  const stapTerug = laatste.soort === "stap_terug";
  const inOrde = regels.wekenInOrde(pijnregel, week);
  const vorigeWeekGelopen = opbouw.length > 1 ? opbouw[opbouw.length - 2].werkelijk : 0;
  return {
    week,
    opbouw,
    pijnregel,
    ochtendpijn,
    toegelaten: laatste.toegelaten,
    stap_terug: stapTerug,
    weken_in_orde: inOrde,
    // na een stap terug geen enkele harde training, van geen enkele soort: bij twijfel lichter
    harde_trainingen_max: stapTerug ? 0 : regels.hardeTrainingenMax(inOrde, drempels),
    loopintensiteit: regels.loopintensiteit(inOrde, vorigeWeekGelopen, stapTerug,
      seizoen.kineAkkoordLoopintensiteit(checkpoints), week, drempels),
    garmin_ftp: regels.garminFtp(data.wellness),
  };
}

                                                   
