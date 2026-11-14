// Het dagoordeel en de check-ins van de pagina: rekent alleen, zonder ophalen.
// Het dagoordeel neemt het zwaarste bekende signaal: overbelast > let op > nog niet compleet > in orde.
// Het is advies in woorden: het past de kalender nooit aan en maakt nooit iets zwaarder.
// Ook de pagina zelf rekent het opnieuw, met een score die nog op verbinding wacht (paginadata.ts).

                                        
                                                          

                                                                              
                                    

/** Per waarschuwingscode: rood (overbelast), geel (let op) of geen invloed op het dagoordeel. */
export const ERNST                               = {
  kniepijn: "rood", ochtendpijn: "rood", kine: "rood", vorm: "rood",
  hrv: "geel", rusthartslag: "geel", loopvolume: "geel",
  kine_checkpoint: null,
  // een looppauze is een voorzorg van de kine, geen overbelasting: de pagina toont ze apart
  looppauze: null, looppauze_bevestiging: null,
};

/** De ernst van een waarschuwing. Een onbekende code is "let op": bij twijfel lichter. */
export function ernst(code        )               {
  return code in ERNST ? ERNST[code] : "geel";
}

// de volgorde waarin het zwaarste signaal gekozen wordt: eerst de knie, dan de rest
const VOLGORDE = ["kniepijn", "ochtendpijn", "kine", "vorm", "hrv", "rusthartslag", "loopvolume"];
const PIJN = new Set(["kniepijn", "ochtendpijn", "kine"]);

/** Een geplande training, zoals het dagoordeel ze nodig heeft. */
                                                                                                                    

                                   
                 
                                 
                            
                                                                                     
                               
                                                       
                               
                                                               
                           
                                                      
                                
                                       
                                            
                                                      
                    
 

                                                                          

                             
               
                                                                              
              
                                                              
                        
                                         
                      
                                                                         
                                                
                                                                                  
                     
                                 
                               
                                                 
                               
                                                                    
                      
 

const NOOT_ZWARE_OPBOUW = "Je traint meer dan je gewend bent. Dat maakt je sterker, als er nu rustige dagen volgen.";

function dagwoord(dag       , vandaag       )         {
  const [j, m, d] = dag.split("-").map(Number), [vj, vm, vd] = vandaag.split("-").map(Number);
  const verschil = Math.round((Date.UTC(j, m - 1, d) - Date.UTC(vj, vm - 1, vd)) / 86_400_000);
  if (verschil === 0) return "vandaag";
  if (verschil === 1) return "morgen";
  return ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"][new Date(Date.UTC(j, m - 1, d)).getUTCDay()];
}

/** De lichtere versie van een training bij een signaal, als tekst. Maakt nooit iets zwaarder. */
export function lichtereVersie(t              , stand                         , code        )         {
  const korter = Math.max(10, Math.round(t.duur_min * 0.75 / 5) * 5);
  const fietsen = t.soort === "mtb" || t.soort === "rollen";
  if (stand === "overbelast" && PIJN.has(code)) {
    if (t.soort === "loopje") return "Niet lopen. Kies rust, de kine-oefeningen of rustig fietsen als dat pijnvrij gaat.";
    if (fietsen) return `Hoogstens rustig en pijnvrij fietsen, korter: ongeveer ${korter} min.`;
    if (t.soort === "kracht") return "Alleen de kine-oefeningen die pijnvrij gaan.";
    return "Rust.";
  }
  if (stand === "overbelast") {
    if (t.soort === "loopje") return `Rust, of hoogstens ${korter} min rustig, met wandelpauzes.`;
    if (fietsen) return `Rust, of hoogstens ${korter} min rustig, zonder harde stukken.`;
    if (t.soort === "kracht") return "Alleen de kine-oefeningen, met een ronde minder.";
    return "Rust.";
  }
  if (t.soort === "loopje") return `Rustig houden en eerder korter: ongeveer ${korter} min, wandel als je boven zone 2 gaat.`;
  if (fietsen) return t.hard ? `Rustig in plaats van hard, en korter: ongeveer ${korter} min.` : `Rustig en eerder korter: ongeveer ${korter} min.`;
  if (t.soort === "kracht") return "Een ronde minder, en stop bij pijn boven 3.";
  return "Rustig aan.";
}

