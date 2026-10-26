const test = require('node:test');
const assert = require('node:assert/strict');

const S = require('../store/futfox-site/admin/gallery-sets');

test('a new set has 20 empty slots and no grades', () => {
  const set = S.emptySet('TOTW 6');
  assert.equal(set.slots.length, 20);
  assert.ok(set.slots.every((s) => s === null));
  assert.deepEqual(Object.keys(set.grades), S.GRADES);
  assert.equal(set.status, 'draft');
});

test('saving tidies the form and resizes the slots to the slot count', () => {
  const { set, errors } = S.normalizeSet({
    name: '  TOTW 6 ', slotCount: '3', tokens: '2', status: 'live',
    slots: [{ kind: 'card', playerId: '246669', name: 'Saka', rating: '89', rarityId: '3', version: 'Team of the Week' }, { kind: 'card' }, { kind: 'rule', label: 'Any TOTW', rarityId: 0 }, { kind: 'card', playerId: 1 }],
    grades: { D: '10', C: '125000' },
    rewards: { D: ' 1 token ', C: 'Rare gold pack' },
    bonusTags: [{ name: 'One league', condition: '5 players from one league' }, { name: '', condition: '' }],
  });
  assert.deepEqual(errors, []);
  assert.equal(set.name, 'TOTW 6');
  assert.equal(set.slotCount, 3);
  assert.deepEqual(set.slots[0], { kind: 'card', playerId: 246669, name: 'Saka', rating: 89, rarityId: 3, version: 'Team of the Week' });
  assert.equal(set.slots[1], null);
  assert.equal(set.slots[2].label, 'Any TOTW');
  assert.equal(set.slots[2].rarityId, 0, 'version 0 (Common) is a real version, not "any"');
  assert.deepEqual(set.grades, { D: 10, C: 125000, B: null, A: null, S: null });
  assert.deepEqual(set.rewards, { D: '1 token', C: 'Rare gold pack', B: '', A: '', S: '' });
  assert.equal(set.bonusTags.length, 1);
});

test('saving lists what blocks it', () => {
  const { errors } = S.normalizeSet({ name: '', status: 'live', slotCount: 2, slots: [], grades: { D: 100, C: 50 } });
  assert.deepEqual(errors, ['Give the set a name.', 'Grade C needs a higher score than the grade before it.', 'A live set needs at least one slot.']);
});

test('the published bundle holds live sets only, sorted by name', () => {
  const sets = [
    { id: 'b', name: 'TOTW 7', status: 'live', slots: [], updatedAt: 5 },
    { id: 'a', name: 'Halloween', status: 'draft', slots: [], updatedAt: 9 },
    { id: 'c', name: 'Icons', status: 'live', slots: [], updatedAt: 1 },
  ];
  const bundle = S.publicBundle(sets, 100);
  assert.equal(bundle.schema, 1);
  assert.equal(bundle.publishedAt, 100);
  assert.deepEqual(bundle.sets.map((s) => s.id), ['c', 'b']);
  assert.equal('status' in bundle.sets[0], false);
  assert.deepEqual(bundle.sets[0].rewards, {}, 'sets saved before rewards existed still publish');
});

test('publishChanges lists only what FutFox users would see change', () => {
  const set = (id, status, extra) => ({ id, name: id.toUpperCase(), group: 'Rarities', status, tokens: 0, grades: {}, slots: [], bonusTags: [], updatedAt: 50, ...extra });
  const sets = [set('a', 'live'), set('b', 'live'), set('c', 'draft'), set('d', 'live')];
  // As Firestore hands it back: same content, fields in another order, no status or updatedAt.
  const published = S.publicBundle([set('a', 'live'), set('b', 'live', { tokens: 5 }), set('e', 'live')], 1).sets
    .map((p) => Object.fromEntries(Object.entries(p).reverse()));
  assert.deepEqual(S.publishChanges(sets, published), {
    added: ['D (Rarities)'],
    changed: ['B (Rarities)'],
    removed: ['E (Rarities)'],
  });
  assert.deepEqual(S.publishChanges([set('c', 'draft', { updatedAt: 999 })], []), { added: [], changed: [], removed: [] }, 'an edited draft changes nothing');
});

