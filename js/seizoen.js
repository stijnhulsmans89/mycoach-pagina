// Wedstrijden, de fases van het seizoensplan en het kine-checkpoint: de leeskant.
// De schrijfkant (wedstrijd zetten, seizoensplan maken) staat in seizoensplan.ts.

                                                                        
import { dagenTussen, plusDagen,            } from "./datum.js";
import { pyRound } from "./py.js";
import { datumVan, TYPES_PER_SOORT,                   } from "./regels.js";

export const RACE                         = { RACE_A: "A", RACE_B: "B", RACE_C: "C" };
const FIETSTYPES = TYPES_PER_SOORT.mtb;
// hoogtemeters hebben geen eigen veld in een event: ze staan als regel in de beschrijving
const HOOGTEMETERS = /^Hoogtemeters: (\d+)$/m;
export const VOORUIT_DAGEN = 400;
export const HERSTEL_NA_A_DAGEN = 28;

                            
               
                      
                         
                     
                            
                              
                          
                                   
 

/** Race-events in domeintaal, oplopend op datum. */
export function wedstrijden(events       )              {
  const resultaat              = [];
  for (const event of events) {
    if (!(event.category in RACE)) continue;
    const afstand = event.distance, duur = event.moving_time;
    const hoogte = HOOGTEMETERS.exec(event.description || "");
    resultaat.push({
      datum: datumVan(event),
      naam: event.name ?? null,
      sport: FIETSTYPES.has(event.type) ? "mtb" : "lopen",
      prioriteit: RACE[event.category],
      afstand_km: afstand ? pyRound(afstand / 1000, 1) : null,
      hoogtemeters: hoogte ? Number(hoogte[1]) : null,
      duur_min: duur ? pyRound(duur / 60) : null,
      event_id: event.id ?? null,
    });
  }
  return resultaat.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

export async function haalWedstrijden(adapter         , vandaag       )                       {
  return wedstrijden(await adapter.events(plusDagen(vandaag, -HERSTEL_NA_A_DAGEN), plusDagen(vandaag, VOORUIT_DAGEN)));
}

export function faseOp(seizoensplan            , dag       )             {
  if (!seizoensplan) return null;
  for (const fase of seizoensplan.fases) {
    if (fase.van <= dag && dag <= fase.tot) return fase;
  }
  return null;
}

export function kineAkkoordLoopintensiteit(checkpoints             )               {
  return checkpoints.loopintensiteit || null;
}

export function checkpointWaarschuwingen(alleWedstrijden             , vandaag       , drempels          ,
                                         checkpoints             )                 {
  const afgevinkt = checkpoints.afgevinkt;
  const waarschuwingen                 = [];
  for (const w of alleWedstrijden) {
    const dagen = dagenTussen(vandaag, w.datum);
    if (w.prioriteit === "A" && dagen >= 0 && dagen <= drempels.kine_checkpoint_weken * 7 && !(w.datum in afgevinkt)) {
      waarschuwingen.push({
        code: "kine_checkpoint",
        titel: `Kine-checkpoint voor ${w.naam}`,
        wat: `Je A-wedstrijd ${w.naam} op ${w.datum} is over ${Math.floor(dagen / 7)} weken en ${dagen % 7} dagen. ` +
          "Het kine-checkpoint is nog niet afgevinkt.",
        advies: "Maak een afspraak met je kine en bespreek of de wedstrijd haalbaar is voor je knie. " +
          "Laat het daarna aan de coach weten, dan vinkt hij het checkpoint af.",
      });
    }
  }
  return waarschuwingen;
}
