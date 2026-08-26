/* ============================================================================
 * SCENARIO DATA — the single source of truth.
 *
 * Every screen in CAPEM reads from here. Nothing is typed into markup. If baby
 * formula is short at one site, the donor's progress bar, the coordinator's
 * coverage figure, the inventory line and the alert all move together, because
 * they are all reading this one number.
 *
 * That is not a demo convenience. It is the architecture claim being made
 * literally: one reference spine, many views. A mockup that hard-codes numbers
 * per screen cannot make that claim honestly.
 *
 * BOTH SCENARIOS ARE FICTIONAL. They are set in real regions, and informed by
 * documented events (see docs/research.md), but no centre, person, quantity or
 * event here is real. See docs/research.md for what is evidence and what is
 * illustration.
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * Shared item catalogue. Aliases are what an intake volunteer actually types
 * under pressure — this list is why "cobijas", "mantas" and "blankets" cannot
 * become three separate stock lines.
 * -------------------------------------------------------------------------*/
const CATALOG = [
  { code: 'WAT-600', cat: 'water',   unit: ['bottle', 'botella', 'garrafa'],
    name: ['Drinking water 600 ml', 'Agua potable 600 ml', 'Água potável 600 ml'],
    aliases: ['agua', 'água', 'botella agua', 'garrafa de água', 'water'], shelfLife: 12 },
  { code: 'HYG-STD', cat: 'hygiene', unit: ['kit', 'kit', 'kit'],
    name: ['Hygiene kit (standard)', 'Kit de aseo (estándar)', 'Kit de higiene (padrão)'],
    aliases: ['kit aseo', 'aseo', 'higiene', 'hygiene pack'], shelfLife: 24,
    contents: ['soap x2', 'toothpaste', 'toothbrush x2', 'sanitary pads x10', 'towel'] },
  { code: 'BLK-STD', cat: 'shelter', unit: ['unit', 'unidad', 'unidade'],
    name: ['Blanket', 'Cobija', 'Cobertor'],
    aliases: ['cobija', 'manta', 'frazada', 'cobertor', 'blanket'], shelfLife: null },
  { code: 'BBF-400', cat: 'infant',  unit: ['can', 'lata', 'lata'],
    name: ['Infant formula 400 g', 'Fórmula infantil 400 g', 'Fórmula infantil 400 g'],
    aliases: ['formula', 'fórmula', 'leche bebé', 'leite em pó', 'leite bebê'], shelfLife: null, batch: true },
  { code: 'DIA-M',   cat: 'infant',  unit: ['pack', 'paquete', 'pacote'],
    name: ['Nappies, medium', 'Pañales, medianos', 'Fraldas, médias'],
    aliases: ['pañales', 'fraldas', 'diapers'], shelfLife: null },
  { code: 'FAK-A',   cat: 'medical', unit: ['kit', 'kit', 'kit'],
    name: ['First-aid kit type A', 'Botiquín tipo A', 'Kit de primeiros socorros tipo A'],
    aliases: ['botiquin', 'botiquín', 'primeiros socorros'], shelfLife: null, batch: true },
  { code: 'TRP-46',  cat: 'shelter', unit: ['unit', 'unidad', 'unidade'],
    name: ['Tarpaulin 4x6 m', 'Lona 4x6 m', 'Lona 4x6 m'],
    aliases: ['lona', 'carpa', 'plástico'], shelfLife: null },
  { code: 'MAT-SLP', cat: 'shelter', unit: ['unit', 'unidad', 'unidade'],
    name: ['Sleeping mat', 'Colchoneta', 'Colchonete'],
    aliases: ['colchoneta', 'colchonete', 'colchão', 'mat'], shelfLife: null },
  { code: 'RCE-1K',  cat: 'food',    unit: ['bag', 'bolsa', 'pacote'],
    name: ['Rice 1 kg', 'Arroz 1 kg', 'Arroz 1 kg'],
    aliases: ['arroz', 'rice'], shelfLife: 12 },
  { code: 'CLN-STD', cat: 'hygiene', unit: ['set', 'juego', 'conjunto'],
    name: ['Cleaning set', 'Set de limpieza', 'Kit de limpeza'],
    aliases: ['limpieza', 'limpeza', 'cloro', 'desinfetante'], shelfLife: 24 },
  // Deliberately catalogued but never published as a need. Naming the thing you
  // will not accept is what lets intake decline it consistently and kindly.
  { code: 'CLO-USED', cat: 'blocked', unit: ['bag', 'bolsa', 'saco'],
    name: ['Used clothing', 'Ropa usada', 'Roupa usada'],
    aliases: ['ropa', 'roupa', 'clothing', 'vestuário'], blocked: true },
  { code: 'MIX-MISC', cat: 'blocked', unit: ['box', 'caja', 'caixa'],
    name: ['Unsorted mixed goods', 'Bolsas mixtas sin clasificar', 'Doações mistas não triadas'],
    aliases: ['mixto', 'misto', 'varios', 'diversos'], blocked: true }
];

