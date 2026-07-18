export const TIPS = {
  flat: [
    '<b>Laag filmen!</b> Hoe dichter je lens bij de grond, hoe hoger de trick eruitziet.',
    'Film met een <b>beetje afstand</b> en zoom niet — loop of rol mee met de skater.',
    'Zet de skater in het <b>midden</b> van beeld en houd het board altijd in beeld.',
  ],
  ledge: [
    'Film een ledge <b>van de zijkant</b>, dan zie je de hele slide of grind.',
    'Sta iets <b>voor het einde</b> van de ledge: dan film je de landing er mooi bij.',
    '<b>Laag bij de grond</b> maakt de ledge hoger en de trick vetter.',
  ],
  rail: [
    'Bij een rail: film <b>schuin van voren</b>, dan zie je opspringen én de grind.',
    'Houd afstand — bij een rail wil je <b>de hele aanloop en landing</b> in beeld.',
    'Film niet recht van opzij: dan lijkt de rail plat. <b>Schuine hoek</b> = meer diepte.',
  ],
  stairs: [
    'Film een trap <b>van onderaf</b>: dan lijkt de set groter en de sprong hoger.',
    'Sta <b>naast de landing</b>, niet erachter — anders springt de skater op je af.',
    'Houd de camera <b>stil</b> bij een trap; de skater beweegt al genoeg.',
  ],
  transition: [
    'Bij een quarter of bowl: film <b>vanaf de coping</b> mee naar beneden.',
    'Sta <b>in het midden van de bowl</b> en draai mee — vloeiende lijnen filmen mooi.',
    'Fisheye-look? Ga <b>dicht op de transition</b> staan en film omhoog.',
  ],
  algemeen: [
    'Houd je <b>horizon recht</b> — een scheef beeld leidt af van de trick.',
    'Film <b>iets langer</b> door na de landing. Wegrollen hoort bij de clip!',
    'Begin met filmen <b>vóór de aanloop</b> start, dan kun je altijd nog trimmen.',
    '<b>Zon in je rug</b> = mooi licht op de skater. Tegenlicht = silhouet.',
    'Veeg je <b>lens</b> even schoon. Serieus, het helpt.',
  ],
};

export function randomTip(obstacle) {
  const pool = [...(TIPS[obstacle] || []), ...TIPS.algemeen];
  return pool[Math.floor(Math.random() * pool.length)];
}

export const OBSTACLE_LABELS = {
  flat: 'Flat', ledge: 'Ledge', rail: 'Rail', stairs: 'Trap', transition: 'Transition',
};
