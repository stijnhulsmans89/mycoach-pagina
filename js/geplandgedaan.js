// Gepland tegenover gedaan, te hard en te lang, en 80/20: rekent alleen, zonder ophalen.
// Koppelen gebeurt tegen het laatste akkoord (met bijsturingen): eerst de geplande training waaraan intervals.icu
// de activiteit koppelde, anders dezelfde soort in dezelfde week, op dezelfde dag of anders de dichtstbijzijnde.

                                        
import { dagenTussen, maandag, plusDagen,            } from "./datum.js";
import {                  KENMERK } from "./intervals.js";
import { pyRound } from "./py.js";

/** Meer dan zoveel minuten boven het geplande (zone 2 bij rustig lopen, het wattbereik op de rollen) is te hard. */
export const TE_HARD_MIN = 5;
/** Een MTB-rit is te hard als de belasting zoveel procent boven de geplande ligt: heuvels alleen tellen niet. */
export const MTB_BELASTING_MARGE_PCT = 20;
/** De vermogenszones van intervals.icu als de activiteit ze niet meegeeft (bovengrens in % van de FTP). */
export const STANDAARD_VERMOGENSZONES = [55, 75, 90, 105, 120, 150, 999];

                                                                                                

/** Een geplande training uit een weekplan met akkoord, met haar plaats in dat weekplan. */
                          
                                                                                                 
                                                                                                 
 

                                                                  

                          
                      
                                                     
               
                                                            
                
                 
 

/** De trainingen van een weekplan met akkoord, met hun plaats; een voorstel telt nooit. */
export function geplandUit(plan            )            {
  if (!plan?.akkoord) return [];
  return (plan.akkoord.trainingen         ).map((t, index) => ({
    week: plan.week, index, datum: t.datum, soort: t.soort, naam: t.naam ?? null, duur_min: t.duur_min,
    belasting: t.belasting ?? null, hartslag_max: t.hartslag_max ?? null, stappen: t.stappen ?? [], zone: t.zone ?? null,
  }));
}

/** Rustig lopen: geen stap boven zone 2 en geen geplande zone boven 2. */
function rustigLoopje(t         , z       )          {
  if ((t.zone ?? 0) > 2) return false;
  if ((t.hartslag_max ?? 0) > z.loop_z2_max) return false;
  return !(t.stappen ?? []).some((s) => (s.hartslag?.[1] ?? 0) > z.loop_z2_max);
}

const som = (getallen          ) => getallen.reduce((a, b) => a + b, 0);

/** De hartslagzone van een hartslag, met de zonegrenzen van intervals.icu; null zonder grenzen. */
export function hartslagzone(hartslag               , grenzen                 )                {
  if (hartslag === null || !grenzen?.length) return null;
  const i = grenzen.findIndex((g) => hartslag <= g);
  return (i < 0 ? grenzen.length - 1 : i) + 1;
}

/**
 * De eerste hartslagzone (index) die helemaal boven `grens` ligt, met de zonegrenzen van intervals.icu;
 * zonder grenzen zone 3, want zone 2 loopt tot `loop_z2_max`.
 */
function bovenZone(grens        , grenzen                 )         {
  if (!grenzen?.length) return 2;
  const i = grenzen.findIndex((g) => g >= grens);
  return i < 0 ? grenzen.length : i + 1;
}

