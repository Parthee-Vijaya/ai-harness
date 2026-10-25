// Et link fra et AI-svar åbnes kun i standardbrowseren, når hovedprocessen selv har godkendt adressen.
// Reglerne er de samme som i ui/markdown.js, så det viste og det åbnede altid er samme adresse. Efter forslag i #27.
const { linkURL } = require('../ui/markdown.js');

function externalURL(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'url') || typeof value.url !== 'string') throw Error('Vælg et almindeligt http- eller https-link.');
  const url = linkURL(value.url);
  if (!url) throw Error('Kun almindelige http- og https-links uden loginoplysninger kan åbnes.');
  return url;
}
module.exports = { externalURL };
