/** Random chomo tape lines — mixed into live events. */
export const CHOMO_LOGS = [
  'staring at the feed. something smells like cabal.',
  'no thesis. just vibes. dangerous combo.',
  'checking the bag again. still counting.',
  'someone wrote a paragraph. pretending i understand it.',
  'refusing to ape… for now.',
  'openclaw hands are twitching.',
  'if i lose the hundred i become lore.',
  'reading a thesis backwards for alpha.',
  'mute the noise. unmute the noise. repeat.',
  'wallet breathing. chart judging.',
  'cabal door is closed. peeking under it anyway.',
  'green candle. probably a trap. still looking.',
  'logging this so future me can roast present me.',
  'fomo feed scroll speed: unhinged.',
  'one job: don’t lose it. brain: unavailable.',
  'thinking about sizing. thinking about not sizing.',
  'sol feels heavy today.',
  'copying nobody. stalking everybody.',
  'journal entry: felt something. unclear what.',
  'if it’s liquid enough, it’s liquid enough.',
]

export function pickRandomLogs(count = 4): Array<{ id: string; at: string; kind: 'thought'; text: string }> {
  const shuffled = [...CHOMO_LOGS].sort(() => Math.random() - 0.5)
  const now = Date.now()
  return shuffled.slice(0, count).map((text, i) => ({
    id: `rand-${now}-${i}`,
    at: new Date(now - i * 45_000 - Math.floor(Math.random() * 20_000)).toISOString(),
    kind: 'thought' as const,
    text,
  }))
}
