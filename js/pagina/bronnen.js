// De bronnen in de browser: intervals.icu rechtstreeks vanaf de gsm, met de sleutel uit de browseropslag.
// De opslag komt uit de notities van de coach in de kalender (gegevens, oefeningen, weeknotities):
// in de browser bestaat geen `data/`, intervals.icu is de enige bron.
// Dit bestand mag niets uit Node gebruiken: de bouwstap weigert elke `node:`-import.

import { AdapterFout,                                                                            } from "../bronnen.js";
import { plusDagen,            } from "../datum.js";
import { GEGEVENS_DATUM, GEGEVENS_ID, KENMERK_WEEK, leesData, OEFENINGEN_ID } from "../gegevens.js";

export const INTERVALS = "https://intervals.icu/api/v1";

/** Geen verbinding: dan bewaart de pagina wat je ingaf, en toont ze de laatste momentopname. */
export class GeenVerbinding extends AdapterFout {}

export class BrowserAdapter                           {
                   auth        ;
                   basis        ;
  constructor(sleutel        , basis = INTERVALS) {
    this.auth = "Basic " + btoa(`API_KEY:${sleutel}`);
    this.basis = basis;
  }

          async vraag(methode        , pad        , params                         , body          )                              {
    const url = this.basis + pad + (params ? "?" + new URLSearchParams(params) : "");
    const headers                         = { Authorization: this.auth, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let antwoord          ;
    try {
      antwoord = await fetch(url, { method: methode, headers, body: body === undefined ? undefined : JSON.stringify(body),
                                    signal: AbortSignal.timeout(20_000), credentials: "omit", referrerPolicy: "no-referrer" });
    } catch {
      throw new GeenVerbinding("intervals.icu is niet bereikbaar.");
    }
    if (antwoord.status === 401 || antwoord.status === 403) {
      throw new AdapterFout("intervals.icu weigert de sleutel. Controleer of je de juiste API-sleutel plakte, of plak een nieuwe.");
    }
    if (!antwoord.ok) throw new AdapterFout(`intervals.icu gaf ${antwoord.status} op ${methode} ${pad}`);
    const inhoud = await antwoord.text();
    return inhoud ? JSON.parse(inhoud) : null;
  }

          bereik(oudste       , nieuwste       ) {
    return { oldest: oudste, newest: nieuwste };
  }

  // athlete 0 is "de atleet van deze sleutel": zo staat er geen atleet-ID in de code
  async atleet() { return (await this.vraag("GET", "/athlete/0"))       ; }
  async activiteiten(oudste       , nieuwste       ) {
    return ((await this.vraag("GET", "/athlete/0/activities", this.bereik(oudste, nieuwste))) || [])         ;
  }
  async wellness(oudste       , nieuwste       ) {
    return ((await this.vraag("GET", "/athlete/0/wellness", this.bereik(oudste, nieuwste))) || [])         ;
  }
  async events(oudste       , nieuwste       ) {
    return ((await this.vraag("GET", "/athlete/0/events", this.bereik(oudste, nieuwste))) || [])         ;
  }
  async wijzigActiviteit(id                 , velden     ) {
    return (await this.vraag("PUT", `/activity/${encodeURIComponent(String(id))}`, undefined, velden))       ;
  }
  async wijzigWellness(datum       , velden     ) {
    return (await this.vraag("PUT", `/athlete/0/wellness/${datum}`, undefined, { id: datum, ...velden }))       ;
  }
  async maakEvent()               {
    throw new AdapterFout("De pagina zet nooit iets in de kalender: dat doet de coach na je akkoord.");
  }
  async verwijderEvent()                {
    throw new AdapterFout("De pagina verwijdert nooit iets uit de kalender.");
  }
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

  static async laad(adapter                , vandaag       )                         {
    const vast = await adapter.events(GEGEVENS_DATUM, GEGEVENS_DATUM);
    const gegevens = leesData(vast.find((e) => e.external_id === GEGEVENS_ID)?.description);
    if (!gegevens?.profiel) {
      throw new AdapterFout("De gegevens van de coach staan nog niet in intervals.icu. Vraag de coach in Claude Code: node coach gegevens.");
    }
    const oefeningen = leesData(vast.find((e) => e.external_id === OEFENINGEN_ID)?.description)?.oefeningen ?? {};
    // weeknotities van het begin van het seizoensplan (of 10 weken terug) tot volgende week
    const start        = gegevens.seizoensplan?.start ?? gegevens.seizoensplan?.fases?.[0]?.van ?? vandaag;
    const oudste = [start, plusDagen(vandaag, -70)].sort()[0];
    const weken = new Map            ();
    for (const event of await adapter.events(oudste, plusDagen(vandaag, 14))) {
      if (!String(event.external_id ?? "").startsWith(KENMERK_WEEK)) continue;
      const data = leesData(event.description);
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
