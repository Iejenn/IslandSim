// Everything she can make: crafts (one sitting at the campfire, e.g. an axe)
// and projects (built on site over several sessions, e.g. the dock). She sets
// one as her goal once it fits her life (see `unlocked`), gathers the
// resources, then makes it. Nothing is listed for the player in advance.
import { BRIDGE_Y, DOCK, height, onBridgeLine, type Pt } from './island';
import { remember } from './memory';
import { addXp } from './skills';
import { dayNum, highlight, log, S, say, tr, type CraftKey, type PlanKey, type ProjectKey, type Resource, type Style } from './state';
import { growTaste, tasteFor, type Leaning } from './taste';

interface PlanDef {
  kind: 'craft' | 'build';
  name: string;
  a: string; // with article, for "she decided to make …"
  cost: Partial<Record<Resource, number>>;
  minutes: number; // game minutes of work at skill level 0
  unlocked: () => boolean;
  want: string; // what she says when she sets the goal
  done: string; // what she says when it's finished
  weight: () => number; // how much she wants it compared to the other options
  tags: Leaning[]; // which of her leanings it appeals to (see taste.ts)
}

/* ---------- building styles ---------- */
// Furniture, the fence and the bridge come in her favourite material: bamboo,
// wood or stone. Each has its own cost; the look follows (world/crafted.ts, buildings.ts).
const STYLE_COST: Partial<Record<PlanKey, Record<Style, Partial<Record<Resource, number>>>>> = {
  chair: { wood: { wood: 3 }, bamboo: { bamboo: 3, fibre: 1 }, stone: { stone: 4 } },
  table: { wood: { wood: 4, stone: 2 }, bamboo: { bamboo: 4, fibre: 2 }, stone: { stone: 5, wood: 1 } },
  bed: { wood: { wood: 4, fibre: 3 }, bamboo: { bamboo: 4, fibre: 3 }, stone: { stone: 4, fibre: 3 } },
  shelf: { wood: { wood: 3 }, bamboo: { bamboo: 3, fibre: 1 }, stone: { stone: 3, wood: 1 } },
  fence: { wood: { wood: 10 }, bamboo: { bamboo: 10, fibre: 3 }, stone: { stone: 16 } },
  bridge: { wood: { wood: 9, fibre: 2 }, bamboo: { bamboo: 8, fibre: 3 }, stone: { stone: 14 } },
  firecover: { wood: { wood: 5, fibre: 2 }, bamboo: { bamboo: 5, fibre: 2 }, stone: { stone: 6, wood: 2 } },
};
export const STYLED = Object.keys(STYLE_COST) as PlanKey[];
/**
 * What she'll make this from: once started, whatever she started it in;
 * otherwise her favourite material if she can get it (no bamboo before she's
 * found the islet), else wood.
 */
export function styleFor(k: PlanKey): Style {
  const made = S.madeStyle[k];
  if (made && progressOf(k).started) return made;
  const want = intendedStyle(k);
  // bamboo only when it's at hand: already in her stock, or a bridge away. Otherwise she
  // builds in wood now (she never waits for the tide) and may rework it later (see 'rework')
  return want === 'bamboo' && !bambooAtHand(STYLE_COST[k]!.bamboo.bamboo ?? 0) ? 'wood' : want;
}
/**
 * What she'd make this piece from, given the choice: her favourite, though a
 * preference, not a rule: about one piece in five she makes from something else
 * (fixed per piece, from her name, so it doesn't change while she gathers for it).
 */
function intendedStyle(k: PlanKey): Style {
  let h = 0;
  for (const c of S.name + k) h = (h * 31 + c.charCodeAt(0)) % 1000;
  const others = (['wood', 'bamboo', 'stone'] as Style[]).filter(x => x !== S.style);
  return h < 200 ? others[h % 2] : S.style ?? 'wood';
}
const bambooAtHand = (n: number) => S.isletFound && (works('bridge') || S.stock.bamboo >= n);
const styledCost = (k: PlanKey) => STYLE_COST[k]![styleFor(k)];
const isMade = (k: PlanKey) => isProject(k) ? S.projects[k].done : !!S.items[k as CraftKey];
/** A piece she'd like to remake: built in wood only because her favourite wasn't at hand then. */
function reworkTarget(): PlanKey | null {
  if (S.goal === 'rework' && S.reworkOf) return S.reworkOf;
  return STYLED.find(k => isMade(k) && intendedStyle(k) === S.style && (S.madeStyle[k] ?? 'wood') !== S.style) ?? null;
}
/** What reworking costs: three quarters of making it new (the old piece gives some back). */
function reworkCost() {
  const k = reworkTarget(), out: Partial<Record<Resource, number>> = {};
  if (!k) return out;
  for (const [r, n] of Object.entries(STYLE_COST[k]![S.style]) as [Resource, number][]) out[r] = Math.max(1, Math.ceil(n * 0.75));
  return out;
}
const reworkName = () => { const k = reworkTarget(); return k ? `${S.style} ${PLANS[k].name}` : 'piece'; };

