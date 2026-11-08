// intervals.icu, de enige bron (ADR 0002). Alleen deze module kent het URL-schema en de schrijfacties;
// daaronder zit een transport: één functie die een verzoek doet. Er zijn drie transports: HTTP op de Mac,
// HTTP in de browser (de pagina) en de routes over de fixture-bestanden (tests en proefserver).
// Geen `node:`-imports: de pagina gebruikt deze module ook.

import { AdapterFout,          } from "./bronnen.js";
                                        
import { pyRound } from "./py.js";

/** Eén verzoek aan intervals.icu: pad zonder basis (bv. `/athlete/0/events`), antwoord als JSON of `null`. */
                                                                                                                            

/** Geen verbinding: dan bewaart de pagina wat je ingaf, en toont ze de laatste momentopname. */
export class GeenVerbinding extends AdapterFout {}

                             
                
                       
                    
                                   
                     
                                                                                    
                                                 
                                                                                          
                            
 

/** Het HTTP-transport, met Basic-authenticatie `API_KEY:<sleutel>`. */
export function httpTransport(sleutel        , opties            )            {
  const auth = "Basic " + btoa(`API_KEY:${sleutel}`);
  return async (methode, pad, params, body) => {
    const url = opties.basis + pad + (params ? "?" + new URLSearchParams(params) : "");
    const headers                         = { Authorization: auth, Accept: "application/json", ...opties.headers };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let antwoord          ;
    try {
      antwoord = await (opties.fetch ?? fetch)(url, {
        ...opties.init, method: methode, headers, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(opties.timeoutMs),
      });
    } catch (fout) {
      const reden = fout instanceof Error ? (fout.cause instanceof Error ? fout.cause.message : fout.message) : String(fout);
      throw opties.geenVerbinding(reden);
    }
    if (opties.sleutelGeweigerd && (antwoord.status === 401 || antwoord.status === 403)) {
      throw new AdapterFout(opties.sleutelGeweigerd);
    }
    if (!antwoord.ok) throw new AdapterFout(`intervals.icu gaf ${antwoord.status} op ${methode} ${pad}`);
    const inhoud = await antwoord.text();
    return inhoud ? JSON.parse(inhoud) : null;
  };
}

// --- Lezen in domeintaal --------------------------------------------------------------

export const LOOPTYPES = new Set(["Run", "TrailRun"]);
/** De sporttypes van intervals.icu per soort training. */
export const TYPES_PER_SOORT                              = {
  loopje: LOOPTYPES,
  mtb: new Set(["MountainBikeRide", "Ride", "GravelRide", "EMountainBikeRide"]),
  rollen: new Set(["VirtualRide"]),
  kracht: new Set(["WeightTraining"]),
};

/** Een gedane training. `seconden` is de bewegingstijd (anders de totale tijd), onafgerond. */
                             
                             
               
                                                                 
                
                                                        
                      
                                                                
                       
                      
                   
                           
                                                
                          
                              
                                                      
                      
                          
 

/** Eén dag wellness. Fitheid en vermoeidheid zijn onafgerond. */
                              
               
                         
                              
                     
                              
                                
                             
                            
 

/** De drempels die in intervals.icu ingesteld zijn, per sport. */
                         
                    
                                                             
                                                     
 

/** De soort training (loopje, mtb, rollen, kracht) bij een sporttype van intervals.icu, of null. */
export function soortVanType(type               )                {
  for (const [soort, types] of Object.entries(TYPES_PER_SOORT)) if (type && types.has(type)) return soort;
  return null;
}

function dagVan(waarde         )        {
  return String(waarde).slice(0, 10);
}

export function naarActiviteit(r     , velden        )             {
  const type = r.type ?? null;
  return {
    id: r.id ?? null,
    datum: dagVan(r.start_date_local || r.id),
    start: r.start_date_local ?? "",
    type,
    soort: soortVanType(type),
    naam: r.name ?? null,
    seconden: r.moving_time || r.elapsed_time || 0,
    belasting: r.icu_training_load ?? null,
    zone_seconden: r.icu_hr_zone_times || [],
    gem_hartslag: r.average_heartrate ?? null,
    eftp: r.icu_rolling_ftp ?? null,
    kniepijn: r[velden.kniepijn] ?? null,
  };
}

export function naarWellnessdag(r     , velden        )              {
  return {
    datum: dagVan(r.id),
    fitheid: r.ctl ?? null,
    vermoeidheid: r.atl ?? null,
    hrv: r.hrv ?? null,
    rusthartslag: r.restingHR ?? null,
    slaap_seconden: r.sleepSecs ?? null,
    ochtendpijn: r[velden.ochtendpijn] ?? null,
    garmin_ftp: r[velden.garmin_ftp] ?? null,
  };
}

