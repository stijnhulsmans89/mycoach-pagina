// Wedstrijden, de fases van het seizoensplan en het kine-checkpoint: de leeskant, ook voor de pagina.
// De schrijfkant (wedstrijd zetten, seizoensplan maken) staat in seizoensplan.ts: haar teksten mogen niet
// op de publieke pagina (zie daar).

                                                               
import { dagenTussen, plusDagen,            } from "./datum.js";
                                                           
                                                

                          

export const VOORUIT_DAGEN = 400;
export const HERSTEL_NA_A_DAGEN = 28;

export async function haalWedstrijden(intervals           , vandaag       )                       {
  return intervals.wedstrijden(plusDagen(vandaag, -HERSTEL_NA_A_DAGEN), plusDagen(vandaag, VOORUIT_DAGEN));
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
