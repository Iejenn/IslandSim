// What she thinks out loud. Pure text selection; the bubble/panel display it.
import { S, type NeedKey } from './state';
import { pick } from './util';

export const TH = {
  forage: ['These berries are sour, but they’re food.', 'Note to self: the dark ones taste better.', 'Berries again. I’d kill for a pizza.'],
  fish: ['Come on, fishy fishy…', 'Patience. The sea gives when it wants to.', 'The water is so clear here.'],
  drink: ['Thank goodness for this spring.', 'Cold, clean water. Small luxuries.'],
  wood: ['The fire won’t feed itself.', 'More wood before dark.', 'My hands are full of splinters.'],
  sleep: ['Listening to the waves… so tired.', 'Tomorrow will be better.', 'Goodnight, island.'],
  nap: ['Just a short nap…', 'Five more minutes.'],
  relax: ['The fire makes this place feel like home.', 'I could watch these flames for hours.'],
  explore: ['What’s around that bend?', 'Maybe something washed up on the beach.', 'Footprints in the sand. Only mine.'],
  talk: ['Talking to the seagulls again. They’re good listeners.', 'I wrote my name in the sand. Hello, world.', 'Is anyone out there?'],
  chop: ['Swing, chop, swing, chop.', 'Timber!', 'My arms are going to feel this tomorrow.'],
  sticks: ['Every stick counts.', 'The forest floor is full of firewood.', 'No axe, no problem. Mostly.'],
  replant: ['One tree out, one tree in.', 'Grow tall, little one.', 'Somebody has to look after this forest.'],
  fibre: ['These vines make good string.', 'Pull, twist, pull, twist.'],
  stones: ['Good flat ones, these.', 'Rocks. The one thing this island has plenty of.'],
  mine: ['Crack!', 'Stone by stone.', 'This boulder is tougher than me. Almost.'],
  craft: ['Measure, cut, tie.', 'I’m getting good with my hands.', 'Nobody taught me this. I’m figuring it out.'],
  cook: ['Smells amazing.', 'Grilled fish, island style.', 'Careful… don’t burn it.'],
  write: ['Chapter seven: the storm.', 'One day someone will read these.', 'Carving words takes patience.'],
  watch: ['Nothing but blue, all the way round.', 'I can see the whole island from here.', 'Keep watching. Something might come.'],
  build: ['Measure twice, cut once. Or just cut.', 'It’s actually starting to look like something.', 'Nobody taught me this. I’m figuring it out.'],
  plant: ['Grow, little ones.', 'A seed is just a promise.', 'Dirt under my nails again. Good dirt.'],
  water: ['Drink up, plants.', 'Back and forth to the spring. Worth it.'],
  harvest: ['Food I grew myself!', 'Look at these. I did that.'],
  eat: ['Dried fish. Chewy, but it’s dinner.', 'Glad I saved this one.'],
  shelter: ['I’ll wait it out under the roof.', 'Listening to the rain on the leaves.', 'At least the spring will be full.'],
  sail: ['The island looks so small from out here.', 'Wind in my hair. I needed this.', 'I wonder what’s beyond the horizon.'],
  stargaze: ['So many stars. More than at home.', 'Is that a planet? I think that’s a planet.', 'Somewhere out there, someone is looking up too.'],
};

const LOW: Record<NeedKey, string> = {
  food: 'My stomach won’t stop growling.',
  water: 'So thirsty… I need water.',
  energy: 'I can barely keep my eyes open.',
  fun: 'Every day feels the same.',
  company: 'I miss voices. Any voice.',
};

/** A thought for this activity, unless the related need is low enough to complain about. */
export function thoughtFor(id: keyof typeof TH, need?: NeedKey) {
  return need && S.needs[need] < 25 ? LOW[need] : pick(TH[id]);
}
