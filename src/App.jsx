import { useState } from "react";

const TABS = [
  "Input Details",
  "Your Score",
  "FIRE & SIP",
  "SWOT & Actions",
];

function App() {
  const [activeTab, setActiveTab] = useState("Input Details");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xs font-semibold text-emerald-300">
            FH
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">
              Findependence – Build Wealth. Retire Earlier.
            </div>
            <div className="text-[11px] text-slate-400">
              Your personal finance cockpit!
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 mr-1" />
          Live simulator · Updates as you fill details
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Left side: tabs + content */}
        <section className="flex-1 px-4 md:px-8 py-6 space-y-4">
          {/* Tabs */}
          <nav className="inline-flex rounded-full bg-slate-900/80 border border-slate-800 p-1 text-xs mb-4">
            {TABS.map((tab) => {
              const selected = tab === activeTab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={
                    "px-4 py-1.5 rounded-full transition-colors " +
                    (selected
                      ? "bg-emerald-500 text-slate-950 font-semibold shadow-sm"
                      : "text-slate-300 hover:bg-slate-800")
                  }
                >
                  {tab}
                </button>
              );
            })}
          </nav>

          {/* Tab content – placeholders for now */}
          {activeTab === "Input Details" && <InputDetailsPlaceholder />}
          {activeTab === "Your Score" && <ScorePlaceholder />}
          {activeTab === "FIRE & SIP" && <FirePlaceholder />}
          {activeTab === "SWOT & Actions" && <SwotPlaceholder />}
        </section>

        {/* Right side: future live score / portfolio panel */}
        <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/90 px-4 py-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="text-xs font-semibold text-slate-300 mb-1">
              Live FinHealth Score
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              This panel will show your real-time FinHealth score, savings
              rate and how your score has changed since you started.
            </p>
            <div className="h-24 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
              Later: score gauge + progress chart.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="text-xs font-semibold text-slate-300 mb-1">
              Portfolio snapshot
            </div>
            <p className="text-[11px] text-slate-400">
              We&apos;ll summarise your asset allocation (MFs, stocks, gold,
              bonds, others) and show gaps vs recommended ranges.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Card({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function InputDetailsPlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Input Details</h1>
      <p className="text-sm text-slate-400 max-w-xl">
        We&apos;ll capture your income, expenses, EMIs, insurance, investments
        and assets. Based on this, we&apos;ll compute a FinHealth score,
        FIRE number and an action plan.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Income (fixed & variable)"
          description="You + spouse + other family members. We&apos;ll split fixed pay, incentives and variable sources."
        >
          <div className="h-24 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: full income form with quick amount buttons.
          </div>
        </Card>

        <Card
          title="Expenses (needs & wants)"
          description="Fixed essentials (rent, fees, groceries) vs variable lifestyle spends (shopping, travel, food delivery, OTT)."
        >
          <div className="h-24 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: fixed / variable expense inputs + savings meter.
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="EMIs & loans"
          description="Home loan, car loan, personal loans, credit card EMIs with outstanding amount and tenure."
        >
          <div className="h-16 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: EMI list with total EMI / income ratio.
          </div>
        </Card>

        <Card
          title="Financial protection"
          description="Emergency fund, health insurance, term insurance. We&apos;ll benchmark vs Indian thumb rules."
        >
          <div className="h-16 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: protection adequacy checks.
          </div>
        </Card>

        <Card
          title="Investments & assets"
          description="MFs, stocks, bonds, gold, other assets + cars/bikes (with depreciation) and home/land."
        >
          <div className="h-16 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: portfolio breakdown + suggestions.
          </div>
        </Card>
      </div>
    </div>
  );
}

function ScorePlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Your FinHealth Score</h1>
      <p className="text-sm text-slate-400 max-w-xl">
        This section will show a score out of 100, explain why it&apos;s low
        or high (savings, EMIs, insurance, emergency fund), and give concrete
        actions to improve based on Indian benchmarks.
      </p>

      <Card title="Score, savings meter & explanations">
        <div className="h-32 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
          Next step: gauge, savings meter and detailed breakdown.
        </div>
      </Card>
    </div>
  );
}

function FirePlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">FIRE & SIP Planning</h1>
      <p className="text-sm text-slate-400 max-w-xl">
        Here we&apos;ll calculate your FIRE number (Lean / Normal / Fat),
        target corpus and suggested SIP / lumpsum amounts assuming long-term
        equity returns in Indian markets.
      </p>

      <Card title="FIRE number & SIP ideas">
        <div className="h-32 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
          Next step: FIRE cards + SIP calculator + lumpsum illustration.
        </div>
      </Card>
    </div>
  );
}

function SwotPlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">SWOT & Action Plan</h1>
      <p className="text-sm text-slate-400 max-w-xl">
        This board will summarise Strengths, Weaknesses, Opportunities and
        Threats across your protection, debt, savings and investments, with a
        short-list of next actions.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Strengths" description="What you are already doing well.">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: auto-generated strengths from your data.
          </div>
        </Card>
        <Card title="Weaknesses" description="Key gaps to fix.">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: weaknesses like low EF, high EMIs, low cover.
          </div>
        </Card>
        <Card title="Opportunities" description="Where you can grow faster.">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: suggestions on SIPs, better allocation, tax-efficiency.
          </div>
        </Card>
        <Card title="Threats" description="Risks you should guard against.">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-[11px] text-slate-500">
            Next step: threats like job loss + heavy EMIs, underinsurance.
          </div>
        </Card>
      </div>
    </div>
  );
}

export default App;