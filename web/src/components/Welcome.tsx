const SUGGESTIONS = [
  "What's our overall win rate?",
  "Win rate by profile",
  "Show the conversion funnel and biggest leak",
  "How many leads are open right now?",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Empty-state greeting + suggestion chips shown before a conversation starts. */
export function Welcome({ name, onPick }: { name: string; onPick: (q: string) => void }) {
  return (
    <div className="pt-[12vh] pb-1">
      <h1 className="mb-2 text-[26px] font-semibold tracking-tight">
        {greeting()}, {name}
      </h1>
      <p className="mb-6 text-[14.5px] text-fg3">
        Ask anything about the BD Leads pipeline — win rate, the conversion funnel, connects economics, sales
        velocity, forecast, or individual leads.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-left text-[13px] leading-tight text-fg2 hover:border-border2 hover:bg-hover hover:text-fg"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