/** Te hard (per soort) en te lang (alleen een loopje) voor een geplande training en haar activiteit. */
export function oordeel(t         , a            , z       )          {
  const minuten = pyRound(a.seconden / 60);
  if (t.soort === "loopje") {
    const marge = 1 + z.loopvolume_marge_pct / 100;
    if (minuten > t.duur_min * marge) {
      const pct = pyRound((minuten / t.duur_min - 1) * 100);
      return { soort: "te lang", chip: `+${minuten - t.duur_min} min`, regel: `${minuten} min gelopen, ${t.duur_min} gepland (${pct}% langer)`,
        uitleg: `Je liep ${minuten} minuten in plaats van ${t.duur_min}: ${pct}% langer dan gepland. Te snel meer lopen is het ` +
          "grootste risico voor je pees: hou je aan de geplande minuten, ook als het goed voelt." };
    }
    const boven = pyRound(som(a.zone_seconden.slice(bovenZone(z.loop_z2_max, a.hartslag_zones))) / 60);
    if (rustigLoopje(t, z) && boven > TE_HARD_MIN) {
      const gem = a.gem_hartslag !== null ? pyRound(a.gem_hartslag) : null;
      const zone = hartslagzone(gem, a.hartslag_zones);
      return { soort: "te hard", chip: [zone ? `Z${zone}` : null, gem !== null ? `${gem} bpm` : `${boven} min`].filter(Boolean).join(" · "),
        regel: `${boven} min boven zone 2` + (gem !== null ? `, gemiddeld ${gem}` : ""),
        uitleg: `Rustig lopen is onder ${z.loop_z2_max} bpm. Je zat ${boven} minuten boven zone 2` +
          (gem !== null ? ` (gemiddeld ${gem} bpm)` : "") + ". Wandel als je erboven gaat: wandelpauzes op een helling zijn " +
          "goed, en zo blijft het loopje rustig voor je pees." };
    }
  } else if (t.soort === "mtb") {
    if (t.belasting && a.belasting !== null && a.belasting > t.belasting * (1 + MTB_BELASTING_MARGE_PCT / 100)) {
      return { soort: "te hard", chip: `belasting ${pyRound(a.belasting)}`, regel: `belasting ${pyRound(a.belasting)}, gepland ${t.belasting}`,
        uitleg: `De belasting van deze rit (${pyRound(a.belasting)}) ligt duidelijk boven de geplande ${t.belasting}. ` +
          "Heuvels duwen elke rit even in zone 3 of 4, dat telt niet; het gaat om de rit als geheel." };
    }
  } else if (t.soort === "rollen" && z.ftp) {
    const watt = (t.stappen ?? []).map((s) => s.wattage?.[1]).filter((w)              => typeof w === "number");
    if (watt.length && a.vermogen_zone_seconden.length) {
      const pct = Math.max(...watt) / z.ftp * 100;
      const grenzen = a.vermogen_zones ?? STANDAARD_VERMOGENSZONES;
      const zone = Math.max(0, grenzen.findIndex((g) => pct <= g));
      const boven = pyRound(som(a.vermogen_zone_seconden.slice(zone + 1)) / 60);
      if (boven > TE_HARD_MIN) {
        return { soort: "te hard", chip: `${boven} min boven Z${zone + 1}`, regel: `${boven} min boven het geplande wattage`,
          uitleg: `Je reed ${boven} minuten boven het geplande bereik (tot ${Math.max(...watt)} W, zone ${zone + 1}). ` +
            "Op de rollen stuurt het wattage, niet de hartslag." };
      }
    }
  }
  return { soort: "volgens plan", chip: "volgens plan", regel: "volgens plan",
           uitleg: t.soort === "kracht" ? "Gedaan zoals gepland. Bij kracht is er geen oordeel over de intensiteit."
             : "Gedaan zoals gepland: niet te hard en niet te lang." };
}

// --- Koppelen ---------------------------------------------------------------------------

const KENMERK_TRAINING = new RegExp(`^${KENMERK}(\\d{4}-\\d{2}-\\d{2})-([a-z]+)-(\\d+)$`);

                                                                                  
                                                                  

                                   
                                                                                                 
                                                                                       
                                              
                         
                                     
                          
                          
 

                                     
                                           
                       
                                                                                     
                          
 

/**
 * Koppelt de activiteiten aan de geplande trainingen. `events` geeft per id van een geplande training in de kalender
 * haar kenmerk (`mycoach-<datum>-<soort>-<index>`). Een training zonder activiteit na haar dag is overgeslagen.
 */
