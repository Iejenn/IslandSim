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
  read: ['One more chapter.', 'These pages take me far away from here.'],
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

export function pianoThought() {
  const l = S.skills.music.lvl;
  return l < 2 ? pick(['These keys don’t listen to me yet.', 'Is that… a scale? Sort of.'])
    : l < 5 ? pick(['I can almost play a whole tune.', 'Left hand, right hand, together…'])
    : l < 8 ? pick(['My fingers remember the melody now.', 'This one is for the waves.'])
    : pick(['The ocean is my audience.', 'I’ve never played this well in my life.']);
}