export const PLANS: Record<PlanKey, PlanDef> = {
  /* ---------- crafts ---------- */
  axe: {
    kind: 'craft', name: 'stone axe', a: 'a stone axe', cost: { wood: 1, stone: 2 }, minutes: 60,
    unlocked: () => S.min >= 9 * 60,
    want: 'A sharp stone on a stick… an axe. Then I can cut real firewood.',
    done: 'A stone axe! Crude, but it’ll bite.',
    // useful to everyone, but not everyone's first thought (fallen branches do for a while)
    weight: () => 3 + (S.stock.wood < 2 ? 1 : 0),

    tags: ['practical'],
  },
  pick: {
    kind: 'craft', name: 'stone pick', a: 'a stone pick', cost: { wood: 1, stone: 3 }, minutes: 60,
    unlocked: () => !!S.items.axe || dayNum() >= 3,
    want: 'With a pick I could break proper stones off those boulders.',
    done: 'A pick. Those boulders don’t stand a chance.',
    weight: () => 2,

    tags: ['practical'],
  },
  rod: {
    kind: 'craft', name: 'fishing rod', a: 'a fishing rod', cost: { wood: 1, fibre: 2 }, minutes: 45,
    // a spear fisher only bothers with a rod once she's good at fishing
    unlocked: () => S.stats.fishTrips >= 1 && (!S.items.spear || S.skills.fishing.lvl >= 3),
    want: 'If only I had a proper fishing rod… I could make one.',
    done: 'A real fishing rod, made by me. The fish don’t stand a chance.',
    weight: () => (tr('hardworking') ? 3 : 1.5) + (S.fishFails >= 2 ? 2 : 0),

    tags: ['sea'],
  },
  basket: {
    kind: 'craft', name: 'basket', a: 'a basket', cost: { fibre: 4 }, minutes: 50,
    unlocked: () => S.stats.forages >= 3,
    want: 'If I wove a basket, I could carry more berries back.',
    done: 'A woven basket. My grandmother would be proud.',
    weight: () => 1.5,

    tags: ['green', 'practical'],
  },
  hammock: {
    kind: 'craft', name: 'hammock', a: 'a hammock', cost: { fibre: 6, wood: 2 }, minutes: 90,
    unlocked: () => S.stats.nightsInShelter >= 2,
    want: 'My back aches. A hammock would be heaven, if I can weave one.',
    done: 'A hammock! Tonight I sleep like a queen.',
    weight: () => tr('lazy') ? 3 : 1.2,

    tags: ['comfort', 'adventure'],
  },
  bucket: {
    kind: 'craft', name: 'bucket', a: 'a bucket', cost: { wood: 3, fibre: 1 }, minutes: 60,
    // for watering the garden, or as a cooking pot once she's growing vegetables
    unlocked: () => S.stats.waterings >= 2 || (S.projects.garden.done && S.stats.meals >= 4),
    want: 'A bucket would carry water for the garden, and double as a cooking pot.',
    done: 'A bucket! My poor hands thank me.',
    weight: () => tr('lazy') ? 2.5 : 1.5,

    tags: ['green', 'practical'],
  },
  drum: {
    kind: 'craft', name: 'drum', a: 'a drum', cost: { wood: 2, fibre: 2 }, minutes: 75,
    unlocked: () => tr('musical') || dayNum() >= 2,
    want: 'I miss music. Maybe I can make a drum.',
    done: 'It’s just a log and some fibre, but it has a beat!',
    weight: () => tr('musical') ? 4 : 1,

    tags: ['creative'],
  },
  journal: {
    kind: 'craft', name: 'story boards', a: 'some story boards', cost: { wood: 2 }, minutes: 60,
    unlocked: () => tr('curious') || dayNum() >= 2,
    want: 'I could carve my stories into wooden boards. A book only I can read.',
    done: 'My first story board. Chapter one: the beach.',
    weight: () => tr('curious') ? 3 : 1,

    tags: ['creative'],
  },

  spear: {
    kind: 'craft', name: 'fishing spear', a: 'a fishing spear', cost: { wood: 1, stone: 1 }, minutes: 35,
    // the other way to catch fish: wade in and spear them (she rarely makes both)
    unlocked: () => S.stats.fishTrips >= 1 && !S.items.rod,
    want: 'Sitting and waiting isn’t for me. A sharp spear, and I’ll wade in after them.',
    done: 'A fishing spear! Watch out, fish.',
    weight: () => 1.5 + (tr('hardworking') ? 0.5 : 0) + (S.fishFails >= 2 ? 1 : 0),
    tags: ['sea', 'adventure'],
  },

  snare: {
    kind: 'craft', name: 'rabbit snares', a: 'some rabbit snares', cost: { fibre: 3, wood: 1 }, minutes: 40,
    // the patient way to hunt: set them by the warren and come back later (animal lovers rarely want this)
    unlocked: () => dayNum() >= 4,
    want: 'There are rabbits deep in the forest. A few snares by the warren…',
    done: 'Snares, set and ready. Sorry, bunnies.',
    weight: () => (2.2 + (tr('lazy') ? 0.8 : 0)) * (1.2 - S.taste.animals),
    tags: ['practical'],
  },

  /* ---------- more instruments, as her music grows ---------- */
  flute: {
    kind: 'craft', name: 'bamboo flute', a: 'a bamboo flute', cost: { wood: 1 }, minutes: 40,
    unlocked: () => (!!S.items.drum && S.skills.music.lvl >= 1) || (tr('musical') && dayNum() >= 3),
    want: 'A hollow stem, a few holes… I could make a flute.',
    done: 'A flute! It squeaks, but it sings.',
    weight: () => tr('musical') ? 3 : 1,
    tags: ['creative'],
  },
  ukulele: {
    kind: 'craft', name: 'ukulele', a: 'a ukulele', cost: { wood: 3, fibre: 3 }, minutes: 120,
    unlocked: () => S.skills.music.lvl >= 2 && S.skills.crafting.lvl >= 2,
    want: 'A little ukulele, with strings of twisted fibre. I could sing along.',
    done: 'A ukulele! Four strings and a whole lot of happiness.',
    weight: () => tr('musical') ? 3 : 0.8,
    tags: ['creative'],
  },
  marimba: {
    kind: 'craft', name: 'marimba', a: 'a marimba', cost: { wood: 6, fibre: 2 }, minutes: 160,
    unlocked: () => S.skills.music.lvl >= 3 && S.skills.crafting.lvl >= 3,
    want: 'Wooden bars of different lengths… each one a note. A marimba!',
    done: 'A marimba! It sounds like rain on a tin roof, in tune.',
    weight: () => tr('musical') ? 2.5 : 0.6,
    tags: ['creative'],
  },

  /* ---------- furniture: she only thinks of these once her crafting is good enough ---------- */
  chair: {
    kind: 'craft', name: 'chair', a: 'a chair', get cost() { return styledCost('chair'); }, minutes: 70,
    unlocked: () => S.skills.crafting.lvl >= 1,
    want: 'I’m sick of sitting on logs. A real chair by the fire, that’s the dream.',
    done: 'A chair! An actual chair. I feel like a queen.',
    weight: () => 2 + (tr('lazy') ? 1 : 0),

    tags: ['comfort'],
  },
  table: {
    kind: 'craft', name: 'table', a: 'a table', get cost() { return styledCost('table'); }, minutes: 90,
    unlocked: () => S.skills.crafting.lvl >= 2,
    want: 'Eating off my knees gets old. A table would make meals feel civilised.',
    done: 'A table! Dinner is served. Properly.',
    weight: () => 1.5,

    tags: ['comfort'],
  },
  bed: {
    kind: 'craft', name: 'bed frame', a: 'a bed frame', get cost() { return styledCost('bed'); }, minutes: 100,
    unlocked: () => S.skills.crafting.lvl >= 3 && S.stats.nightsInShelter >= 3,
    want: 'If I raised my bed off the ground, maybe I’d stop waking up with sand everywhere.',
    done: 'A proper bed frame. Goodbye, sand.',
    weight: () => 1.5 + (tr('lazy') ? 1 : 0),

    tags: ['comfort'],
  },
  shelf: {
    kind: 'craft', name: 'shelf', a: 'a shelf', get cost() { return styledCost('shelf'); }, minutes: 60,
    unlocked: () => S.skills.crafting.lvl >= 3 && (S.stock.shells >= 3 || !!S.items.journal),
    want: 'My shells and story boards deserve a proper place. A shelf!',
    done: 'Everything has its place now. It looks like someone lives here.',
    weight: () => 1.2 + (tr('curious') ? 0.8 : 0),

    tags: ['creative', 'comfort'],
  },
  rocker: {
    kind: 'craft', name: 'rocking chair', a: 'a rocking chair', cost: { wood: 4, fibre: 2 }, minutes: 110,
    unlocked: () => S.skills.crafting.lvl >= 4 && S.projects.lookout.done,
    want: 'A rocking chair up on the lookout… I could watch the sea for hours.',
    done: 'A rocking chair with the best view on the island.',
    weight: () => 1 + (tr('lazy') ? 1 : 0) + (tr('curious') ? 0.5 : 0),

    tags: ['comfort', 'sea'],
  },

  /* ---------- for the lodge's rooms ---------- */
  realbed: {
    kind: 'craft', name: 'real bed', a: 'a real bed', cost: { wood: 4, wool: 3 }, minutes: 120,
    unlocked: () => S.projects.lodge.done,
    want: 'A bedroom deserves a real bed. Wool mattress, wooden frame. Heaven.',
    done: 'A real bed in a real bedroom. I might cry.',
    weight: () => 3 + (tr('lazy') ? 1 : 0),

    tags: ['comfort'],
  },
  sofa: {
    kind: 'craft', name: 'sofa', a: 'a sofa', cost: { wood: 4, wool: 2 }, minutes: 110,
    unlocked: () => S.projects.lodge.done,
    want: 'The living room needs a sofa. Something soft to sink into on rainy days.',
    done: 'A sofa! I’m never getting up again.',
    weight: () => 2 + (tr('lazy') ? 1.5 : 0),

    tags: ['comfort'],
  },
  kitchen: {
    kind: 'craft', name: 'kitchen', a: 'a little kitchen', cost: { wood: 4, stone: 4 }, minutes: 120,
    unlocked: () => S.projects.lodge.done,
    want: 'A stone stove and a counter, and I could cook indoors, rain or shine.',
    done: 'My own kitchen! Time to get creative.',
    weight: () => 2.5,

    tags: ['comfort', 'practical'],
  },
  /* ---------- from her sheep's wool ---------- */
  blanket: {
    kind: 'craft', name: 'wool blanket', a: 'a wool blanket', cost: { wool: 3 }, minutes: 80,
    unlocked: () => S.stats.shorn >= 1,
    want: 'With that wool I could knit a blanket. Warm nights at last.',
    done: 'A wool blanket. Soft, warm, and it smells like sheep. Perfect.',
    weight: () => 2,

    tags: ['comfort', 'animals'],
  },
  sweater: {
    kind: 'craft', name: 'sweater', a: 'a wool sweater', cost: { wool: 2 }, minutes: 70,
    unlocked: () => S.stats.shorn >= 1 && S.stats.rainsSeen >= 2,
    want: 'A thick sweater would make the rainy days a lot less miserable.',
    done: 'A sweater! Lumpy, but mine.',
    weight: () => 1.5,

    tags: ['animals', 'creative'],
  },

  lanterns: {
    kind: 'craft', name: 'path lanterns', a: 'lanterns for her paths', cost: { wood: 3, fibre: 2 }, minutes: 60,
    // once her feet have worn real paths into the island
    unlocked: () => dayNum() >= 8 && Object.values(S.wear).filter(w => w > 0.5).length >= 12,
    want: 'Lanterns along my paths, so I can find my way home in the dark.',
    done: 'The lanterns are up. The island glows at night now.',
    weight: () => 1.3,
    tags: ['creative', 'comfort'],
  },

  /* ---------- fired in the kiln ---------- */
  pots: {
    kind: 'craft', name: 'clay pots', a: 'some clay pots', cost: { clay: 3 }, minutes: 70,
    unlocked: () => works('kiln'),
    want: 'Sealed clay pots would keep food fresh for much longer.',
    done: 'A row of clay pots. Nothing goes off in a hurry now.',
    weight: () => 2,
    tags: ['practical'],
  },
  jug: {
    kind: 'craft', name: 'water jug', a: 'a water jug', cost: { clay: 2 }, minutes: 50,
    unlocked: () => works('kiln'),
    want: 'A big water jug, so I don’t have to run to the pond every time I’m thirsty.',
    done: 'A water jug! Cool water, right here at camp.',
    weight: () => 1.8 + (tr('lazy') ? 1 : 0),
    tags: ['practical', 'comfort'],
  },
  tiles: {
    kind: 'craft', name: 'roof tiles', a: 'roof tiles', cost: { clay: 8 }, minutes: 140,
    unlocked: () => works('kiln') && (S.projects.lodge.done || S.projects.hut.done),
    want: 'If I fired clay tiles for the roof, the storms couldn’t tear it apart.',
    done: 'A tiled roof. Let the storms come.',
    weight: () => 1.3 + 0.2 * S.stats.repairs,
    tags: ['practical', 'comfort'],
  },

  /* ---------- projects ---------- */
  garden: {
    kind: 'build', name: 'garden', a: 'a garden', cost: { wood: 4 }, minutes: 150,
    unlocked: () => dayNum() >= 2,
    want: 'If I grew my own food, I wouldn’t depend on these bushes.',
    done: 'My own little garden! I saved a few berry seeds to start with.',
    weight: () => 2 + (tr('hardworking') ? 1 : 0),

    tags: ['green'],
  },
  rack: {
    kind: 'build', name: 'drying rack', a: 'a drying rack', cost: { wood: 3, fibre: 2 }, minutes: 90,
    unlocked: () => S.stats.fishCaught >= 2,
    want: 'If I could dry fish, a catch wouldn’t go bad when the fire is out.',
    done: 'A drying rack. No more wasted fish.',
    weight: () => 1.5,

    tags: ['sea', 'practical'],
  },
  dock: {
    kind: 'build', name: 'dock', a: 'a dock', cost: { wood: 8, stone: 4 }, minutes: 240,
    unlocked: () => S.stats.fishTrips >= 4 && dayNum() >= 3,
    want: 'A dock would get me out past the shallows, where the big fish are.',
    done: 'The dock is done! Look how far out I can go.',
    weight: () => 1 + (tr('curious') ? 1 : 0) + (tr('hardworking') ? 0.5 : 0),

    tags: ['sea'],
  },
  hut: {
    kind: 'build', name: 'stone walls', a: 'stone walls for her shelter', cost: { wood: 6, stone: 10 }, minutes: 200,
    unlocked: () => S.stats.rainsSeen >= 1 && dayNum() >= 2,
    want: 'Next time it rains, I want real walls around me. Stone ones.',
    done: 'Stone walls! It finally feels like a home.',
    weight: () => 1.5 + (tr('lazy') ? 1 : 0),

    tags: ['practical', 'comfort'],
  },
  hearth: {
    kind: 'build', name: 'stone hearth', a: 'a stone hearth', cost: { stone: 6 }, minutes: 90,
    unlocked: () => S.stats.meals >= 3,
    want: 'A proper stone hearth would keep the fire going longer on less wood.',
    done: 'A real hearth. The fire will last much longer now.',
    weight: () => 1.5 + (tr('hardworking') ? 0.5 : 0),

    tags: ['practical'],
  },
  lookout: {
    kind: 'build', name: 'lookout tower', a: 'a lookout tower', cost: { wood: 10, stone: 4 }, minutes: 240,
    unlocked: () => dayNum() >= 5,
    want: 'From up high I could see the whole sea… and the stars.',
    done: 'The lookout is finished! I can see forever from up there.',
    weight: () => tr('curious') ? 2.5 : 1,

    tags: ['adventure'],
  },
  fence: {
    kind: 'build', name: 'fence', a: 'a fence around her home', get cost() { return styledCost('fence'); }, minutes: 200,
    // not on day one: 10 logs that early starve her of everything else (an animal lover still gets there first)
    unlocked: () => dayNum() >= 4,
    want: 'If I fenced in the camp, I could keep those chickens and sheep.',
    done: 'The fence is up. Now to bring the animals home.',
    weight: () => 1.8 + (tr('hardworking') ? 0.5 : 0), // the animals wandering past her camp keep reminding her

    tags: ['animals'],
  },
  coop: {
    kind: 'build', name: 'chicken coop', a: 'a chicken coop', cost: { wood: 5, fibre: 2 }, minutes: 120,
    unlocked: () => S.projects.fence.done,
    want: 'A coop for the chickens, and I’d have eggs every morning.',
    done: 'The coop is ready. Here, chick-chick-chick!',
    weight: () => 2.5,

    tags: ['animals'],
  },
  trap: {
    kind: 'build', name: 'fish trap', a: 'a fish trap', cost: { wood: 3, fibre: 4 }, minutes: 120,
    unlocked: () => S.stats.fishTrips >= 3 && dayNum() >= 3,
    want: 'A woven trap in the shallows would catch fish while I do other things.',
    done: 'The trap is set. Let’s see what swims in.',
    weight: () => 1.2 + (tr('lazy') ? 1 : 0),
    tags: ['sea', 'practical'],
  },
  barrel: {
    kind: 'build', name: 'rain barrel', a: 'a rain barrel', cost: { wood: 4, fibre: 1 }, minutes: 90,
    unlocked: () => S.stats.rainsSeen >= 1 && dayNum() >= 3,
    want: 'All that rain, and I walk to the pond every time. A barrel would catch it.',
    done: 'A rain barrel! Now we wait for the clouds.',
    weight: () => 1.2 + (tr('lazy') ? 1 : 0),
    tags: ['practical', 'green'],
  },
  treehouse: {
    kind: 'build', name: 'treehouse', a: 'a treehouse', cost: { wood: 10, fibre: 4 }, minutes: 300,
    unlocked: () => dayNum() >= 6 && S.skills.building.lvl >= 1,
    want: 'That big tree near camp… I could build a house up in its branches.',
    done: 'A treehouse! I’m sleeping up here tonight.',
    weight: () => 1 + (tr('curious') ? 1 : 0),
    tags: ['adventure', 'creative'],
  },
  houseboat: {
    kind: 'build', name: 'houseboat', a: 'a houseboat', cost: { wood: 18, fibre: 6 }, minutes: 420,
    // a real builder's project: a raft with a cabin, moored at the dock
    unlocked: () => works('dock') && S.skills.building.lvl >= 4 && dayNum() >= 10,
    want: 'A raft with a little cabin, moored at the dock… I could sleep on the sea.',
    done: 'A houseboat! Rocked to sleep by the waves.',
    weight: () => 1.3 + (tr('curious') ? 0.7 : 0),
    tags: ['sea', 'adventure'],
  },
  orchard: {
    kind: 'build', name: 'orchard', a: 'an orchard', cost: { wood: 3, fibre: 2 }, minutes: 90,
    // stakes and ties for young fruit trees, just outside the fence; then she plants them one by one
    unlocked: () => dayNum() >= 6 && (S.projects.garden.done || S.taste.green > 0.6),
    want: 'I kept the pits from every fruit I found. Imagine an orchard: mangoes, bananas, lemons…',
    done: 'The orchard is laid out. Now to plant the trees and be patient.',
    weight: () => 1.5 + 1.5 * S.taste.green,
    tags: ['green'],
  },
  bandstand: {
    kind: 'build', name: 'bandstand', a: 'a bandstand', cost: { wood: 12, stone: 4, fibre: 2 }, minutes: 280,
    // somewhere proper to keep her instruments and to play them
    unlocked: () => dayNum() >= 8 && INSTRUMENTS.filter(k => S.items[k]).length >= 2,
    want: 'My instruments deserve a proper stage. A little bandstand, with a roof!',
    done: 'The bandstand is finished. Time for a concert, even if the audience is a seagull.',
    weight: () => 1.5 + (tr('musical') ? 2.5 : 0),
    tags: ['creative', 'comfort'],
  },
  shed: {
    kind: 'build', name: 'tool shed', a: 'a tool shed', cost: { wood: 6, stone: 2 }, minutes: 150,
    // once her tools are piling up around camp
    unlocked: () => dayNum() >= 5 && TOOLS.filter(k => S.items[k]).length >= 3,
    want: 'My tools are lying all over the camp. A shed with a proper tool wall, that’s what I need.',
    done: 'A tool shed! Everything has its place, and there’s room to stockpile.',
    weight: () => 1.6 + (tr('hardworking') ? 0.6 : 0),
    tags: ['practical'],
  },
  kiln: {
    kind: 'build', name: 'kiln', a: 'a kiln', cost: { stone: 6, clay: 4 }, minutes: 180,
    // there's clay at the pond's edge; once she notices, she can fire it
    unlocked: () => dayNum() >= 6 && S.skills.building.lvl >= 1,
    want: 'There’s good clay by the pond. With a kiln I could fire pots… maybe even tiles.',
    done: 'The kiln is done! Let’s see what this clay can do.',
    weight: () => 1.4,
    tags: ['creative', 'practical'],
  },
  oven: {
    kind: 'build', name: 'bread oven', a: 'a bread oven', cost: { stone: 4, clay: 6 }, minutes: 160,
    unlocked: () => works('kiln') && S.projects.garden.done,
    want: 'A clay oven… I could bake pies from the garden. Real baking!',
    done: 'An oven! Something’s going to smell amazing around here.',
    weight: () => 1.5,
    tags: ['comfort', 'green'],
  },
  /* ---------- rare: each island allows only a couple of these (S.rare) ---------- */
  beehive: {
    kind: 'build', name: 'beehive', a: 'a beehive', cost: { wood: 4, fibre: 2 }, minutes: 120,
    unlocked: () => S.rare.includes('beehive') && dayNum() >= 6,
    want: 'Wild bees keep buzzing around the garden. A hive, and I’d have honey!',
    done: 'The bees moved in! Honey, here I come.',
    weight: () => 1.6,
    tags: ['green', 'animals'],
  },
  sundial: {
    kind: 'build', name: 'sundial', a: 'a sundial', cost: { stone: 6 }, minutes: 90,
    unlocked: () => S.rare.includes('sundial') && dayNum() >= 7,
    want: 'I keep losing track of time. A sundial! I know how they work… roughly.',
    done: 'A sundial. It’s half past something. Probably.',
    weight: () => 1.2 + (tr('curious') ? 0.8 : 0),
    tags: ['creative', 'practical'],
  },
  mosaic: {
    kind: 'build', name: 'shell mosaic', a: 'a shell mosaic', cost: { shells: 8, stone: 4 }, minutes: 150,
    unlocked: () => S.rare.includes('mosaic') && S.stock.shells >= 3,
    want: 'All these shells… I could set them into a mosaic. A picture of the island.',
    done: 'The mosaic is finished. It’s the most beautiful thing on this island.',
    weight: () => 1.2 + (S.quirk === 'collector' ? 1.5 : 0),
    tags: ['creative'],
  },
  bathhouse: {
    kind: 'build', name: 'bathhouse', a: 'a bathhouse', cost: { stone: 8, wood: 6, clay: 4 }, minutes: 260,
    unlocked: () => S.rare.includes('bathhouse') && works('kiln'),
    want: 'A little bathhouse by the pond, with a fire under the water. Pure luxury.',
    done: 'A hot bath. On a desert island. I’m a genius.',
    weight: () => 1.4 + (tr('lazy') ? 0.6 : 0),
    tags: ['comfort'],
  },
  lodge: {
    kind: 'build', name: 'lodge', a: 'a lodge', cost: { wood: 16, stone: 12 }, minutes: 420,
    // usually after stone walls, but a skilled builder can go straight for the house
    unlocked: () => dayNum() >= 8 && (S.projects.hut.done ? S.skills.building.lvl >= 2 : S.skills.building.lvl >= 4),
    want: 'This shelter has served me well. But I want a real house: a bedroom, a living room, a kitchen.',
    done: 'A lodge! With rooms! I built a house with my own hands.',
    weight: () => 2 + (tr('hardworking') ? 1 : 0),

    tags: ['comfort', 'practical'],
  },
  canoe: {
    kind: 'build', name: 'canoe', a: 'a canoe', cost: { wood: 8, fibre: 4 }, minutes: 200,
    unlocked: () => S.projects.dock.done,
    want: 'With the dock done… I keep dreaming of a little canoe.',
    done: 'A canoe! Hollowed out by hand. Where shall we go?',
    weight: () => 2 + (tr('curious') ? 2 : 0),

    tags: ['sea', 'adventure'],
  },

  /* ---------- island growth (v1.4): the islet, the cave, water at camp ---------- */
  bridge: {
    kind: 'build', name: 'bridge', a: 'a bridge to the islet', get cost() { return styledCost('bridge'); }, minutes: 240,
    unlocked: () => S.isletFound && dayNum() >= 6,
    want: 'Wading out at low tide is fun, but a bridge would get me to that islet any time.',
    done: 'A bridge to my very own little island!',
    weight: () => 1.4 + 0.8 * S.taste.adventure + (S.style === 'bamboo' ? 0.8 : 0),
    tags: ['adventure'],
  },
  cave: {
    kind: 'build', name: 'cave entrance', a: 'a way into the cave', cost: { wood: 2 }, minutes: 150,
    unlocked: () => !!S.items.pick && dayNum() >= 5,
    want: 'There’s a cave in the hillside, choked with rubble. With my pick I could clear the way in.',
    done: 'The cave is open! Cool and dark inside, and the walls are full of flint.',
    weight: () => 1.2 + 0.8 * S.taste.adventure + 0.4 * S.taste.practical,
    tags: ['adventure', 'practical'],
  },
  pipe: {
    // water at camp, one way or the other: a bamboo pipe from the pond…
    kind: 'build', name: 'water pipe', a: 'a bamboo water pipe', cost: { bamboo: 6, fibre: 2 }, minutes: 180,
    unlocked: () => S.isletFound && !progressOf('well').started,
    want: 'If I ran bamboo pipes down from the pond, the water would come to me.',
    done: 'Water, pouring right into camp! I’m a genius.',
    weight: () => 1.2 + 0.8 * S.taste.green + (S.style === 'bamboo' ? 0.8 : 0) + (tr('lazy') ? 0.5 : 0),
    tags: ['green', 'practical'],
  },
  well: {
    // …or a stone well in camp
    kind: 'build', name: 'well', a: 'a well', cost: { stone: 12, wood: 3 }, minutes: 260,
    unlocked: () => !!S.items.pick && dayNum() >= 7 && !progressOf('pipe').started,
    want: 'If I dug a well right here in camp, I’d never have to walk to the pond again.',
    done: 'A well! Cold, clean water, right on my doorstep.',
    weight: () => 1.1 + 0.8 * S.taste.practical + (S.style === 'stone' ? 0.8 : 0) + (tr('lazy') ? 0.5 : 0),
    tags: ['practical'],
  },
  flinttools: {
    kind: 'craft', name: 'flint tools', a: 'flint tools', cost: { flint: 4, wood: 2, fibre: 2 }, minutes: 90,
    unlocked: () => !!S.items.axe && !!S.items.pick && S.projects.cave.done,
    want: 'Flint flakes sharper than any stone. New heads for my axe and pick!',
    done: 'Flint tools! They bite twice as deep.',
    weight: () => 2.2,
    tags: ['practical'],
  },
  rework: {
    // remake a piece (furniture at the fire, the fence or bridge on site) in her favourite
    // material, once it's at hand. Repeatable: it's never "done" (see checkFinished)
    get kind() { const k = reworkTarget(); return k && isProject(k) ? 'build' : 'craft'; },
    get name() { return reworkName(); },
    get a() { return `a new ${reworkName()}`; },
    get cost() { return reworkCost(); },
    get minutes() { const k = reworkTarget(); return k ? Math.round(PLANS[k].minutes * 0.6) : 60; },
    unlocked: () => S.style !== 'wood' && !!reworkTarget() && (S.style !== 'bamboo' || bambooAtHand(Math.ceil((STYLE_COST[reworkTarget()!]!.bamboo.bamboo ?? 0) * 0.75))),
    get want() { const k = reworkTarget(); return k ? `I like my ${PLANS[k].name}, but it’d be so much nicer in ${S.style}.` : ''; },
    get done() { return `There. Made over in ${S.style}, the way I always wanted.`; },
    // (more appealing the more of her things aren't in the material she loves)
    weight: () => 1.4 + 0.5 * S.taste.creative + 0.7 * STYLED.filter(k => isMade(k) && intendedStyle(k) === S.style && (S.madeStyle[k] ?? 'wood') !== S.style).length + (tr('lazy') ? -0.3 : 0),
    tags: ['creative', 'comfort'],
  },
  /* ---------- v1.5: food that keeps, a workshop, and metal ---------- */
  saltpans: {
    kind: 'build', name: 'salt pans', a: 'salt pans', cost: { stone: 6, wood: 1 }, minutes: 140,
    unlocked: () => dayNum() >= 6 && (S.stats.fishCaught >= 3 || S.stats.hunted >= 1),
    want: 'If I let seawater dry in shallow pans, I’d have salt. Salted fish keeps for ages.',
    done: 'Salt pans! Now the sun does the work.',
    weight: () => 1.2 + 0.5 * S.taste.practical + 0.5 * S.taste.sea,
    tags: ['practical', 'sea'],
  },
  firecover: {
    kind: 'build', name: 'fire hood', a: 'a roof over the fire', get cost() { return styledCost('firecover'); }, minutes: 120,
    unlocked: () => S.stats.rainsSeen >= 3 && dayNum() >= 5,
    want: 'Every time it rains, my fire drowns. A little roof over it, that’s what I need.',
    done: 'Let it rain! My fire stays dry now.',
    weight: () => 1.4 + 0.5 * S.taste.comfort + 0.4 * S.taste.practical,
    tags: ['comfort', 'practical'],
  },
  smokehouse: {
    kind: 'build', name: 'smokehouse', a: 'a smokehouse', cost: { wood: 6, stone: 3 }, minutes: 180,
    unlocked: () => S.projects.rack.done && S.stats.fishCaught >= 6,
    want: 'Smoked fish is better than dried, and it keeps all winter. A smokehouse!',
    done: 'The smokehouse is done. It already smells amazing.',
    weight: () => 1.1 + 0.6 * S.taste.sea + 0.3 * S.taste.practical,
    tags: ['sea', 'practical'],
  },
  workshop: {
    kind: 'build', name: 'workshop', a: 'a workshop', cost: { wood: 8, stone: 2, fibre: 2 }, minutes: 220,
    unlocked: () => S.skills.crafting.lvl >= 3 && S.stats.crafted >= 5,
    want: 'Crafting on my knees by the fire… I want a proper workbench, with a roof over it.',
    done: 'My own workshop! Everything within reach.',
    weight: () => 1.3 + 0.6 * S.taste.creative + 0.4 * S.taste.practical + (tr('hardworking') ? 0.4 : 0),
    tags: ['creative', 'practical'],
  },
  furnace: {
    kind: 'build', name: 'furnace', a: 'a furnace', cost: { stone: 10, clay: 4 }, minutes: 240,
    unlocked: () => works('kiln') && dayNum() >= 18 && !!S.items.pick,
    want: 'There’s rock on the ridge streaked with red. Iron! With a hot enough furnace…',
    done: 'The furnace roars. Now, let’s see if I can make iron.',
    weight: () => 1.0 + 0.8 * S.taste.practical,
    tags: ['practical'],
  },
  irontools: {
    kind: 'craft', name: 'iron tools', a: 'iron tools', cost: { iron: 3, wood: 2 }, minutes: 120,
    unlocked: () => S.projects.furnace.done && !!S.items.axe && !!S.items.pick,
    want: 'Iron heads for my axe and pick. Real tools, made from my own island.',
    done: 'Iron tools! Nothing on this island can stand up to them.',
    weight: () => 2.4,
    tags: ['practical'],
  },
  chimes: {
    kind: 'craft', name: 'wind chimes', a: 'wind chimes', cost: { bamboo: 3, fibre: 1, shells: 1 }, minutes: 50,
    unlocked: () => S.isletFound && S.skills.crafting.lvl >= 2 && S.stock.shells >= 1,
    want: 'Bamboo tubes and a shell, hung where the wind can find them… wind chimes!',
    done: 'Listen to that. The wind’s playing music.',
    weight: () => 0.8 + 0.8 * S.taste.creative + (S.style === 'bamboo' ? 0.6 : 0),
    tags: ['creative', 'comfort'],
  },
};

