// Afronden zoals Python, zodat de TypeScript-regels exact hetzelfde uitkomen als de Python-regels.
// Python rondt een gelijke afstand af naar het even getal (round(2.5) == 2), en werkt op de exacte
// binaire waarde (round(0.15, 1) == 0.1). Math.round en toFixed doen dat niet.

function afrondenOpDecimalen(x        , decimalen        )         {
  const teken = x < 0 ? "-" : "";
  // toFixed(100) geeft de exacte decimale waarde van een double in het bereik dat we gebruiken
  const [geheel, breuk] = Math.abs(x).toFixed(100).split(".");
  const cijfers = geheel + breuk.slice(0, decimalen);
  const rest = breuk.slice(decimalen);
  let omhoog         ;
  if (rest[0] > "5") omhoog = true;
  else if (rest[0] < "5") omhoog = false;
  else if (/[1-9]/.test(rest.slice(1))) omhoog = true;
  else omhoog = Number(cijfers[cijfers.length - 1]) % 2 === 1; // gelijke afstand: naar even
  let getal = BigInt(cijfers) + (omhoog ? 1n : 0n);
  const tekst = getal.toString().padStart(decimalen + 1, "0");
  const resultaat = Number(`${teken}${tekst.slice(0, tekst.length - decimalen)}.${tekst.slice(tekst.length - decimalen) || "0"}`);
  // round(x) geeft in Python een geheel getal (nooit -0); round(x, 1) een kommagetal (wel -0.0)
  return resultaat === 0 && decimalen === 0 ? 0 : resultaat;
}

/** Python `round(x)` of `round(x, decimalen)`. */
export function pyRound(x        , decimalen = 0)         {
  if (!Number.isFinite(x)) return x;
  if (Number.isInteger(x)) return x;
  return afrondenOpDecimalen(x, decimalen);
}

/** Python `f"{x:.0f}"`. */
export function pyFixed0(x        )         {
  const afgerond = pyRound(x);
  return afgerond === 0 && x < 0 ? "-0" : String(afgerond);
}