/* ---------------------------------------------------------------------------
 * Entitlement rules — the policy the matching engine applies.
 * Deliberately small, legible, and editable by a coordinator rather than
 * buried in code. Every allocation the engine makes cites the rule that
 * produced it, so a family can be told why they received what they received.
 * -------------------------------------------------------------------------*/
const ENTITLEMENTS = [
  { item: 'BLK-STD', per: 'person',    qty: 1, cap: 8,
    rule: ['One blanket per person', 'Una cobija por persona', 'Um cobertor por pessoa'] },
  { item: 'HYG-STD', per: 'household', qty: 1, cap: 1,
    rule: ['One hygiene kit per household', 'Un kit de aseo por hogar', 'Um kit de higiene por família'] },
  { item: 'MAT-SLP', per: 'person',    qty: 1, cap: 8, ifSheltered: true,
    rule: ['One sleeping mat per person in shelter', 'Una colchoneta por persona alojada', 'Um colchonete por pessoa abrigada'] },
  { item: 'BBF-400', per: 'under5',    qty: 2, cap: 6,
    rule: ['Two tins of formula per child under 5', 'Dos latas de fórmula por menor de 5 años', 'Duas latas de fórmula por criança menor de 5 anos'] },
  { item: 'DIA-M',   per: 'under5',    qty: 1, cap: 3,
    rule: ['One pack of nappies per child under 5', 'Un paquete de pañales por menor de 5 años', 'Um pacote de fraldas por criança menor de 5 anos'] },
  { item: 'WAT-600', per: 'person',    qty: 6, cap: 48,
    rule: ['Six bottles per person per distribution', 'Seis botellas por persona por entrega', 'Seis garrafas por pessoa por entrega'] },
  { item: 'RCE-1K',  per: 'household', qty: 2, cap: 4,
    rule: ['Two bags of rice per household', 'Dos bolsas de arroz por hogar', 'Dois pacotes de arroz por família'] },
  { item: 'FAK-A',   per: 'household', qty: 1, cap: 1, ifMedical: true,
    rule: ['First-aid kit where a medical need is flagged', 'Botiquín si hay necesidad médica registrada', 'Kit de primeiros socorros se houver necessidade médica'] }
];

/* ---------------------------------------------------------------------------
 * SCENARIO 1 — Tolima, Colombia. A church that became a shelter.
 * -------------------------------------------------------------------------*/