// (by whether it has a project slot: 'rework' can be built on site, but its progress lives with the crafts)
const isProject = (k: PlanKey): k is ProjectKey => k in S.projects;
export const isDone = (k: PlanKey) => isProject(k) ? S.projects[k].done : !!S.items[k as CraftKey];
const progressOf = (k: PlanKey) => isProject(k) ? S.projects[k] : S.crafting;

/** How much she wants a plan: its own appeal, tilted by her taste, and a lot more if it's her dream. */
export const desire = (k: PlanKey) => PLANS[k].weight() * tasteFor(PLANS[k].tags) * (S.dream === k ? 3 : 1) * quirkFor(k);
/** Quirks nudge a few plans: a seasick castaway shies away from boats, a collector wants a shelf. */
function quirkFor(k: PlanKey) {
  if (S.quirk === 'seasick' && (k === 'canoe' || k === 'houseboat')) return 0.25;
  if (S.quirk === 'collector' && k === 'shelf') return 2.5;
  return 1;
}

const GIVE_UP_DAYS = 4;
const GIVE_UP_LINES = ['This is too much for now. Maybe later.', 'I keep putting this off. Something else, then.', 'Who was I kidding? Not this one. Not yet.'];
/**
 * At dawn: a goal she hasn't even started after a few days may get dropped
 * (more often by an easy-going castaway, less by a hard worker or if it's her dream).
 */
