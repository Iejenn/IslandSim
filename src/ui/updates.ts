// "What's new" on the start menu: newest first, each with its version.
// Every update that ships adds an entry at the top with the next version
// (minor bump for content, patch bump for small fixes); VERSION follows it.
export const UPDATES: { version: string; title: string; text: string }[] = [
  { version: '1.8.1', title: 'Dog fixes', text: 'The dog no longer stands in the fire, and when she fishes from the dock it lies down on the planks behind her instead of in the water.' },
  { version: '1.8', title: 'Animal lovers', text: 'A barn, a duck house and a dovecote, milking her ewes and making cheese, a new Animal care skill (master it to become a friend of all creatures), a photo mode under the gear, and pausing now freezes the animals too.' },
  { version: '1.7', title: 'Animal friends', text: 'She names her hens and sheep (one hen becomes her shadow), ducks raise ducklings on the pond, a wild parrot can be won over and learns her words, her dog fetches sticks from the sea and brings her little gifts, and the sea gives up new kinds of fish.' },
  { version: '1.6', title: 'Life & mastery', text: 'She wakes up in a mood that colours her day, catches the odd cold (herbal tea from the garden helps), celebrates her birthday and her years on the island, becomes known for what she does best (a master carver, an island angler, a green thumb…), and decorates her camp with things that suit her.' },
  { version: '1.5.1', title: 'Cave fix', text: 'The hill now rises into a rocky shoulder around the cave, so its mouth is cut into the slope instead of standing out from it.' },
  { version: '1.5', title: 'Salt, smoke & iron', text: 'Salt pans on the rocky shore, a roof over the fire against the rain, a smokehouse for fish that keeps all winter, a workshop with a workbench, and late in the game a furnace to turn red ore into iron tools. (And she no longer sleeps in the open hammock in the rain.)' },
  { version: '1.4.1', title: 'Sandbar & surf fixes', text: 'The sandbar now rises out of the water from both ends as the tide goes out, with the same surf as the beaches, and the surf fades into rain, fog and the dark like everything else.' },
  { version: '1.4', title: 'Island growth', text: 'A bamboo islet across a sandbar (bridge it in bamboo, wood or stone), a cave with flint for sharper tools, water piped or drawn from a well in camp, wind chimes, and furniture and fences in each castaway’s favourite material (she remakes older pieces in it later).' },
  { version: '1.3.1', title: 'Surf fix', text: 'The surf now follows the water’s edge, the swell is calmer near the beach, and her speech bubble stays on screen.' },
  { version: '1.3', title: 'Weather, tides & a real dog', text: 'Clouds gather before rain, red skies before storms, tides with tide pools and footprints, golden light, new sounds, and a dog with a life of its own.' },
  { version: '1.2', title: 'Sunrise & sunset', text: 'The sun rises and sets in a warm glow, and the moon follows the real cycle, with a silver path on the sea at full moon.' },
  { version: '1.1', title: 'Settings gear', text: 'Sound and the menu now live under a gear in the top-right corner.' },
  { version: '1.0', title: 'Start menu & save slots', text: 'Keep up to three islands, and move one to another device with a save file or code.' },
  { version: '0.9', title: 'Orchard & night sky', text: 'Corn, pumpkins and flowers in the garden, fruit trees to plant, moon phases, shooting stars and glowing waves.' },
  { version: '0.8', title: 'More alive', text: 'Everyday gestures, dancing, wildlife around her and “Her story”, told in chapters.' },
  { version: '0.7', title: 'Music', text: 'A flute, ukulele and marimba join the drum, with a bandstand to play them on.' },
  { version: '0.6', title: 'Hill & waterfall', text: 'A bigger pond under a waterfall, and a dog that walks around things.' },
  { version: '0.5', title: 'Tool shed', text: 'Her tools hang on the wall of their own little shed.' },
];
/** The version that's live: the newest entry above. */
export const VERSION = UPDATES[0].version;
