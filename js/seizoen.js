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

// --- Looppauze --------------------------------------------------------------------

/** De looppauze die op `dag` loopt, of null. Zonder bevestiging van de kine loopt ze door na de verwachte datum. */
export function looppauzeOp(checkpoints             , dag       )                   {
  return (checkpoints.looppauzes ?? []).find((p) => p.van <= dag && (!p.einde || dag < p.einde)) ?? null;
}

/** De looppauze die nog niet bevestigd beëindigd is, of null. */
export function lopendeLooppauze(checkpoints             )                   {
  return (checkpoints.looppauzes ?? []).find((p) => !p.einde) ?? null;
}

/** De dagen van de week van `week` (maandag) waarop een looppauze loopt. */
export function looppauzeDagen(checkpoints             , week       )          {
  return Array.from({ length: 7 }, (_, i) => plusDagen(week, i)).filter((dag) => looppauzeOp(checkpoints, dag));
}

/** De weken die volledig in een looppauze vallen: daarin wordt niet gelopen, en ze zijn neutraal voor de opbouw. */
export function pauzeweken(checkpoints             , weken         )             {
  return new Set(weken.filter((week) => looppauzeDagen(checkpoints, week).length === 7));
}

export function looppauzeWaarschuwingen(checkpoints             , vandaag       )                 {
  const pauze = looppauzeOp(checkpoints, vandaag);
  if (!pauze) return [];
  const reden = pauze.reden ? ` (${pauze.reden})` : "";
  if (vandaag > pauze.verwacht_tot) {
    return [{
      code: "looppauze_bevestiging",
      titel: "Looppauze: vraag de kine of je weer mag lopen",
      wat: `De kine verwachtte de looppauze${reden} tot ${pauze.verwacht_tot}, maar gaf nog geen bevestiging. ` +
        "Tot dan blijft lopen afgeraden.",
      advies: "Vraag de kine of je weer mag lopen. Laat het daarna aan de coach weten, dan beëindigt hij de pauze " +
        "en begin je opnieuw op je laatste loopvolume.",
    }];
  }
  return [{
    code: "looppauze",
    titel: `Looppauze van de kine, verwacht tot ${pauze.verwacht_tot}`,
    wat: `De kine raadt lopen af sinds ${pauze.van}${reden}. Fietsen en de oefeningen van de kine mogen.`,
    advies: "Niet lopen. Rustig rollen neemt de plaats van de loopjes in, de MTB-rit en de krachttrainingen blijven.",
  }];
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