export function maybeGiveUp() {
  const k = S.goal;
  if (!k || progressOf(k).started || S.min - S.goalSince < 3 * 1440) return;
  const chance = 0.4 + (tr('lazy') ? 0.2 : 0) - (tr('hardworking') ? 0.2 : 0) - (S.dream === k ? 0.3 : 0);
  if (Math.random() > chance) return;
  S.goal = null;
  S.reworkOf = null;
  S.gaveUp[k] = dayNum();
  say(GIVE_UP_LINES[Math.floor(Math.random() * GIVE_UP_LINES.length)]);
  log(`She gave up on ${PLANS[k].a}, for now.`);
  highlight(`gave up on ${PLANS[k].a}`);
}

/** Maybe pick something to make. Returns true if she set a new goal. */
export function chooseGoal() {
  if (S.goal) return false;
  // (something she gave up on doesn't appeal again for a few days)
  const cand = (Object.keys(PLANS) as PlanKey[]).filter(k => !isDone(k) && PLANS[k].unlocked() && dayNum() - (S.gaveUp[k] ?? -99) >= GIVE_UP_DAYS);
  if (!cand.length) return false;
  const tot = cand.reduce((s, k) => s + desire(k), 0);
  let r = Math.random() * tot, k = cand[0];
  for (const c of cand) { r -= desire(c); if (r <= 0) { k = c; break; } }
  S.goal = k;
  S.goalSince = S.min;
  S.reworkOf = k === 'rework' ? reworkTarget() : null; // (fixed now, so the cost and site stay put)
  S.crafting = { started: false, progress: 0 };
  say(PLANS[k].want);
  log(`She decided to ${PLANS[k].kind === 'craft' ? 'make' : 'build'} ${PLANS[k].a}.`);
  return true;
}