test("EA's player list becomes id, name and rating rows, best first", () => {
  const rows = S.parseEaPlayers({
    Players: [{ f: 'Bukayo', l: 'Saka', id: 246669, r: 87 }, { f: 'Rodrygo', l: 'Silva de Goes', c: 'Rodrygo', id: 243812, r: 85 }, { id: 3 }],
    LegendsPlayers: [{ c: 'Iniesta', f: 'Andrés', l: 'Iniesta Luján', id: 41, r: 92 }, { f: 'Bukayo', l: 'Saka', id: 246669, r: 87 }],
  });
  assert.deepEqual(rows, [[41, 'Iniesta', 92], [246669, 'Bukayo Saka', 87], [243812, 'Rodrygo', 85]]);
  assert.deepEqual(S.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("EA's version names come from its text file, by number", () => {
  const rows = S.parseEaVersions({
    'item.raretype3': 'Team of the Week',
    Player_Rarity_3: 'TOTW (other key)',
    Player_Rarity_33: 'Thunderstruck',
    FUT_POA_PLAYER_RARITY_0: 'Common',
    FUT_POA_PLAYER_RARITY_26: '  ',
    'search.title': 'Search',
  });
  assert.deepEqual(rows, [[0, 'Common'], [3, 'Team of the Week'], [33, 'Thunderstruck']]);
});

test('imported sets match names to EA ids and versions, and list what needs a look', () => {
  const players = [[231747, 'Kylian Mbappé', 91], [6, 'Erling Haaland', 91], [7, 'Pedri', 90], [246669, 'Bukayo Saka', 87], [8, 'Pedrinho', 74], [2, 'Saka Junior', 60], [3, 'Rodri', 89], [4, 'Rodrigo', 86], [5, 'Rodrigo Moreno', 84]];
  const versions = [[3, 'Team of the Week'], [1, 'Rare']];
  const [result] = S.importSets({
    sets: [{
      name: 'TOTW 6', group: 'Team of the Week', tokens: 3, grades: { D: 10, C: 125000 },
      slots: [
        { name: 'Saka', rating: 89, version: 'team of the week' },
        { name: 'B. Saka', rating: 89 },
        { name: 'Mbappe', rating: 90 },
        { name: 'Rodrigo', rating: 88 },
        { rule: 'Any TOTW', version: 'Team of the Week' },
        { name: 'Haaland', rating: 92, version: 'Shapeshifters' },
        null,
        { name: 'Pedri', rating: 88 },
      ],
    }],
  }, players, versions);
  const { set, problems } = result;
  assert.equal(set.status, 'draft');
  assert.equal(set.slotCount, 8);
  assert.deepEqual(set.slots[0], { kind: 'card', playerId: 246669, name: 'Bukayo Saka', rating: 89, rarityId: 3, version: 'Team of the Week' });
  assert.equal(set.slots[1].playerId, 246669);
  assert.equal(set.slots[2], null, 'Mbappé 91 base cannot be a 90 card');
  assert.equal(set.slots[3].playerId, 4, 'the exact name wins over "Rodrigo Moreno"');
  assert.deepEqual([set.slots[4].kind, set.slots[4].rarityId], ['rule', 3]);
  assert.deepEqual([set.slots[5].playerId, set.slots[5].rarityId], [6, null], 'an unknown version keeps the player, any version');
  assert.equal(set.slots[7].playerId, 8, 'Pedri is rated 90, so only Pedrinho fits an 88 card');
  assert.deepEqual(problems, [
    'Slot 3: no player called "Mbappe" with a base rating of 90 or lower',
    'Slot 6: version "Shapeshifters" isn\'t in EA\'s list',
    'Slot 8: "Pedri" only partly matches Pedrinho (74, id 8)',
  ]);
});

test('a set of one card type fills every slot with a rule for all its versions', () => {
  const versions = [[3, 'Team of the Week'], [42, 'POTM Bundesliga'], [43, 'POTM Premier League'], [72, 'Base Hero'], [171, 'UEFA Heroes (Mens)'], [8, 'Star Performer']];
  const results = S.importSets({
    sets: [
      { name: 'TOTW', category: 'Rarities', slotCount: 3, cardType: 'Team of the Week', bonusTags: ['Golden'], grades: { D: 10, S: 550000 }, rewards: { S: '75 Gallery Token' } },
      { name: 'POTM', slotCount: 2, cardType: 'POTM' },
      { name: 'Heroes', slotCount: 1, cardType: 'Heroes' },
      { name: 'Holographics', slotCount: 2, cardType: 'Holographics' },
      { name: 'Starter Set', slotCount: 2, cardType: null },
    ],
  }, [], versions);
  const [totw, potm, heroes, holo, starter] = results;
  assert.equal(totw.set.slots.length, 3);
  assert.equal(totw.set.group, 'Rarities', 'the category is saved as the set group');
  assert.deepEqual(totw.set.slots[2], { kind: 'rule', label: 'Any Team of the Week card', rarityId: null, rarityIds: [3], version: 'Team of the Week', clubIds: [], leagueIds: [], leagueId: null, nationId: null, minRating: null });
  assert.deepEqual(totw.set.bonusTags, [], "a file's bonus tags are one player's progress, so they aren't imported");
  assert.equal(totw.set.rewards.S, '75 Gallery Token');
  assert.deepEqual(potm.set.slots[0].rarityIds, [42, 43]);
  assert.deepEqual(heroes.set.slots[0].rarityIds, [72, 171]);
  assert.deepEqual(holo.set.slots[0], { kind: 'rule', label: 'Any Holographics card', rarityId: null, rarityIds: [], version: '', clubIds: [], leagueIds: [], leagueId: null, nationId: null, minRating: null, foil: true }, 'Holographic is a foil finish, not a version');
  assert.deepEqual(holo.problems, []);
  assert.deepEqual(starter.set.slots, [null, null]);
  assert.deepEqual(starter.problems, ['No card type: add the requirement by hand.']);
});

test('club and league sets read the club, its teams and the leagues from the category', () => {
  const places = {
    clubs: [[1, 'Arsenal'], [116009, 'Arsenal'], [11, 'Man Utd'], [114030, 'FC United'], [18, 'Spurs'], [242, 'Deportivo'], [242, 'RC Deportivo'], [463, 'D. Alavés']],
    leagues: [[13, 'Premier League'], [2216, 'Barclays WSL'], [53, 'LALIGA EA SPORTS'], [2222, 'Liga F Moeve'], [2215, 'Google Pixel Frauen-Bundesliga'], [19, 'Bundesliga']],
  };
  const pl = 'Premier League / Barclays WSL';
  const [league, arsenal, united, spurs, alaves, depor, nowhere, frauen] = S.importSets({
    sets: [
      { name: 'Premier League', category: 'Leagues', slotCount: 2, cardType: '30 Premier League' },
      { name: 'Arsenal', category: pl, slotCount: 2, cardType: '20 Arsenal Mens or Womens' },
      { name: 'Manchester United', category: pl, slotCount: 1, cardType: '15 Manchester United Mens' },
      { name: 'Tottenham Hotspur', category: pl, slotCount: 1, cardType: "15 Tottenham Hotspur Women's" },
      { name: 'Deportivo Alavés', category: 'LALIGA EA SPORTS / Liga F Moeve', slotCount: 1, cardType: '15 Deportivo Alavés Mens' },
      { name: 'RC Deportivo', category: 'LALIGA EA SPORTS / Liga F Moeve', slotCount: 1, cardType: "15 RC Deportivo Men's" },
      { name: 'Nowhere', category: pl, slotCount: 1, cardType: '15 Nowhere Athletic Mens' },
      { name: 'Wolfsburg', category: 'Bundesliga / Frauen-Bundesliga', slotCount: 1, cardType: "15 Spurs Women's" },
    ],
  }, [], [], places);
  assert.deepEqual([league.set.slots[1].leagueIds, league.set.slots[1].clubIds, league.set.slots[1].label], [[13], [], 'Any Premier League player']);
  assert.deepEqual([arsenal.set.slots[0].clubIds, arsenal.set.slots[0].leagueIds], [[1, 116009], [13, 2216]]);
  assert.equal(arsenal.set.slots[0].label, 'Any Arsenal player (men or women)');
  assert.deepEqual(arsenal.problems, []);
  assert.ok(united.set.slots[0].clubIds.includes(11), '"Man Utd" fits Manchester United');
  assert.deepEqual(united.set.slots[0].leagueIds, [13], "men's team only");
  assert.deepEqual(united.problems, ['"Manchester United" read as EA\'s Man Utd.']);
  assert.deepEqual([spurs.set.slots[0].clubIds, spurs.set.slots[0].leagueIds], [[18], [2216]]);
  assert.deepEqual(alaves.set.slots[0].clubIds, [463], 'Deportivo stays with RC Deportivo');
  assert.deepEqual(depor.set.slots[0].clubIds, [242]);
  assert.deepEqual(nowhere.set.slots, [null]);
  assert.deepEqual(nowhere.problems, ['No club called "Nowhere Athletic" in EA\'s list: add these slots by hand.']);
  assert.deepEqual(frauen.set.slots[0].leagueIds, [2215], 'the women\'s league is found inside its longer EA name');
});

test("with EA's team list, club sets keep only FC 27 clubs in the set's leagues", () => {
  const teams = S.parseEaTeams({ Years: [{ Year: '2027', ClubItemTeams: [{ TeamId: 240, LeagueId: 53 }, { TeamId: 116327, LeagueId: 2222 }, { TeamId: 116334, LeagueId: 2222 }, { TeamId: 1035, LeagueId: 1014 }], Teams: [], InternationalTeams: [], LegendsTeams: [] }] });
  assert.deepEqual(teams, [[240, 53], [1035, 1014], [116327, 2222], [116334, 2222]]);
  assert.equal(S.eaFileKind({ Years: [{ ClubItemTeams: [{ TeamId: 1, LeagueId: 13 }] }] }), 'teams');
  const places = {
    clubs: [[240, 'Atlético de Madrid'], [1035, 'Atlético'], [115825, 'Madrid'], [116327, 'Atlético de Madrid'], [116334, 'Madrid CFF']],
    leagues: [[53, 'LALIGA EA SPORTS'], [2222, 'Liga F Moeve']],
    clubLeagues: teams,
  };
  const liga = 'LALIGA EA SPORTS / Liga F Moeve';
  const [atleti, cff, gone] = S.importSets({
    sets: [
      { name: 'Atlético de Madrid', category: liga, slotCount: 1, cardType: '20 Atlético de Madrid Mens or Womens' },
      { name: 'Madrid CFF', category: liga, slotCount: 1, cardType: "15 Madrid CFF Women's" },
      { name: 'Atlético Mineiro', category: liga, slotCount: 1, cardType: '15 Atlético Mineiro Mens' },
    ],
  }, [], [], places);
  assert.deepEqual(atleti.set.slots[0].clubIds, [240, 116327], 'not the old "Madrid" (115825) or Atlético Mineiro');
  assert.deepEqual(cff.set.slots[0].clubIds, [116334]);
  assert.deepEqual(gone.set.slots, [null]);
  assert.deepEqual(gone.problems, ['No FC 27 club called "Atlético Mineiro" plays in LALIGA EA SPORTS / Liga F Moeve: add these slots by hand.']);
});

test('player search ignores accents and case, and finds ids', () => {
  const rows = [[41, 'Iniesta', 92], [1, 'Martín Ibáñez', 78], [246669, 'Bukayo Saka', 87], [2, 'Saka Junior', 60]];
  assert.deepEqual(S.searchPlayers(rows, 'ibanez').map((r) => r[0]), [1]);
  assert.deepEqual(S.searchPlayers(rows, 'saka').map((r) => r[0]), [246669, 2]);
  assert.deepEqual(S.searchPlayers(rows, 'bu sa').map((r) => r[0]), [246669]);
  assert.deepEqual(S.searchPlayers(rows, '41').map((r) => r[0]), [41]);
  assert.deepEqual(S.searchPlayers(rows, '  '), []);
});
