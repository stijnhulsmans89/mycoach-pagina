// Wat de atleet zelf ingeeft: kniepijn bij een training, ochtendpijn bij een dag en de Garmin-FTP.
// De controle van de invoer staat hier één keer, voor het coach-commando en de pagina; het schrijven zelf
// doet intervals.ts. Geen `node:`-imports: de pagina gebruikt deze module ook.

                                                
                                                            
import { plusDagen,            } from "./datum.js";
import { FTP_DAGEN } from "./momentopname.js";
import * as regels from "./regels.js";

export const SOORTEN = regels.TYPES_PER_SOORT;
export const PIJN_MIN = 0, PIJN_MAX = 10;
export const FTP_MIN = 50, FTP_MAX = 600;

/** Waarom een pijnscore niet kan, of null als ze goed is. */
export function pijnscoreFout(score        )                {
  return Number.isInteger(score) && PIJN_MIN <= score && score <= PIJN_MAX
    ? null : `Een pijnscore ligt tussen ${PIJN_MIN} en ${PIJN_MAX}.`;
}

/** Waarom een Garmin-FTP niet kan, of null als ze goed is. */
export function ftpFout(watt        )                {
  return Number.isInteger(watt) && FTP_MIN <= watt && watt <= FTP_MAX ? null : `Een FTP ligt tussen ${FTP_MIN} en ${FTP_MAX} W.`;
}

export async function zetKniepijn(intervals           , opslag        , score        , datum       ,
                                  sport = "loopje", activiteitId                = null)               {
  const fout = pijnscoreFout(score);
  if (fout) return { ok: false, fout, pijnschaal: await opslag.pijnschaal() };
  const trainingen = await intervals.activiteiten(datum, datum);
  let kandidaten              ;
  if (activiteitId !== null) kandidaten = trainingen.filter((a) => String(a.id) === String(activiteitId));
  else if (sport === "alle") kandidaten = trainingen;
  else kandidaten = trainingen.filter((a) => SOORTEN[sport].has(a.type ?? ""));

  if (kandidaten.length !== 1) {
    if (activiteitId === null && !kandidaten.length) kandidaten = trainingen;
    const reden = kandidaten.length > 1 ? "meerdere trainingen" : "geen passende training";
    return {
      ok: false,
      reden: `${reden} op ${datum}; vraag de atleet bij welke training de score hoort`,
      kandidaten: kandidaten.map((a) => regels.activiteitSamenvatting(a)),
    };
  }

  const training = kandidaten[0];
  const vorige = training.kniepijn;
  await intervals.zetKniepijn(training.id , score);
  return {
    ok: true,
    gezet: { soort: "kniepijn", score, vorige,
             activiteit: regels.activiteitSamenvatting({ ...training, kniepijn: score }) },
  };
}

export async function zetOchtendpijn(intervals           , opslag        , score        , datum       )               {
  const fout = pijnscoreFout(score);
  if (fout) return { ok: false, fout, pijnschaal: await opslag.pijnschaal() };
  const records = await intervals.wellness(datum, datum);
  const vorige = records.length ? records[0].ochtendpijn : null;
  await intervals.zetOchtendpijn(datum, score);
  return { ok: true, gezet: { soort: "ochtendpijn", score, vorige, datum } };
}

/** De pijnwaarschuwingen over de laatste week. */
export async function waarschuwingen(intervals           , opslag        , vandaag       ) {
  const profiel = await opslag.profiel();
  const { drempels } = profiel;
  const oudste = plusDagen(vandaag, -7);
  const activiteiten = [...await intervals.activiteiten(oudste, vandaag)]
    .sort((a, b) => regels.vergelijk(a.start, b.start));
  const ochtendpijn = regels.ochtendpijnPerDag(await intervals.wellness(oudste, vandaag));
  return regels.pijnWaarschuwingen(activiteiten, ochtendpijn, drempels, vandaag, 7,
    regels.ochtendtestStart(profiel));
}

/** Voegt de pijnwaarschuwingen toe, zodat de skill meteen kan reageren. */
export async function metWaarschuwingen(intervals           , opslag        , resultaat     , vandaag       ) {
  if (resultaat.ok) resultaat.waarschuwingen = await waarschuwingen(intervals, opslag, vandaag);
  return resultaat;
}

/** De FTP die de Garmin schat, als wellness-veld in intervals.icu op de dag van de schatting. */
export async function zetFtp(intervals           , waarde        , datum       ) {
  const fout = ftpFout(waarde);
  if (fout) return { ok: false, fout };
  const vorige = regels.garminFtp(await intervals.wellness(plusDagen(datum, -FTP_DAGEN), datum), datum);
  await intervals.zetGarminFtp(datum, waarde);
  return { ok: true, gezet: { soort: "ftp", waarde, datum, vorige } };
}