export const INSTRUMENTS = ['drum', 'flute', 'ukulele', 'marimba'] as const;
const TOOLS: CraftKey[] = ['axe', 'pick', 'rod', 'spear', 'bucket', 'basket', 'snare'];
/** How much of a material she can keep: a tool shed gives room for half as much again. */
export function storageCap(r: 'wood' | 'stone' | 'fibre' | 'clay' | 'bamboo' | 'flint' | 'salt' | 'ore' | 'iron') {
  return (r === 'stone' ? 30 : r === 'flint' || r === 'salt' ? 12 : r === 'ore' ? 10 : r === 'iron' ? 6 : 20) * (works('shed') ? 1.5 : 1);
}

// Logs she always keeps back for the campfire; projects can't use these.
export const FIREWOOD_RESERVE = 2;

/** How much of each resource she still has to gather before she can start her goal. */
export function missing(): Record<Resource, number> {
  const out = { wood: 0, stone: 0, fibre: 0, wool: 0, clay: 0, shells: 0, bamboo: 0, flint: 0, salt: 0, ore: 0, iron: 0 }, k = S.goal;
  if (!k || progressOf(k).started) return out;
  for (const r of Object.keys(out) as Resource[]) {
    const cost = PLANS[k].cost[r] ?? 0;
    out[r] = cost ? Math.max(0, cost + (r === 'wood' ? FIREWOOD_RESERVE : 0) - S.stock[r]) : 0;
  }
  return out;
}
export const canWork = () => !!S.goal && Object.values(missing()).every(v => v === 0);

