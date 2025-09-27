const fallbackLogo = 'nba-logo-vector-01.png';

const teamLogoLookup = new Map([
  ['atlanta hawks', 'atlanta-hawks-logo-vector.png'],
  ['boston celtics', 'boston-celtics-logo-vector.png'],
  ['brooklyn nets', 'brooklyn-nets-logo-vector.png'],
  ['charlotte hornets', 'charlotte-bobcats-logo-vector.png'],
  ['charlotte bobcats', 'charlotte-bobcats-logo-vector.png'],
  ['chicago bulls', 'chicago-bulls-logo-vector.png'],
  ['cleveland cavaliers', 'cleveland-cavaliers-logo-vector.png'],
  ['dallas mavericks', 'dallas-mavericks-logo-vector.png'],
  ['denver nuggets', 'denver-nuggets-logo-vector.png'],
  ['detroit pistons', 'detroit-pistons-logo-vector.png'],
  ['golden state warriors', 'golden-state-warriors-logo-vector.png'],
  ['houston rockets', 'houston-rockets-logo-vector.png'],
  ['indiana pacers', 'indiana-pacers-logo-vector.png'],
  ['los angeles clippers', 'los-angeles-clippers-logo-vector.png'],
  ['la clippers', 'los-angeles-clippers-logo-vector.png'],
  ['los angeles lakers', 'los-angeles-lakers-logo-vector.png'],
  ['la lakers', 'los-angeles-lakers-logo-vector.png'],
  ['memphis grizzlies', 'memphis-grizzlies-logo-vector.png'],
  ['miami heat', 'miami-heat-logo-vector.png'],
  ['milwaukee bucks', 'milwaukee-bucks-logo-vector.png'],
  ['minnesota timberwolves', 'minnesota-timberwolves-logo-vector.png'],
  ['new orleans pelicans', 'new-orleans-hornets-logo-vector.png'],
  ['new orleans hornets', 'new-orleans-hornets-logo-vector.png'],
  ['new york knicks', 'new-york-knicks-logo-vector.png'],
  ['oklahoma city thunder', 'oklahoma-city-thunder-logo-vector.png'],
  ['orlando magic', 'orlando-magic-logo-vector.png'],
  ['philadelphia 76ers', 'philadelphia-76ers-logo-vector.png'],
  ['phoenix suns', 'phoenix-suns-logo-vector.png'],
  ['portland trail blazers', 'portland-trail-blazers-logo-vector.png'],
  ['portland trailblazers', 'portland-trail-blazers-logo-vector.png'],
  ['sacramento kings', 'sacramento-kings-logo-vector.png'],
  ['san antonio spurs', 'san-antonio-spurs-logo-vector.png'],
  ['toronto raptors', 'toronto-raptors-logo-vector.png'],
  ['utah jazz', 'utah-jazz-logo-vector.png'],
  ['washington wizards', 'washington-wizards-logo-vector.png'],
]);

const abbreviationLookup = new Map([
  ['ATL', 'atlanta-hawks-logo-vector.png'],
  ['BOS', 'boston-celtics-logo-vector.png'],
  ['BKN', 'brooklyn-nets-logo-vector.png'],
  ['BRK', 'brooklyn-nets-logo-vector.png'],
  ['CHA', 'charlotte-bobcats-logo-vector.png'],
  ['CHO', 'charlotte-bobcats-logo-vector.png'],
  ['CHI', 'chicago-bulls-logo-vector.png'],
  ['CLE', 'cleveland-cavaliers-logo-vector.png'],
  ['DAL', 'dallas-mavericks-logo-vector.png'],
  ['DEN', 'denver-nuggets-logo-vector.png'],
  ['DET', 'detroit-pistons-logo-vector.png'],
  ['GSW', 'golden-state-warriors-logo-vector.png'],
  ['HOU', 'houston-rockets-logo-vector.png'],
  ['IND', 'indiana-pacers-logo-vector.png'],
  ['LAC', 'los-angeles-clippers-logo-vector.png'],
  ['LAL', 'los-angeles-lakers-logo-vector.png'],
  ['MEM', 'memphis-grizzlies-logo-vector.png'],
  ['MIA', 'miami-heat-logo-vector.png'],
  ['MIL', 'milwaukee-bucks-logo-vector.png'],
  ['MIN', 'minnesota-timberwolves-logo-vector.png'],
  ['NOP', 'new-orleans-hornets-logo-vector.png'],
  ['NOH', 'new-orleans-hornets-logo-vector.png'],
  ['NYK', 'new-york-knicks-logo-vector.png'],
  ['OKC', 'oklahoma-city-thunder-logo-vector.png'],
  ['ORL', 'orlando-magic-logo-vector.png'],
  ['PHI', 'philadelphia-76ers-logo-vector.png'],
  ['PHL', 'philadelphia-76ers-logo-vector.png'],
  ['PHX', 'phoenix-suns-logo-vector.png'],
  ['POR', 'portland-trail-blazers-logo-vector.png'],
  ['SAC', 'sacramento-kings-logo-vector.png'],
  ['SAS', 'san-antonio-spurs-logo-vector.png'],
  ['SA', 'san-antonio-spurs-logo-vector.png'],
  ['TOR', 'toronto-raptors-logo-vector.png'],
  ['UTA', 'utah-jazz-logo-vector.png'],
  ['WAS', 'washington-wizards-logo-vector.png'],
  ['WSH', 'washington-wizards-logo-vector.png'],
]);

function normalizeName(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
}

export function getTeamLogo(identifier) {
  if (!identifier) {
    return fallbackLogo;
  }
  const normalized = normalizeName(identifier);
  if (normalized && teamLogoLookup.has(normalized)) {
    return teamLogoLookup.get(normalized);
  }
  const abbreviation = typeof identifier === 'string' ? identifier.toUpperCase().replace(/[^A-Z]/g, '') : '';
  if (abbreviation && abbreviationLookup.has(abbreviation)) {
    return abbreviationLookup.get(abbreviation);
  }
  return fallbackLogo;
}

export function createTeamLogo(identifier, className = 'team-logo') {
  const logo = document.createElement('img');
  logo.src = getTeamLogo(identifier);
  logo.alt = identifier ? `${identifier} logo` : 'NBA logo';
  logo.loading = 'lazy';
  logo.decoding = 'async';
  if (className) {
    logo.className = className;
  }
  return logo;
}
