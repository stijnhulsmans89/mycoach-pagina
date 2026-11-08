// Wat de pagina naast trainingen en wellness nodig heeft, staat als notitie in de kalender van intervals.icu:
// - de weeknotitie op maandag: de uitleg van de week en het weekplan met akkoord;
// - de notitie "MyCoach: gegevens" op een vaste datum: profiel, drempels, kine, seizoensplan en kine-checkpoints.
// Zo is intervals.icu de enige bron voor de pagina, en staat er niets persoonlijks in de publieke repo.
// Dit bestand bevat geen in- of uitvoer: het maakt de notities en leest ze terug (ook in de browser).

                                                              
                                        
import { KENMERK, kort } from "./regels.js";

/** Een notitie om in de kalender te zetten (`Intervals.zetNotitie`). */
                                                                                             

/** De vaste dag van de gegevensnotitie: zo vindt de pagina ze zonder te zoeken. */
export const GEGEVENS_DATUM        = "2026-01-01";
export const GEGEVENS_ID = `${KENMERK}gegevens`;
export const OEFENINGEN_ID = `${KENMERK}oefeningen`;
export const DATA_REGEL = "MyCoach-data (niet wijzigen): ";
export const VERSIE = 1;

export const KENMERK_WEEK = `${KENMERK}week-`;

export function weekId(week       )         {
  return `${KENMERK_WEEK}${week}`;
}

/** Tekst voor mensen, met onderaan één regel met de data als JSON. */
export function metData(tekst        , data         )         {
  return `${tekst.trim()}\n\n${DATA_REGEL}${JSON.stringify(data)}`.trim();
}

/** De data uit de beschrijving van een notitie, of null als die er niet (goed) in staat. */
export function leesData(beschrijving                           )             {
  const regel = (beschrijving ?? "").split(/\r?\n/).find((r) => r.startsWith(DATA_REGEL));
  if (!regel) return null;
  try {
    return JSON.parse(regel.slice(DATA_REGEL.length));
  } catch {
    return null;
  }
}

/** Uitleg op één regel: een regel die met "-" begint, zou intervals.icu als stap van de training lezen. */
export function eenRegel(tekst        )         {
  return tekst.replace(/\s*\n\s*/g, " ").trim();
}

/** De weeknotitie: de uitleg van de week voor mensen, en het weekplan met akkoord voor de pagina. */
export function weekNotitie(plan     )                {
  const akkoord = plan.akkoord;
  const data = { versie: VERSIE, week: plan.week, akkoord_op: plan.akkoord_op ?? null,
                 bijsturing_vanaf: plan.bijsturing_vanaf ?? null, trainingen: akkoord.trainingen,
                 uitleg: akkoord.uitleg ?? null };
  return {
    datum: plan.week,
    kenmerk: weekId(plan.week),
    naam: `MyCoach: week van ${kort(plan.week)}`,
    tekst: metData(akkoord.uitleg ?? "", data),
  };
}

/** Wat de pagina uit het profiel nodig heeft. */
export function profielVoorPagina(profiel         )      {
  const { atleet, velden, opbouw_start, start_loopvolume, ochtendtest_start, drempels, kine } = profiel;
  return { atleet, velden, opbouw_start, start_loopvolume, ochtendtest_start: ochtendtest_start ?? null, drempels, kine };
}

/** De gegevensnotitie: het profiel, het seizoensplan, de kine-checkpoints en de pijnschaal. */
export function gegevensNotitie(profiel         , seizoensplan            , checkpoints             , pijnschaal     ,
                                bijgewerktOp        )                {
  const data = { versie: VERSIE, bijgewerkt_op: bijgewerktOp, profiel: profielVoorPagina(profiel), seizoensplan, checkpoints,
                 pijnschaal };
  return {
    datum: GEGEVENS_DATUM,
    kenmerk: GEGEVENS_ID,
    naam: "MyCoach: gegevens",
    tekst: metData("De gegevens van MyCoach voor de pagina op je gsm: profiel, drempels, kine, seizoensplan " +
      "en kine-checkpoints. De coach werkt deze notitie zelf bij; wijzig of verwijder ze niet.", data),
  };
}

/** De oefeningennotitie: de oefeningen met hun figuurtjes, apart omdat ze groot is. */
export function oefeningenNotitie(oefeningen     , bijgewerktOp        )                {
  return {
    datum: GEGEVENS_DATUM,
    kenmerk: OEFENINGEN_ID,
    naam: "MyCoach: oefeningen",
    tekst: metData("De oefeningen van MyCoach met hun figuurtjes, voor de pagina op je gsm. De coach werkt deze " +
      "notitie zelf bij; wijzig of verwijder ze niet.", { versie: VERSIE, bijgewerkt_op: bijgewerktOp, oefeningen }),
  };
}