// (a knife that washed ashore with her makes all crafting quicker)
// (and flint tools make everything a little quicker)
const workSpeed = (k: PlanKey) => (1 + 0.08 * S.skills[PLANS[k].kind === 'craft' ? 'crafting' : 'building'].lvl) * (S.washedUp === 'knife' && PLANS[k].kind === 'craft' ? 1.2 : 1) * (S.items.irontools ? 1.3 : S.items.flinttools ? 1.15 : 1)
  * (PLANS[k].kind === 'craft' && works('workshop') ? 1.2 : 1); // (and a proper workbench)
/** How much quicker chopping and breaking stone go with flint (and later iron) tools. */
export const toolSpeed = () => S.items.irontools ? 1.7 : S.items.flinttools ? 1.35 : 1;
/** Game minutes of work left on the current goal (faster with skill). */
export function minutesLeft() {
  const k = S.goal!;
  return (1 - progressOf(k).progress) * PLANS[k].minutes / workSpeed(k);
}

/** Use up the resources when work begins. */
export function startPlan(k: PlanKey) {
  const p = progressOf(k);
  if (p.started) return;
  if (STYLED.includes(k)) S.madeStyle[k] = styleFor(k); // (decided now, so the cost and the look stay put)
  p.started = true;
  for (const [r, n] of Object.entries(PLANS[k].cost) as [Resource, number][]) S.stock[r] -= n;
  if (isProject(k)) log(`She started building the ${PLANS[k].name}.`);
}

