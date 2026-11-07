// Haalt de data op bij de adapter en past de regels toe: de inhoud van `status`.

                                                                  
import { maandag, plusDagen, weekdag,            } from "./datum.js";
import * as regels from "./regels.js";
import * as seizoen from "./seizoen.js";

export const TOON_DAGEN = 28;
export const WELLNESS_DAGEN = 60;
// zo ver terug zoekt de coach de laatste Garmin-FTP (een wellness-veld)
export const FTP_DAGEN = 365;

/** De week waarvoor een weekplan gemaakt wordt: deze week op maandag, anders de volgende. */
export function planweekVoor(vandaag       )        {
  return weekdag(vandaag) === 0 ? vandaag : plusDagen(maandag(vandaag), 7);
}

                                                                                          

const opStart = (a     , b     ) => regels.vergelijk(a.start_date_local ?? "", b.start_date_local ?? "");

/** Alle ruwe data die de regels nodig hebben. */
export async function haalData(adapter         , vandaag       , profiel         )                {
  const oudste = [plusDagen(vandaag, -WELLNESS_DAGEN), plusDagen(profiel.opbouw_start, -7)].sort()[0];
  const oudsteWellness = [oudste, plusDagen(vandaag, -FTP_DAGEN)].sort()[0];
  const [activiteiten, wellness, atleet] = await Promise.all([
    adapter.activiteiten(oudste, vandaag), adapter.wellness(oudsteWellness, vandaag), adapter.atleet()]);
  return {
    atleet,
    activiteiten: [...activiteiten].sort(opStart),
    wellness: [...wellness].sort((a, b) => regels.vergelijk(a.id, b.id)),
    oudste,
  };
}

export function weken(van       , tot       )          {
  const resultaat          = [];
  for (let week = van; week <= tot; week = plusDagen(week, 7)) resultaat.push(week);
  return resultaat;
}

/** Pijnregel, opbouw en toegelaten loopvolume tot en met de planweek. */
export function berekenRegels(data      , profiel         , planweek       ) {
  const { velden, drempels } = profiel;
  const activiteiten = data.activiteiten;
  const ochtendpijn = regels.ochtendpijnPerDag(data.wellness, velden.ochtendpijn);
  const start = [maandag(profiel.opbouw_start), planweek].sort()[0];
  const opbouwweken = weken(start, planweek);
  const volume = regels.loopvolumePerWeek(activiteiten, start, planweek);
  const startTest = regels.ochtendtestStart(profiel);
  const pijnregel = new Map(opbouwweken.map((w) =>
    [w, regels.pijnregelWeek(w, activiteiten, ochtendpijn, velden.kniepijn, drempels, startTest)]));
  const opbouw = regels.opbouw(opbouwweken, volume, pijnregel, profiel);
  return { ochtendpijn, pijnregel, opbouw };
}

export async function status(adapter         , opslag        , vandaag       ) {
  const profiel = await opslag.profiel();
  const { velden, drempels } = profiel;
  const [data, alleWedstrijden, seizoensplan, checkpoints] = await Promise.all([
    haalData(adapter, vandaag, profiel), seizoen.haalWedstrijden(adapter, vandaag),
    opslag.seizoensplan(), opslag.checkpoints()]);
  const { activiteiten, atleet } = data;
  const planweek = planweekVoor(vandaag);

  const atleetprofiel = regels.atleetprofiel(atleet, profiel);
  const ftp = regels.ftpVergelijking(atleetprofiel.ftp, regels.eftp(activiteiten), drempels,
    regels.garminFtp(data.wellness, velden.garmin_ftp), vandaag);
  const voorstellen           = [];
  const wellness = data.wellness.map((r) => regels.wellnessSamenvatting(r, velden));
  const eersteWeek = maandag(plusDagen(vandaag, -WELLNESS_DAGEN));
  const volume = regels.loopvolumePerWeek(activiteiten, eersteWeek, maandag(vandaag));
  const fietstijd = regels.fietstijdPerWeek(activiteiten, eersteWeek, maandag(vandaag));
  const berekend = berekenRegels(data, profiel, planweek);
  const opbouw = berekend.opbouw;
  const laatste = opbouw[opbouw.length - 1];
  const planweekOpbouw = { week: laatste.week, soort: laatste.soort, toegelaten: laatste.toegelaten };
  const inOrde = regels.wekenInOrde(berekend.pijnregel, planweek);
  const toonVanaf = plusDagen(vandaag, -TOON_DAGEN);

  if (seizoensplan && seizoensplan.doel.datum < vandaag) {
    voorstellen.push(`Je A-wedstrijd van ${seizoensplan.doel.datum} is voorbij. Tijd voor een nieuw ` +
      "seizoensplan richting je volgende A-wedstrijd.");
  }
  const waarschuwingen = [
    ...regels.pijnWaarschuwingen(activiteiten, berekend.ochtendpijn, velden.kniepijn, drempels, vandaag, 7,
      regels.ochtendtestStart(profiel)),
    ...regels.herstelWaarschuwingen(wellness, drempels, vandaag),
    ...regels.opbouwWaarschuwingen(opbouw, drempels),
    ...seizoen.checkpointWaarschuwingen(alleWedstrijden, vandaag, drempels, checkpoints),
  ];

  const samenvatting = (activiteit     ) => {
    const reden = regels.hardeTraining(activiteit, drempels);
    return { ...regels.activiteitSamenvatting(activiteit, velden), hard: reden !== null, hard_reden: reden };
  };

  return {
    vandaag,
    planweek,
    profiel: atleetprofiel,
    ftp,
    voorstellen,
    loopvolume_per_week: [...volume].map(([week, minuten]) => ({ week, minuten })),
    fietstijd_per_week: [...fietstijd].map(([week, minuten]) => ({ week, minuten })),
    activiteiten: activiteiten.filter((a) => regels.datumVan(a) >= toonVanaf).map(samenvatting),
    wellness: wellness.filter((w) => w.datum >= toonVanaf),
    belasting: regels.huidigeBelasting(wellness),
    pijnregel: [...berekend.pijnregel].filter(([w]) => w < planweek).map(([, p]) => p),
    opbouw: {
      weken: opbouw, planweek: planweekOpbouw,
      // midweek bouwt de planweek op een week die nog niet af is: plan best op zondag
      basisweek_loopt_nog: planweek > vandaag && weekdag(vandaag) < 6,
    },
    toegelaten_loopvolume: planweekOpbouw.toegelaten,
    fietsen_alleen_rustig: planweekOpbouw.soort === "stap_terug",
    harde_trainingen_max: regels.hardeTrainingenMax(inOrde, drempels),
    loopintensiteit: regels.loopintensiteit(inOrde, opbouw.length > 1 ? opbouw[opbouw.length - 2].werkelijk : 0,
      planweekOpbouw.soort === "stap_terug", seizoen.kineAkkoordLoopintensiteit(checkpoints), planweek, drempels),
    waarschuwingen,
    wedstrijden: alleWedstrijden.filter((w) => w.datum >= vandaag),
    seizoensplan,
    huidige_fase: seizoen.faseOp(seizoensplan, vandaag),
    planweek_fase: seizoen.faseOp(seizoensplan, planweek),
  };
}

                                                        
