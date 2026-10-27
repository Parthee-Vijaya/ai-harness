// Hvad modellen understøtter, ifølge udbyderens eget katalog. Aura viser kun udbyderens oplysninger og aldrig sine
// egne iagttagelser som prøver: at en opgave tilfældigvis lykkedes, beviser ikke en evne, og "ikke oplyst" betyder
// ikke, at noget virker. Efter forslag i #37, uden forslagets målinger (beslutning 25. oktober 2026).
const known = value => typeof value === 'boolean' ? value : null;
const declared = item => ({ tools: known(item?.capabilities?.tools), images: known(item?.capabilities?.vision) });
/**
 * model og route kommer fra udbyderens katalog. checkedAt er det tidspunkt, kataloget blev hentet, så brugeren kan
 * se, hvor gamle oplysningerne er. Uden en model er der intet at oplyse.
 */
function catalogSupport(model, route = null, checkedAt = null) {
  if (!model) return null;
  return {
    checkedAt: typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)) ? checkedAt : null,
    model: declared(model),
    route: route ? declared(route) : null
  };
}
module.exports = { catalogSupport };
