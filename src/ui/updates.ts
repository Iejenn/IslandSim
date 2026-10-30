// "What's new" on the start menu: newest first, each with its version.
// Every update that ships adds an entry at the top with the next version
// (minor bump for content, patch bump for small fixes); VERSION follows it.
export const UPDATES: { version: string; title: string; text: string }[] = [
  { version: '1.4.1', title: 'Sandbar & surf fixes', text: 'The sandbar rises smoothly out of the water with its own surf along both sides, and the surf now fades into rain, fog and the dark like everything else.' },
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