export function workOn(k: PlanKey, dm: number) {
  const p = progressOf(k);
  p.progress = Math.min(1, p.progress + dm / PLANS[k].minutes * workSpeed(k));
  // crafting levels up faster than building: furniture depends on it
  addXp(PLANS[k].kind === 'craft' ? 'crafting' : 'building', dm * (PLANS[k].kind === 'craft' ? 30 : 10) / 60);
}

/** Called when a work session ends; finishes the plan if it's complete. */
/** The made-over piece now shows (and counts as) her favourite material. */
function finishRework() {
  const k = S.reworkOf ?? reworkTarget();
  S.goal = null; S.reworkOf = null;
  S.crafting = { started: false, progress: 0 };
  if (!k) return;
  S.madeStyle[k] = S.style;
  S.stats.reworks = (S.stats.reworks ?? 0) + 1;
  if (isProject(k)) S.projects[k].builtAt = S.min; // (fresh, unweathered)
  addXp(isProject(k) ? 'building' : 'crafting', 15);
  S.mood = Math.min(40, S.mood + 15);
  say(PLANS.rework.done);
  log(`She remade her ${PLANS[k].name} in ${S.style}.`);
  highlight(`remade her ${PLANS[k].name} in ${S.style}`);
}

export function checkFinished(k: PlanKey) {
  const p = progressOf(k), def = PLANS[k];
  if (def.kind === 'build') highlight(`worked on the ${def.name}`);
  if (p.progress < 0.999) return;
  if (k === 'rework') { finishRework(); return; }
  if (isProject(k)) { S.projects[k].done = true; S.projects[k].progress = 1; S.projects[k].builtAt = S.min; }
  else {
    S.items[k as CraftKey] = true;
    S.stats.crafted++;
    addXp('crafting', 20);
    S.curious.push(k as CraftKey); // she'll want to try it out
  }
  S.goal = null;
  S.madeAt[k] ??= dayNum();
  growTaste(def.tags); // making what she loves makes her love it more
  if (k === 'garden') S.stock.seeds += 3;
  if (S.dream === k) {
    S.dream = null;
    S.mood = 40;
    log(`Her dream came true: ${def.a}.`, 'big');
    highlight('made her dream come true');
  }
  S.mood = Math.min(40, S.mood + 20);
  say(def.done);
  log(def.kind === 'craft' ? `She made ${def.a}.` : `She finished the ${def.name}.`, 'big');
  highlight(def.kind === 'craft' ? `made ${def.a}` : `finished the ${def.name}`);
  remember(def.kind === 'craft' ? 'craft' : 'build', 0.2);
  if (S.task) S.task.celebrate = true;
}