function zinInOrde(invoer                  )         {
  const volgende = invoer.volgende;
  const daarna = volgende ? ` Volgende training: ${volgende.naam ?? volgende.soort}, ${dagwoord(volgende.datum, invoer.vandaag)}.` : "";
  if (invoer.wedstrijd) return `Vandaag is je wedstrijd: ${invoer.wedstrijd.naam ?? "succes"}. Geen signalen van overbelasting.`;
  if (!invoer.weekplan) return "Geen signalen van overbelasting.";
  if (invoer.open_vandaag.length) {
    return `Geen signalen van overbelasting: doe vandaag wat gepland is (${invoer.open_vandaag.map((t) => t.naam ?? t.soort).join(" en ")}).`;
  }
  if (invoer.gepland_vandaag) return "Alles van vandaag is gedaan." + daarna;
  return "Rustdag: wandelen of je kine-oefeningen mag." + daarna;
}

/** Het dagoordeel: het zwaarste bekende signaal, met het advies, de lichtere versie en de volgende stap. */
export function dagoordeel(invoer                  )             {
  const signalen = invoer.waarschuwingen
    .map((w) => ({ ...w, ernst: ernst(w.code) }))
    .filter((w)                                       => w.ernst !== null)
    .sort((a, b) => (a.ernst === b.ernst ? 0 : a.ernst === "rood" ? -1 : 1)
      || volgorde(a.code) - volgorde(b.code));
  const zwaarste = signalen[0] ?? null;
  const noot = invoer.vormzone === "zware opbouw" ? NOOT_ZWARE_OPBOUW : null;
  const ochtendtest = !invoer.ochtendpijn_vandaag;
  const basis = { signalen, ochtendtest_te_doen: ochtendtest, noot };

  if (zwaarste) {
    const stand = zwaarste.ernst === "rood" ? "overbelast"          : "let op"         ;
    // de lichtere versie gaat over wat nog te doen is: vandaag, of als alles gedaan is de volgende training
    const doelen = invoer.open_vandaag.length ? invoer.open_vandaag : invoer.volgende ? [invoer.volgende] : [];
    return {
      ...basis, stand, zin: zwaarste.titel, advies: zwaarste.advies, code: zwaarste.code,
      lichter: doelen.map((t) => ({ training: t.naam ?? t.soort, datum: t.datum, tekst: lichtereVersie(t, stand, zwaarste.code) })),
      volgende_stap: stand !== "overbelast" ? null
        : zwaarste.code === "kine" ? "Contacteer je kine." : "Vraag Claude een bijsturing van je weekplan (/weekplan).",
    };
  }
  if (ochtendtest) {
    return { ...basis, stand: "nog niet compleet", zin: "Doe eerst je ochtendtest: hoeveel pijn deed je knie?", advies: null,
             code: null, lichter: [], volgende_stap: null };
  }
  return { ...basis, stand: "in orde", zin: zinInOrde(invoer), advies: null, code: null, lichter: [], volgende_stap: null };
}

function volgorde(code        )         {
  const i = VOLGORDE.indexOf(code);
  return i < 0 ? VOLGORDE.length : i;
}

// --- Check-ins --------------------------------------------------------------------------

/** Een training zoals de check-ins ze nodig hebben. */
                                      
                                                                                                       
                          
 

/** Een score die op dit toestel wacht op verbinding. */
                      
                                                                  
                                                       

                           
                                                                                 
                                                                                                                 
                                                                                   
 

/**
 * De open check-ins: de ochtendpijn van vandaag, en de kniepijn na elke training van vandaag en gisteren,
 * van alle soorten. Een score die nog wacht op verbinding sluit de check-in al, maar blijft zichtbaar als wachtend.
 */
export function checkins(vandaag       , gisteren       , trainingen                       ,
                         ochtendpijnVandaag               , wachtend             = [])           {
  const wachtOchtend = wachtend.find((w) => w.soort === "ochtend" && w.datum === vandaag);
  const knie                   = [];
  for (const t of trainingen) {
    if (!t.soort || (t.datum !== vandaag && t.datum !== gisteren)) continue;
    const wacht = wachtend.find((w) => w.soort === "knie" && String(w.activiteit) === String(t.id));
    if (t.kniepijn !== null && !wacht) continue;
    knie.push({ activiteit: t.id, datum: t.datum, wanneer: t.datum === vandaag ? "vandaag" : "gisteren", naam: t.naam,
                soort: t.soort, minuten: t.minuten, wacht: Boolean(wacht), score: wacht ? wacht.waarde : null });
  }
  return {
    ochtend: { datum: vandaag, open: ochtendpijnVandaag === null && !wachtOchtend,
               score: wachtOchtend ? wachtOchtend.waarde : ochtendpijnVandaag, wacht: Boolean(wachtOchtend) },
    knie,
  };
}