/** De eerste sportinstelling voor die sport, zoals intervals.icu ze toont. */
function sportinstelling(atleet     , sport        )      {
  return (atleet.sportSettings || []).find((i     ) => (i.types || []).includes(sport)) ?? {};
}

export function naarAtleet(r     )         {
  const loop = sportinstelling(r, "Run"), fiets = sportinstelling(r, "Ride");
  return {
    id: r.id ?? null,
    loop: { lthr: loop.lthr ?? null, max_hartslag: loop.max_hr ?? null },
    fiets: { ftp: fiets.ftp ?? null, lthr: fiets.lthr ?? null },
  };
}

// --- Events: trainingen, wedstrijden en notities in de kalender -------------------------

/** Het begin van de `external_id` van elk event dat MyCoach aanmaakt: het kenmerk. */
export const KENMERK = "mycoach-";
/** Het sporttype van intervals.icu voor een geplande training van elke soort. */
const TYPE_VOOR_SOORT                         = {
  loopje: "Run", mtb: "MountainBikeRide", rollen: "VirtualRide", kracht: "WeightTraining",
};
/** Het sporttype van intervals.icu voor een wedstrijd in elke sport. */
export const SPORT_TYPE                         = { lopen: "Run", mtb: "MountainBikeRide" };
const RACE                         = { RACE_A: "A", RACE_B: "B", RACE_C: "C" };
// hoogtemeters hebben geen eigen veld in een event: ze staan als regel in de beschrijving
const HOOGTEMETERS = /^Hoogtemeters: (\d+)$/m;

                            
               
                      
                         
                     
                            
                              
                          
                                   
 

/** Een notitie van MyCoach in de kalender: een tekst op een dag, terug te vinden op haar kenmerk. */
                                                                                                                          

/** Een geplande training, zoals ze op het horloge komt. */
                                   
                                                                                                     
 

/** Een wedstrijd die de atleet doorgeeft. */
                                  
                                                                                    
                                                                        
 

function begin(datum       )         {
  return `${datum}T00:00:00`;
}

/** Een race-event als wedstrijd; null voor een ander event. */
export function naarWedstrijd(r     )                   {
  if (!(r.category in RACE)) return null;
  const afstand = r.distance, duur = r.moving_time;
  const hoogte = HOOGTEMETERS.exec(r.description || "");
  return {
    datum: dagVan(r.start_date_local || r.id),
    naam: r.name ?? null,
    sport: TYPES_PER_SOORT.mtb.has(r.type) ? "mtb" : "lopen",
    prioriteit: RACE[r.category],
    afstand_km: afstand ? pyRound(afstand / 1000, 1) : null,
    hoogtemeters: hoogte ? Number(hoogte[1]) : null,
    duur_min: duur ? pyRound(duur / 60) : null,
    event_id: r.id ?? null,
  };
}

/** De eigen velden in intervals.icu, uit het profiel. */
                                                                                     

// athlete 0 is "de atleet van deze sleutel": zo staat er geen atleet-ID in de code
const ATLEET = "/athlete/0";

/**
 * intervals.icu in de taal van de coach: activiteiten, wellness, de atleet, wedstrijden en notities komen vertaald
 * binnen, en schrijven gaat alleen via de acties hieronder. Niemand anders kent de veldnamen, de soorten events,
 * de `external_id` of het URL-schema.
 * `velden` geeft de eigen wellness- en activiteitvelden uit het profiel.
 */
export class Intervals {
                   vraag           ;
                   velden                                ;
  constructor(transport           , velden                                ) {
    this.vraag = transport;
    this.velden = velden;
  }

          async lijst(pad        , oudste       , nieuwste       )                 {
    return ((await this.vraag("GET", ATLEET + pad, { oldest: oudste, newest: nieuwste })) || [])         ;
  }

  async atleet()                  { return naarAtleet(((await this.vraag("GET", ATLEET)) ?? {})       ); }

  async activiteiten(oudste       , nieuwste       )                        {
    const velden = await this.velden();
    return (await this.lijst("/activities", oudste, nieuwste)).map((r) => naarActiviteit(r, velden));
  }

  async wellness(oudste       , nieuwste       )                         {
    const velden = await this.velden();
    return (await this.lijst("/wellness", oudste, nieuwste)).map((r) => naarWellnessdag(r, velden));
  }

          events(oudste       , nieuwste       ) { return this.lijst("/events", oudste, nieuwste); }

