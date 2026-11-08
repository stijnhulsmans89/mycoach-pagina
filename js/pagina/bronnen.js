// De bronnen in de browser: intervals.icu rechtstreeks vanaf de gsm, met de sleutel uit de browseropslag.
// De opslag komt uit de notities van de coach in de kalender (gegevens, oefeningen, weeknotities):
// in de browser bestaat geen `data/`, intervals.icu is de enige bron.
// Dit bestand mag niets uit Node gebruiken: de bouwstap weigert elke `node:`-import.

import { AdapterFout,                                                       } from "../bronnen.js";
import { plusDagen,            } from "../datum.js";
import { GEGEVENS_DATUM, GEGEVENS_ID, KENMERK_WEEK, leesData, OEFENINGEN_ID } from "../gegevens.js";
import { GeenVerbinding, httpTransport,                 KENMERK,                } from "../intervals.js";

export { GeenVerbinding };

export const INTERVALS = "https://intervals.icu/api/v1";

/** Het transport van de pagina: alleen lezen en pijn of FTP zetten, nooit iets in de kalender. */
export function browserTransport(sleutel        , basis = INTERVALS, haal               = fetch)            {
  const http = httpTransport(sleutel, {
    basis, fetch: haal, timeoutMs: 20_000, init: { credentials: "omit", referrerPolicy: "no-referrer" },
    geenVerbinding: () => new GeenVerbinding("intervals.icu is niet bereikbaar."),
    sleutelGeweigerd: "intervals.icu weigert de sleutel. Controleer of je de juiste API-sleutel plakte, of plak een nieuwe.",
  });
  return async (methode, pad, params, body) => {
    if (methode === "POST") throw new AdapterFout("De pagina zet nooit iets in de kalender: dat doet de coach na je akkoord.");
    if (methode === "DELETE") throw new AdapterFout("De pagina verwijdert nooit iets uit de kalender.");
    return http(methode, pad, params, body);
  };
}

/** Een weekplan zoals de coach het op de Mac bewaart, terug opgebouwd uit de weeknotitie. */
function weekplanUitNotitie(data     )      {
  return {
    week: data.week, status: "akkoord", voorstel: null, akkoord_op: data.akkoord_op ?? null,
    bijsturing_vanaf: data.bijsturing_vanaf ?? null,
    akkoord: { week: data.week, trainingen: data.trainingen ?? [], uitleg: data.uitleg ?? null },
  };
}

/** De opslag van de pagina: alles uit de notities van de coach, één keer opgehaald. */
export class NotitieOpslag                   {
                   gegevens     ;
                   oefeningenLijst     ;
                   weekplannen                 ;
          constructor(gegevens     , oefeningenLijst     , weekplannen                 ) {
    this.gegevens = gegevens;
    this.oefeningenLijst = oefeningenLijst;
    this.weekplannen = weekplannen;
  }

  static async laad(intervals           , vandaag       )                         {
    const vast = await intervals.notities(GEGEVENS_DATUM, GEGEVENS_DATUM, KENMERK);
    const gegevens = leesData(vast.find((n) => n.kenmerk === GEGEVENS_ID)?.tekst);
    if (!gegevens?.profiel) {
      throw new AdapterFout("De gegevens van de coach staan nog niet in intervals.icu. Vraag de coach in Claude Code: node coach gegevens.");
    }
    const oefeningen = leesData(vast.find((n) => n.kenmerk === OEFENINGEN_ID)?.tekst)?.oefeningen ?? {};
    // weeknotities van het begin van het seizoensplan (of 10 weken terug) tot volgende week
    const start        = gegevens.seizoensplan?.start ?? gegevens.seizoensplan?.fases?.[0]?.van ?? vandaag;
    const oudste = [start, plusDagen(vandaag, -70)].sort()[0];
    const weken = new Map            ();
    for (const notitie of await intervals.notities(oudste, plusDagen(vandaag, 14), KENMERK_WEEK)) {
      const data = leesData(notitie.tekst);
      if (data?.week) weken.set(data.week, weekplanUitNotitie(data));
    }
    return new NotitieOpslag(gegevens, oefeningen, weken);
  }

  async profiel() { return { ...this.gegevens.profiel, plaatsen_aan: false }           ; }
  async oefeningen() { return this.oefeningenLijst; }
  async seizoensplan() { return this.gegevens.seizoensplan ?? null; }
  async checkpoints() { return (this.gegevens.checkpoints ?? { afgevinkt: {} })               ; }
  async weekplan(week       ) { return this.weekplannen.get(week) ?? null; }
  async pijnschaal() { return this.gegevens.pijnschaal ?? {}; }
}
