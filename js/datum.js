// Datums als tekst "YYYY-MM-DD", zoals in intervals.icu. Rekenen gebeurt in UTC, dus zonder zomeruur.

                           

const DAG_MS = 86_400_000;

function ms(dag       )         {
  const [j, m, d] = dag.split("-").map(Number);
  return Date.UTC(j, m - 1, d);
}

function uitMs(waarde        )        {
  return new Date(waarde).toISOString().slice(0, 10);
}

export function plusDagen(dag       , dagen        )        {
  return uitMs(ms(dag) + dagen * DAG_MS);
}

/** Het aantal dagen van `van` tot `tot` (Python: (tot - van).days). */
export function dagenTussen(van       , tot       )         {
  return Math.round((ms(tot) - ms(van)) / DAG_MS);
}

/** Maandag is 0, zondag is 6 (Python: date.weekday()). */
export function weekdag(dag       )         {
  return (new Date(ms(dag)).getUTCDay() + 6) % 7;
}

export function maandag(dag       )        {
  return plusDagen(dag, -weekdag(dag));
}

function twee(n        )         {
  return String(n).padStart(2, "0");
}

/** De dag van een tijdstip, in de tijdzone van het toestel. */
export function lokaleDatum(tijd      )        {
  return `${tijd.getFullYear()}-${twee(tijd.getMonth() + 1)}-${twee(tijd.getDate())}`;
}

/** Een tijdstip in de tijdzone van het toestel: `2026-11-08T21:05:09`, of tot op de minuut. */
export function lokaalTijdstip(tijd      , metSeconden = true)         {
  const uur = `${twee(tijd.getHours())}:${twee(tijd.getMinutes())}`;
  return `${lokaleDatum(tijd)}T${uur}${metSeconden ? `:${twee(tijd.getSeconds())}` : ""}`;
}

export function geldigeDatum(tekst        )          {
  return /^\d{4}-\d{2}-\d{2}$/.test(tekst) && uitMs(ms(tekst)) === tekst;
}
