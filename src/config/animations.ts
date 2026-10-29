// Maps what the sim asks for ("walk", "sit down") to clip names inside
// Casual_Female.gltf. Swapping the model only means editing this file.
export const ANIM = {
  idle: 'Idle',
  walk: 'Walk',
  walkCarry: 'Walk_Carry',
  run: 'Run', // hurrying when a need is critical
  chop: 'SwordSlash', // the sword swing reads as an axe swing
  hammer: 'Punch', // short repeated strikes read as hammering
  sitDown: 'SitDown',
  standUp: 'StandUp',
  gather: 'PickUp',
  celebrate: 'Victory',
  death: 'Death',
} as const;

export type AnimKey = keyof typeof ANIM;

// Clips that play once and hold their last frame instead of looping.
// (The typo "RecieveHit" is the clip's real name in the model.)
export const ONE_SHOT_CLIPS = new Set<string>(['SitDown', 'StandUp', 'Victory', 'Defeat', 'Death', 'RecieveHit']);

// How long the sim waits (in real seconds) for a one-shot clip before moving on.
export const ONE_SHOT_SECONDS = {
  standUp: 1.25,
  celebrate: 1.9,
} as const;