const SCENARIO_TOLIMA = {
  id: 'tolima',
  currency: 'COP',
  locale: { en: 'en-GB', es: 'es-CO', pt: 'pt-BR' },
  preferredLang: 'es',
  cashRails: ['Nequi', 'PSE', 'Daviplata'],
  whatsappGroup: ['San José Líbano donations', 'Donaciones San José Líbano', 'Doações San José Líbano'],
  event: {
    name: ['Tolima earthquake (fictional)', 'Sismo del Tolima (ficticio)', 'Terremoto do Tolima (fictício)'],
    detail: ['M6.4 · 8 August 2026 · Ibagué–Líbano', 'M6.4 · 8 de agosto de 2026 · Ibagué–Líbano', 'M6.4 · 8 de agosto de 2026 · Ibagué–Líbano'],
    region: ['Tolima, Colombia', 'Tolima, Colombia', 'Tolima, Colômbia']
  },
  sites: [
    { id: 'libano', name: 'Parroquia San José', municipality: 'Líbano, Tolima', kind: 'church',
      independent: true, liveSince: '9 Aug', connectivity: 'intermittent', capacityM3: 60,
      shelter: { spots: 400, occupied: 312 }, hours: '07:00–19:00', address: 'Cra 3 #8-24',
      slug: 'sj-libano', coordinator: 'A. Restrepo' },
    { id: 'norte', name: 'Punto de acopio Ibagué Norte', municipality: 'Ibagué', kind: 'collection',
      independent: false, liveSince: '9 Aug', connectivity: 'online', capacityM3: 180,
      hours: '07:00–19:00', address: 'Cra. 5 #40-12', slug: 'ibague-norte', coordinator: 'J. Cifuentes' },
    { id: 'central', name: 'Bodega Central Ibagué', municipality: 'Ibagué', kind: 'warehouse',
      independent: false, liveSince: '8 Aug', connectivity: 'online', capacityM3: 1200,
      hours: '08:00–17:00', address: 'Zona Industrial, Bodega 7', slug: 'ibague-central', coordinator: 'J. Cifuentes' },
    { id: 'armero', name: 'Albergue Armero', municipality: 'Armero-Guayabal', kind: 'shelter',
      independent: false, liveSince: '10 Aug', connectivity: 'online', capacityM3: 90,
      shelter: { spots: 2100, occupied: 1900 }, hours: '24 h', address: 'Polideportivo municipal',
      slug: 'armero', coordinator: 'S. Ríos' }
  ],
  // target = the quantity this site has published as needed.
  needs: [
    { site: 'libano',  item: 'BBF-400', target: 300,  priority: 'critical', published: true,  channels: ['items', 'money'] },
    { site: 'libano',  item: 'BLK-STD', target: 400,  priority: 'critical', published: true,  channels: ['items', 'money'] },
    { site: 'libano',  item: 'HYG-STD', target: 200,  priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'libano',  item: 'DIA-M',   target: 150,  priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'armero',  item: 'BLK-STD', target: 800,  priority: 'critical', published: true,  channels: ['items', 'money'] },
    { site: 'armero',  item: 'MAT-SLP', target: 600,  priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'armero',  item: 'WAT-600', target: 10000,priority: 'medium',   published: true,  channels: ['money'] },
    { site: 'norte',   item: 'HYG-STD', target: 300,  priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'norte',   item: 'RCE-1K',  target: 400,  priority: 'medium',   published: true,  channels: ['items', 'money'] },
    { site: 'central', item: 'TRP-46',  target: 800,  priority: 'medium',   published: false, channels: ['items'] },
    { site: 'central', item: 'FAK-A',   target: 250,  priority: 'medium',   published: true,  channels: ['money'] }
  ],
  stock: [
    { site: 'libano',  item: 'BBF-400', onHand: 55,   min: 60,   incoming: 120 },
    { site: 'libano',  item: 'BLK-STD', onHand: 96,   min: 120,  incoming: 60 },
    { site: 'libano',  item: 'HYG-STD', onHand: 84,   min: 50,   incoming: 20 },
    { site: 'libano',  item: 'DIA-M',   onHand: 40,   min: 40,   incoming: 30 },
    { site: 'libano',  item: 'WAT-600', onHand: 1900, min: 800,  incoming: 3840 },
    { site: 'libano',  item: 'FAK-A',   onHand: 22,   min: 25,   incoming: 0 },
    { site: 'libano',  item: 'RCE-1K',  onHand: 210,  min: 100,  incoming: 0 },
    { site: 'libano',  item: 'MAT-SLP', onHand: 130,  min: 100,  incoming: 0 },
    { site: 'armero',  item: 'BLK-STD', onHand: 284,  min: 300,  incoming: 150 },
    { site: 'armero',  item: 'MAT-SLP', onHand: 310,  min: 250,  incoming: 0 },
    { site: 'armero',  item: 'WAT-600', onHand: 4200, min: 2000, incoming: 5760 },
    { site: 'armero',  item: 'HYG-STD', onHand: 140,  min: 120,  incoming: 0 },
    { site: 'armero',  item: 'BBF-400', onHand: 61,   min: 50,   incoming: 0 },
    { site: 'armero',  item: 'DIA-M',   onHand: 55,   min: 40,   incoming: 0 },
    { site: 'armero',  item: 'RCE-1K',  onHand: 380,  min: 200,  incoming: 50 },
    { site: 'norte',   item: 'HYG-STD', onHand: 180,  min: 100,  incoming: 75 },
    { site: 'norte',   item: 'BLK-STD', onHand: 140,  min: 200,  incoming: 210 },
    { site: 'norte',   item: 'RCE-1K',  onHand: 220,  min: 150,  incoming: 50 },
    { site: 'norte',   item: 'BBF-400', onHand: 74,   min: 40,   incoming: 0 },
    { site: 'central', item: 'WAT-600', onHand: 4100, min: 1500, incoming: 9600 },
    { site: 'central', item: 'TRP-46',  onHand: 390,  min: 80,   incoming: 0 },
    { site: 'central', item: 'FAK-A',   onHand: 96,   min: 40,   incoming: 0, expiring: 14 },
    { site: 'central', item: 'BLK-STD', onHand: 180,  min: 200,  incoming: 0 },
    { site: 'central', item: 'HYG-STD', onHand: 96,   min: 100,  incoming: 60 },
    { site: 'central', item: 'RCE-1K',  onHand: 820,  min: 300,  incoming: 0 }
  ],
  families: [
    { ref: 'PS-2214', site: 'libano', size: 4, under5: 1, over65: 0, medical: false, sheltered: true,  daysWaiting: 1, needs: ['shelter', 'infant'],  received: {} },
    { ref: 'PS-2215', site: 'libano', size: 2, under5: 0, over65: 1, medical: false, sheltered: true,  daysWaiting: 3, needs: ['food'],              received: { 'BLK-STD': 2 } },
    { ref: 'PS-2216', site: 'libano', size: 6, under5: 2, over65: 0, medical: true,  sheltered: true,  daysWaiting: 2, needs: ['medical', 'shelter'], received: {} },
    { ref: 'PS-2217', site: 'libano', size: 3, under5: 0, over65: 0, medical: false, sheltered: false, daysWaiting: 0, needs: ['food'],              received: { 'HYG-STD': 1 } },
    { ref: 'PS-2218', site: 'libano', size: 5, under5: 1, over65: 2, medical: true,  sheltered: true,  daysWaiting: 4, needs: ['medical', 'food'],    received: {} },
    { ref: 'PS-2219', site: 'libano', size: 1, under5: 0, over65: 1, medical: false, sheltered: true,  daysWaiting: 2, needs: ['shelter'],           received: {} },
    { ref: 'AR-0431', site: 'armero', size: 7, under5: 2, over65: 1, medical: false, sheltered: true,  daysWaiting: 1, needs: ['shelter', 'infant'],  received: {} },
    { ref: 'AR-0432', site: 'armero', size: 2, under5: 0, over65: 0, medical: false, sheltered: true,  daysWaiting: 5, needs: ['food'],              received: {} }
  ],
  volunteers: [
    { id: 'v1', name: 'María Rodríguez',       base: 'Ibagué', skills: ['medic', 'firstaid'], verified: true,  avail: ['sat', 'sun'], shifts: 6, trained: ['intake'] },
    { id: 'v2', name: 'Carlos Gómez',          base: 'Ibagué', skills: ['driver', 'logistics'], verified: true, avail: ['daily'],     shifts: 9, trained: [] },
    { id: 'v3', name: 'Ana Torres',            base: 'Líbano', skills: ['logistics', 'cooking'], verified: false, avail: ['weekend'], shifts: 4, trained: ['intake', 'gate'] },
    { id: 'v4', name: 'Juan Pablo Mejía',      base: 'Bogotá', skills: ['translator', 'it'],   verified: false, avail: ['sat'],       shifts: 2, trained: [] },
    { id: 'v5', name: 'Luisa Fernanda Ortiz',  base: 'Ibagué', skills: ['medic'],              verified: true,  avail: ['sat'],       shifts: 5, trained: [] },
    { id: 'v6', name: 'Camila Vargas',         base: 'Ibagué', skills: ['psychologist'],       verified: false, avail: ['sun'],       shifts: 1, trained: [], pending: true },
    { id: 'v7', name: 'Diego Ramírez',         base: 'Ibagué', skills: ['general'],            verified: false, avail: ['flexible'],  shifts: 3, trained: [], noShows: 2 },
    { id: 'v8', name: 'Andrés Castro',         base: 'Armero', skills: ['driver', 'general'],  verified: true,  avail: ['daily'],     shifts: 7, trained: ['gate'] }
  ],
  shifts: [
    { id: 's1', site: 'libano',  template: 'medical',      start: '06:00', end: '12:00', slots: [{ skill: 'medic', need: 4, filled: 2 }, { skill: 'general', need: 2, filled: 2 }] },
    { id: 's2', site: 'norte',   template: 'sorting',      start: '07:00', end: '13:00', slots: [{ skill: 'logistics', need: 6, filled: 5 }, { skill: 'general', need: 4, filled: 3 }] },
    { id: 's3', site: 'armero',  template: 'transport',    start: '08:00', end: '14:00', slots: [{ skill: 'driver', need: 8, filled: 5 }] },
    { id: 's4', site: 'armero',  template: 'distribution', start: '14:00', end: '20:00', slots: [{ skill: 'logistics', need: 4, filled: 4 }, { skill: 'translator', need: 1, filled: 1 }] }
  ],
  movements: [
    { time: '14:22', type: 'in',     item: 'BLK-STD', qty: 20,    site: 'norte',   src: 'pass', ref: 'CP-2026-08441', by: 'QR scan' },
    { time: '13:50', type: 'out',    item: 'WAT-600', qty: -1200, site: 'central', src: 'dist', ref: 'D-1182',        by: 'C. Gómez' },
    { time: '13:12', type: 'in',     item: 'HYG-STD', qty: 60,    site: 'central', src: 'buy',  ref: 'pooled cash',   by: 'J. Cifuentes' },
    { time: '12:40', type: 'xfer',   item: 'TRP-46',  qty: 120,   site: 'central', src: 'xfer', ref: 'T-208 → Líbano', by: 'system' },
    { time: '11:05', type: 'out',    item: 'FAK-A',   qty: -8,    site: 'libano',  src: 'dist', ref: 'medical post',  by: 'M. Rodríguez' },
    { time: '09:15', type: 'in',     item: 'BBF-400', qty: 35,    site: 'norte',   src: 'walk', ref: 'walk-in',       by: 'A. Torres' },
    { time: '08:30', type: 'redirect', item: 'CLO-USED', qty: 0,  site: 'norte',   src: 'walk', ref: 'off-catalogue', by: 'A. Torres' }
  ],
  cashOptions: [
    { amount: 25000,  key: 'water_week' },
    { amount: 30000,  key: 'hygiene_kit' },
    { amount: 45000,  key: 'baby_kit' },
    { amount: 100000, key: 'custom' }
  ],
  stats: { donorsToday: 64, walkIns: 17, redirected: 4, vouchersToday: 142, registeredToday: 31, cashPool: 4820000, cashDonors: 214 }
};