/* ---------- storm damage ---------- */
// What the storm can damage, and what fixing it costs.
export const REPAIRABLE: Partial<Record<ProjectKey, Partial<Record<Resource, number>>>> = {
  rack: { wood: 1 }, dock: { wood: 3 }, hut: { wood: 1, stone: 2 }, lookout: { wood: 2 }, bandstand: { wood: 2 }, lodge: { wood: 2, stone: 1 },
  trap: { wood: 2 }, treehouse: { wood: 2 }, houseboat: { wood: 3 }, shed: { wood: 1 },
};
/** A finished project that isn't storm-damaged right now. */
export const works = (k: ProjectKey) => S.projects[k].done && !S.projects[k].damaged;
export const damaged = () => (Object.keys(REPAIRABLE) as ProjectKey[]).filter(k => S.projects[k].damaged);

/* ---------- home comfort: how much the camp feels like a home ---------- */
const COMFORT_ITEMS: CraftKey[] = ['flute', 'ukulele', 'marimba', 'jug', 'chair', 'table', 'bed', 'shelf', 'rocker', 'hammock', 'drum', 'realbed', 'sofa', 'kitchen', 'blanket'];
/** 0…25: furniture and comforts she has made, plus a sound roof (or a whole lodge) and hearth. */
export function comfort() {
  return COMFORT_ITEMS.filter(k => S.items[k]).length + (works('lodge') ? 4 : works('hut') ? 2 : 0) + (works('treehouse') ? 2 : 0) + (works('houseboat') ? 2 : 0)
    + (['sundial', 'mosaic', 'bathhouse', 'oven', 'bandstand'] as ProjectKey[]).filter(works).length + (S.projects.hearth.done ? 1 : 0);
}
/** Somewhere dry and solid to sleep and shelter: the lodge, or the shelter with stone walls. */
export const indoors = () => works('lodge') || works('hut');

/* ---------- walking surface: terrain, or the dock deck once it exists ---------- */
const along = (p: Pt) => p.x * DOCK.dir.x + p.z * DOCK.dir.z;
const across = (p: Pt) => Math.abs(-p.x * DOCK.dir.z + p.z * DOCK.dir.x);
export function onDock(p: Pt) {
  if (!S.projects.dock.done) return false; // (a storm-damaged dock is still walkable, just not usable)
  const a = along(p);
  return a >= DOCK.from - 0.05 && a <= DOCK.to && across(p) <= DOCK.halfWidth;
}
export function surfaceY(x: number, z: number) {
  const p = { x, y: 0, z };
  if (onDock(p)) return DOCK.deckY;
  // on her bridge to the islet (the deck, or a stone causeway at the same height)
  if (S.projects.bridge?.done && onBridgeLine(x, z)) return Math.max(height(x, z), BRIDGE_Y);
  return height(x, z);
}