export function koppel(gepland           , activiteiten              , events                     , vandaag       ,
                       z       )                                                                         {
  const paar = new Map                     ();
  const vrij = (t         ) => !paar.has(t);
  const gekoppeld = new Set            ();

  // 1. de koppeling van intervals.icu: activiteit → geplande training in de kalender → kenmerk → training
  for (const a of activiteiten) {
    if (a.gepland_event === null) continue;
    const m = KENMERK_TRAINING.exec(events.get(String(a.gepland_event)) ?? "");
    if (!m) continue;
    const [, datum, soort, index] = m;
    const t = gepland.find((g) => vrij(g) && g.week === maandag(datum) && g.index === Number(index) && g.soort === soort)
      ?? gepland.find((g) => vrij(g) && g.datum === datum && g.soort === soort);
    if (t) { paar.set(t, a); gekoppeld.add(a); }
  }
  // 2. dezelfde soort op dezelfde dag; 3. dezelfde soort in dezelfde week, de dichtstbijzijnde dag (bij gelijkstand de vroegste)
  for (const zelfdeDag of [true, false]) {
    for (const a of activiteiten) {
      if (gekoppeld.has(a) || !a.soort) continue;
      const kandidaten = gepland.filter((g) => vrij(g) && g.soort === a.soort && g.week === maandag(a.datum)
        && (!zelfdeDag || g.datum === a.datum));
      kandidaten.sort((x, y) => Math.abs(dagenTussen(a.datum, x.datum)) - Math.abs(dagenTussen(a.datum, y.datum))
        || (x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0));
      if (kandidaten.length) { paar.set(kandidaten[0], a); gekoppeld.add(a); }
    }
  }

  const trainingen = gepland.map((t)                   => {
    const a = paar.get(t);
    const status                 = a ? (a.datum === t.datum ? "gedaan" : "verschoven") : t.datum < vandaag ? "overgeslagen" : "te doen";
    return { week: t.week, index: t.index, datum: t.datum, soort: t.soort, naam: t.naam, duur_min: t.duur_min,
             stappen: t.stappen ?? [], hartslag_max: t.hartslag_max ?? null, status,
             activiteit: a?.id ?? null, gedaan_op: a?.datum ?? null, oordeel: a ? oordeel(t, a, z) : null };
  });
  const perActiviteit = new Map([...paar].map(([t, a]) => [a, t]));
  return {
    trainingen,
    activiteiten: activiteiten.map((a)                     => {
      const t = perActiviteit.get(a);
      return {
        id: a.id, datum: a.datum,
        koppeling: !t ? "niet gepland" : t.datum === a.datum ? "gepland" : "verschoven",
        training: t ? { week: t.week, index: t.index, datum: t.datum, naam: t.naam } : null,
        oordeel: t ? oordeel(t, a, z) : null,
      };
    }),
  };
}

// --- 80/20 ------------------------------------------------------------------------------

const DUURSOORTEN = new Set(["loopje", "mtb", "rollen"]);

                                                                                                                                     

/**
 * Per week de tijd in hartslagzones voor lopen, MTB en rollen (kracht telt niet): zone 1 en 2 is rustig,
 * zone 3 en hoger is hard. Informatie, geen regel: de regel blijft het aantal harde trainingen per week.
 */
export function tachtigTwintig(activiteiten              , eersteMaandag       , laatsteMaandag       )                       {
  const weken                       = [];
  for (let week = eersteMaandag; week <= laatsteMaandag; week = plusDagen(week, 7)) {
    const deze = activiteiten.filter((a) => maandag(a.datum) === week && DUURSOORTEN.has(a.soort ?? ""));
    const rustig = som(deze.map((a) => som(a.zone_seconden.slice(0, 2)))) / 60;
    const hard = som(deze.map((a) => som(a.zone_seconden.slice(2)))) / 60;
    const pct = rustig + hard > 0 ? pyRound(hard / (rustig + hard) * 100) : null;
    weken.push({ week, rustig_min: pyRound(rustig), hard_min: pyRound(hard), hard_pct: pct, boven_20: pct !== null && pct > 20 });
  }
  return weken;
}