/* ---------------------------------------------------------------------------
 * SCENARIO 2 — Rio Grande do Sul, Brazil. A flood, a gymnasium, a state
 * response already running. Included because the strongest field evidence for
 * this design is Brazilian, and because a platform that only works in one
 * country is not a platform. Fictional event, real region.
 * -------------------------------------------------------------------------*/
const SCENARIO_RS = {
  id: 'rs',
  currency: 'BRL',
  locale: { en: 'en-GB', es: 'es-CO', pt: 'pt-BR' },
  preferredLang: 'pt',
  cashRails: ['Pix', 'Boleto', 'Cartão'],
  whatsappGroup: ['Vale do Taquari donations', 'Donaciones Vale do Taquari', 'Doações Vale do Taquari'],
  event: {
    name: ['Vale do Taquari floods (fictional)', 'Inundaciones del Vale do Taquari (ficticio)', 'Enchentes do Vale do Taquari (fictício)'],
    detail: ['Rising water · 12 March 2026 · Lajeado–Canoas', 'Crecida · 12 de marzo de 2026 · Lajeado–Canoas', 'Cheia · 12 de março de 2026 · Lajeado–Canoas'],
    region: ['Rio Grande do Sul, Brazil', 'Rio Grande do Sul, Brasil', 'Rio Grande do Sul, Brasil']
  },
  sites: [
    { id: 'canoas', name: 'Paróquia São José', municipality: 'Canoas, RS', kind: 'church',
      independent: true, liveSince: '13 Mar', connectivity: 'intermittent', capacityM3: 70,
      shelter: { spots: 380, occupied: 341 }, hours: '07:00–20:00', address: 'Rua das Acácias, 240',
      slug: 'sao-jose-canoas', coordinator: 'P. Almeida' },
    { id: 'leopoldo', name: 'Ginásio Municipal', municipality: 'São Leopoldo, RS', kind: 'sports',
      independent: false, liveSince: '13 Mar', connectivity: 'online', capacityM3: 220,
      shelter: { spots: 900, occupied: 690 }, hours: '24 h', address: 'Av. Central, 1500',
      slug: 'ginasio-sao-leopoldo', coordinator: 'R. Peixoto' },
    { id: 'poa', name: 'Centro de Distribuição Porto Alegre', municipality: 'Porto Alegre, RS', kind: 'warehouse',
      independent: false, liveSince: '12 Mar', connectivity: 'online', capacityM3: 1400,
      hours: '08:00–18:00', address: 'Distrito Industrial, Galpão 4', slug: 'cd-porto-alegre', coordinator: 'L. Bastos' },
    { id: 'lajeado', name: 'Abrigo Vila Nova', municipality: 'Lajeado, RS', kind: 'shelter',
      independent: true, liveSince: '14 Mar', connectivity: 'offline', capacityM3: 45,
      shelter: { spots: 260, occupied: 248 }, hours: '24 h', address: 'Escola Municipal Vila Nova',
      slug: 'vila-nova-lajeado', coordinator: 'C.772' }
  ],
  needs: [
    { site: 'canoas',   item: 'CLN-STD', target: 500,   priority: 'critical', published: true,  channels: ['items', 'money'] },
    { site: 'canoas',   item: 'WAT-600', target: 12000, priority: 'critical', published: true,  channels: ['money'] },
    { site: 'canoas',   item: 'MAT-SLP', target: 400,   priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'canoas',   item: 'BBF-400', target: 220,   priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'leopoldo', item: 'MAT-SLP', target: 900,   priority: 'critical', published: true,  channels: ['items', 'money'] },
    { site: 'leopoldo', item: 'CLN-STD', target: 700,   priority: 'critical', published: true,  channels: ['items', 'money'] },
    { site: 'leopoldo', item: 'HYG-STD', target: 600,   priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'lajeado',  item: 'WAT-600', target: 4000,  priority: 'critical', published: true,  channels: ['money'] },
    { site: 'lajeado',  item: 'CLN-STD', target: 250,   priority: 'high',     published: true,  channels: ['items', 'money'] },
    { site: 'poa',      item: 'FAK-A',   target: 300,   priority: 'medium',   published: true,  channels: ['money'] },
    { site: 'poa',      item: 'TRP-46',  target: 600,   priority: 'medium',   published: false, channels: ['items'] }
  ],
  stock: [
    { site: 'canoas',   item: 'CLN-STD', onHand: 120,  min: 150,  incoming: 200 },
    { site: 'canoas',   item: 'WAT-600', onHand: 3400, min: 2000, incoming: 7200 },
    { site: 'canoas',   item: 'MAT-SLP', onHand: 190,  min: 200,  incoming: 80 },
    { site: 'canoas',   item: 'BBF-400', onHand: 58,   min: 60,   incoming: 40 },
    { site: 'canoas',   item: 'HYG-STD', onHand: 210,  min: 120,  incoming: 0 },
    { site: 'canoas',   item: 'BLK-STD', onHand: 240,  min: 150,  incoming: 0 },
    { site: 'canoas',   item: 'DIA-M',   onHand: 62,   min: 50,   incoming: 0 },
    { site: 'canoas',   item: 'RCE-1K',  onHand: 300,  min: 150,  incoming: 0 },
    { site: 'leopoldo', item: 'MAT-SLP', onHand: 420,  min: 400,  incoming: 200 },
    { site: 'leopoldo', item: 'CLN-STD', onHand: 260,  min: 250,  incoming: 150 },
    { site: 'leopoldo', item: 'HYG-STD', onHand: 300,  min: 200,  incoming: 0 },
    { site: 'leopoldo', item: 'WAT-600', onHand: 7800, min: 3000, incoming: 0 },
    { site: 'leopoldo', item: 'BLK-STD', onHand: 500,  min: 300,  incoming: 0 },
    { site: 'leopoldo', item: 'BBF-400', onHand: 90,   min: 60,   incoming: 0 },
    { site: 'leopoldo', item: 'DIA-M',   onHand: 110,  min: 60,   incoming: 0 },
    { site: 'leopoldo', item: 'RCE-1K',  onHand: 640,  min: 300,  incoming: 0 },
    { site: 'lajeado',  item: 'WAT-600', onHand: 900,  min: 1200, incoming: 2400 },
    { site: 'lajeado',  item: 'CLN-STD', onHand: 40,   min: 60,   incoming: 60 },
    { site: 'lajeado',  item: 'MAT-SLP', onHand: 180,  min: 150,  incoming: 0 },
    { site: 'lajeado',  item: 'HYG-STD', onHand: 96,   min: 80,   incoming: 0 },
    { site: 'lajeado',  item: 'BLK-STD', onHand: 200,  min: 120,  incoming: 0 },
    { site: 'poa',      item: 'WAT-600', onHand: 18000,min: 5000, incoming: 12000 },
    { site: 'poa',      item: 'CLN-STD', onHand: 640,  min: 300,  incoming: 400 },
    { site: 'poa',      item: 'FAK-A',   onHand: 140,  min: 60,   incoming: 0, expiring: 22 },
    { site: 'poa',      item: 'TRP-46',  onHand: 720,  min: 100,  incoming: 0 },
    { site: 'poa',      item: 'MAT-SLP', onHand: 260,  min: 200,  incoming: 0 },
    { site: 'poa',      item: 'RCE-1K',  onHand: 1500, min: 400,  incoming: 0 }
  ],
  families: [
    { ref: 'SJ-0118', site: 'canoas',   size: 5, under5: 2, over65: 0, medical: false, sheltered: true,  daysWaiting: 2, needs: ['shelter', 'infant'], received: {} },
    { ref: 'SJ-0119', site: 'canoas',   size: 3, under5: 0, over65: 2, medical: true,  sheltered: true,  daysWaiting: 4, needs: ['medical'],           received: {} },
    { ref: 'SJ-0120', site: 'canoas',   size: 2, under5: 0, over65: 0, medical: false, sheltered: false, daysWaiting: 1, needs: ['cleaning'],          received: { 'CLN-STD': 1 } },
    { ref: 'SJ-0121', site: 'canoas',   size: 6, under5: 1, over65: 1, medical: false, sheltered: true,  daysWaiting: 3, needs: ['shelter', 'food'],   received: {} },
    { ref: 'GM-0507', site: 'leopoldo', size: 4, under5: 0, over65: 0, medical: false, sheltered: true,  daysWaiting: 5, needs: ['shelter'],           received: {} },
    { ref: 'GM-0508', site: 'leopoldo', size: 8, under5: 3, over65: 1, medical: true,  sheltered: true,  daysWaiting: 2, needs: ['medical', 'infant'], received: {} },
    { ref: 'VN-0044', site: 'lajeado',  size: 3, under5: 1, over65: 0, medical: false, sheltered: true,  daysWaiting: 6, needs: ['shelter', 'water'],  received: {} }
  ],
  volunteers: [
    { id: 'w1', name: 'Fernanda Lima',   base: 'Canoas',       skills: ['medic'],                verified: true,  avail: ['daily'],    shifts: 8, trained: ['intake', 'gate'] },
    { id: 'w2', name: 'Rodrigo Peixoto', base: 'São Leopoldo', skills: ['logistics', 'driver'],  verified: true,  avail: ['daily'],    shifts: 12, trained: ['coordinator'] },
    { id: 'w3', name: 'Beatriz Nunes',   base: 'Porto Alegre', skills: ['logistics'],            verified: false, avail: ['weekend'],  shifts: 3, trained: ['intake'] },
    { id: 'w4', name: 'Marcelo Antunes', base: 'Lajeado',      skills: ['driver', 'general'],    verified: true,  avail: ['daily'],    shifts: 6, trained: [] },
    { id: 'w5', name: 'Juliana Corrêa',  base: 'Canoas',       skills: ['psychologist'],         verified: false, avail: ['sat'],      shifts: 2, trained: [], pending: true },
    { id: 'w6', name: 'Paulo Sartori',   base: 'São Leopoldo', skills: ['general'],              verified: false, avail: ['flexible'], shifts: 4, trained: ['gate'] }
  ],
  shifts: [
    { id: 't1', site: 'canoas',   template: 'distribution', start: '08:00', end: '14:00', slots: [{ skill: 'logistics', need: 6, filled: 4 }, { skill: 'general', need: 4, filled: 4 }] },
    { id: 't2', site: 'leopoldo', template: 'sorting',      start: '07:00', end: '13:00', slots: [{ skill: 'logistics', need: 8, filled: 5 }, { skill: 'general', need: 6, filled: 6 }] },
    { id: 't3', site: 'lajeado',  template: 'transport',    start: '06:00', end: '12:00', slots: [{ skill: 'driver', need: 4, filled: 2 }] },
    { id: 't4', site: 'poa',      template: 'medical',      start: '12:00', end: '18:00', slots: [{ skill: 'medic', need: 3, filled: 3 }, { skill: 'general', need: 2, filled: 1 }] }
  ],
  movements: [
    { time: '15:10', type: 'in',       item: 'CLN-STD', qty: 80,    site: 'canoas',   src: 'pass', ref: 'CP-2026-04412', by: 'QR scan' },
    { time: '14:35', type: 'out',      item: 'WAT-600', qty: -2400, site: 'poa',      src: 'dist', ref: 'D-0331',        by: 'M. Antunes' },
    { time: '13:20', type: 'xfer',     item: 'MAT-SLP', qty: 200,   site: 'poa',      src: 'xfer', ref: 'T-114 → Ginásio', by: 'system' },
    { time: '12:05', type: 'in',       item: 'CLN-STD', qty: 150,   site: 'poa',      src: 'buy',  ref: 'pooled Pix',    by: 'L. Bastos' },
    { time: '10:40', type: 'in',       item: 'MAT-SLP', qty: 45,    site: 'leopoldo', src: 'walk', ref: 'walk-in',       by: 'B. Nunes' },
    { time: '09:55', type: 'redirect', item: 'CLO-USED', qty: 0,    site: 'leopoldo', src: 'walk', ref: 'off-catalogue', by: 'B. Nunes' },
    { time: '09:10', type: 'out',      item: 'CLN-STD', qty: -60,   site: 'leopoldo', src: 'dist', ref: 'D-0329',        by: 'P. Sartori' }
  ],
  cashOptions: [
    { amount: 30,  key: 'water_week' },
    { amount: 45,  key: 'cleaning_set' },
    { amount: 60,  key: 'baby_kit' },
    { amount: 120, key: 'custom' }
  ],
  stats: { donorsToday: 91, walkIns: 34, redirected: 12, vouchersToday: 208, registeredToday: 47, cashPool: 96400, cashDonors: 1180 }
};