  /** De wedstrijden tussen twee dagen, oplopend op datum. */
  async wedstrijden(oudste       , nieuwste       )                       {
    return (await this.events(oudste, nieuwste)).map(naarWedstrijd).filter((w)                 => w !== null)
      .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  }

  /** De notities van MyCoach tussen twee dagen waarvan het kenmerk zo begint. */
  async notities(oudste       , nieuwste       , kenmerkBegin        )                     {
    return (await this.events(oudste, nieuwste))
      .filter((e) => String(e.external_id ?? "").startsWith(kenmerkBegin))
      .map((e) => ({ id: e.id ?? null, datum: dagVan(e.start_date_local || e.id), kenmerk: e.external_id,
                     naam: e.name ?? null, tekst: e.description ?? "" }));
  }

          async wijzigWellness(datum       , velden     )               {
    return (await this.vraag("PUT", `${ATLEET}/wellness/${datum}`, undefined, { id: datum, ...velden }))       ;
  }

  /** De kniepijn bij een training. */
  async zetKniepijn(activiteit                 , score        )               {
    const { kniepijn } = await this.velden();
    return (await this.vraag("PUT", `/activity/${encodeURIComponent(String(activiteit))}`, undefined,
      { [kniepijn]: score }))       ;
  }

  /** De ochtendpijn van een dag. */
  async zetOchtendpijn(datum       , score        )               {
    return this.wijzigWellness(datum, { [(await this.velden()).ochtendpijn]: score });
  }

  /** De Garmin-FTP, op de dag van de schatting. */
  async zetGarminFtp(datum       , watt        )               {
    return this.wijzigWellness(datum, { [(await this.velden()).garmin_ftp]: watt });
  }

          async maakEvent(event     )               {
    return (await this.vraag("POST", `${ATLEET}/events`, undefined, event))       ;
  }

          async verwijder(events       , weg                     )                               {
    const verwijderd                      = [];
    for (const event of events) {
      if (!weg(event)) continue;
      await this.vraag("DELETE", `${ATLEET}/events/${encodeURIComponent(String(event.id))}`);
      verwijderd.push(event.id);
    }
    return verwijderd;
  }

  /** Verwijdert de events met dit kenmerk tussen twee dagen. Geeft hun id's. */
  async verwijderOpKenmerk(oudste       , nieuwste       , kenmerk        ) {
    return this.verwijder(await this.events(oudste, nieuwste), (e) => e.external_id === kenmerk);
  }

  /** Verwijdert de geplande trainingen van MyCoach tussen twee dagen; notities en wedstrijden blijven. */
  async verwijderEigenTrainingen(oudste       , nieuwste       ) {
    return this.verwijder(await this.events(oudste, nieuwste),
      (e) => String(e.external_id || "").startsWith(KENMERK) && e.category === "WORKOUT");
  }

  /** Zet een training in de kalender, zodat ze op het horloge komt. */
  async planTraining(t                  ) {
    const event = await this.maakEvent({
      category: "WORKOUT", start_date_local: begin(t.datum), type: TYPE_VOOR_SOORT[t.soort], name: t.naam,
      description: t.beschrijving, moving_time: t.duur_min * 60, external_id: t.kenmerk,
    });
    return { id: event.id ?? null, naam: event.name ?? null, type: event.type ?? null,
             beschrijving: event.description ?? null };
  }

  /** Zet een wedstrijd in de kalender, in de plaats van de wedstrijd met hetzelfde kenmerk. */
  async zetWedstrijd(w                 )                     {
    await this.verwijderOpKenmerk(w.datum, w.datum, w.kenmerk);
    const event      = {
      category: `RACE_${w.prioriteit}`, type: SPORT_TYPE[w.sport], name: w.naam, start_date_local: begin(w.datum),
      distance: pyRound(w.afstand_km * 1000), external_id: w.kenmerk,
    };
    if (w.hoogtemeters) event.description = `Hoogtemeters: ${w.hoogtemeters}`;
    if (w.duur_min) event.moving_time = w.duur_min * 60;
    return naarWedstrijd(await this.maakEvent(event)) ;
  }

  /** Zet een notitie op een dag, in de plaats van de notitie met hetzelfde kenmerk. */
  async zetNotitie(n                                                                ) {
    await this.verwijderOpKenmerk(n.datum, n.datum, n.kenmerk);
    const event = await this.maakEvent({ category: "NOTE", start_date_local: begin(n.datum), name: n.naam,
                                         description: n.tekst, external_id: n.kenmerk });
    return { id: event.id ?? null };
  }
}