const SCENARIOS = { tolima: SCENARIO_TOLIMA, rs: SCENARIO_RS };

/* ---------------------------------------------------------------------------
 * Population expansion.
 *
 * The hand-written families above are narrative anchors — they appear in the
 * walkthroughs by name. But a centre sheltering 312 people does not have six
 * households, and a matching engine that never runs out of stock demonstrates
 * nothing. Rationing is the interesting case, and the one practitioners will
 * want to interrogate.
 *
 * So the rest of the caseload is generated from the site's actual occupancy
 * with a fixed seed: deterministic, so every reviewer sees the same figures and
 * can refer to a household by reference, and consistent with the shelter counts
 * shown everywhere else.
 * -------------------------------------------------------------------------*/
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expandFamilies(scenario) {
  const rand = mulberry32(scenario.id === 'tolima' ? 20260808 : 20260312);
  const generated = [];

  scenario.sites.forEach(site => {
    if (!site.shelter) return;
    const anchors = scenario.families.filter(f => f.site === site.id);
    const anchorPeople = anchors.reduce((a, f) => a + f.size, 0);
    let remaining = site.shelter.occupied - anchorPeople;
    if (remaining <= 0) return;

    const prefix = site.id.slice(0, 2).toUpperCase();
    let n = 1;
    while (remaining > 0) {
      // Household sizes weighted towards 2-5, which is what shelter censuses
      // in both documented events actually look like.
      const roll = rand();
      let size = roll < 0.14 ? 1 : roll < 0.36 ? 2 : roll < 0.60 ? 3 :
                 roll < 0.80 ? 4 : roll < 0.92 ? 5 : roll < 0.97 ? 6 : 7;
      size = Math.min(size, remaining);
      remaining -= size;

      const under5 = size >= 3 && rand() < 0.34 ? (rand() < 0.75 ? 1 : 2) : 0;
      const over65 = rand() < 0.19 ? 1 : 0;

      generated.push({
        ref: prefix + '-' + String(4000 + n * 7).padStart(4, '0'),
        site: site.id,
        size: size,
        under5: Math.min(under5, size),
        over65: Math.min(over65, size - under5 >= 0 ? over65 : 0),
        medical: rand() < 0.11,
        sheltered: true,
        daysWaiting: Math.floor(rand() * 5),
        needs: [],
        received: {},
        generated: true
      });
      n++;
    }
  });

  scenario.families = scenario.families.concat(generated);
  return scenario;
}

Object.values(SCENARIOS).forEach(expandFamilies);
