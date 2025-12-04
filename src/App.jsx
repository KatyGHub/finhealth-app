import { useState, useRef } from "react";

const TABS = [
  "Input Details",
  "Your Score",
  "FIRE & SIP",
  "SWOT & Actions",
];

function App() {
  const [activeTab, setActiveTab] = useState("Input Details");

  const [data, setData] = useState({
    age: 30,
    dependents: 0,
    employmentType: "",
    cityTier: "metro",

    incomeSelf: 0,
    incomeSpouse: 0,
    incomeOther: 0,
    incomeVariable: 0,

    // Fixed expenses (needs)
    fixedRent: 0,
    fixedFood: 0,
    fixedUtilities: 0,
    fixedMedical: 0,

    // Variable expenses (wants)
    varWifi: 0,
    varEntertainment: 0,
    varShopping: 0,
    varMisc: 0,

    totalEmi: 0,
    loanOutstanding: 0,

    emergencyFund: 0,
    healthCover: 0,
    lifeCover: 0,

    invBonds: 0,
    invMF: 0,
    invStocks: 0,
    invGold: 0,
    invOthers: 0,
  });

  function update(partial) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  const totalIncome =
    data.incomeSelf +
    data.incomeSpouse +
    data.incomeOther +
    data.incomeVariable;

  const fixedTotal =
    data.fixedRent +
    data.fixedFood +
    data.fixedUtilities +
    data.fixedMedical;

  const variableTotal =
    data.varWifi +
    data.varEntertainment +
    data.varShopping +
    data.varMisc;

  const totalExpenses = fixedTotal + variableTotal;
  const monthlySavings = Math.max(totalIncome - totalExpenses, 0);
  const savingsRate = totalIncome > 0 ? monthlySavings / totalIncome : 0;

  const totalInvestments =
    data.invBonds +
    data.invMF +
    data.invStocks +
    data.invGold +
    data.invOthers;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xs font-semibold text-emerald-300">
            FH
          </div>
          <div>
            <div className="text-base font-semibold tracking-wide">
              Findependence – Build Wealth. Retire Earlier.
            </div>
            <div className="text-xs text-slate-400">
              FinHealth – Indian Portfolio &amp; FIRE Coach
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 mr-1" />
          Live simulator · Updates as you fill details
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Left: tabs + content */}
        <section className="flex-1 px-4 md:px-8 py-6 space-y-4 overflow-y-auto">
          {/* Tabs */}
          <nav className="inline-flex rounded-full bg-slate-900/80 border border-slate-800 p-1 text-sm mb-4">
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

          {activeTab === "Input Details" && (
            <InputDetailsTab
              data={data}
              update={update}
              fixedTotal={fixedTotal}
              variableTotal={variableTotal}
            />
          )}
          {activeTab === "Your Score" && <ScorePlaceholder />}
          {activeTab === "FIRE & SIP" && <FirePlaceholder />}
          {activeTab === "SWOT & Actions" && <SwotPlaceholder />}
        </section>

        {/* Right: live summary panel */}
        <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/90 px-4 py-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="text-xs font-semibold text-slate-300 mb-1">
              Live FinHealth snapshot
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Cash flow overview. This will drive your score and FIRE plan.
            </div>

            <div className="space-y-2 text-xs">
              <SummaryRow
                label="Total income / month"
                value={formatCurrency(totalIncome)}
              />
              <SummaryRow
                label="Fixed expenses (needs)"
                value={formatCurrency(fixedTotal)}
              />
              <SummaryRow
                label="Variable expenses (wants)"
                value={formatCurrency(variableTotal)}
              />
              <SummaryRow
                label="Total expenses"
                value={formatCurrency(totalExpenses)}
              />
              <SummaryRow
                label="Monthly savings"
                value={formatCurrency(monthlySavings)}
              />
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Savings rate</span>
                <span>{Math.round(savingsRate * 100) || 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(savingsRate * 100, 60)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Target ≥ 20% savings rate; 30%+ is excellent for India.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Investments overview
            </div>
            <SummaryRow
              label="Total investments"
              value={formatCurrency(totalInvestments)}
            />
            <p className="text-[11px] text-slate-500">
              Later we&apos;ll show how this tracks against your FIRE target and
              recommended MF / stocks / gold / bonds mix.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

/* ---------- Input Details Tab ---------- */

function InputDetailsTab({ data, update, fixedTotal, variableTotal }) {
  // Refs for auto-scroll
  const personalRef = useRef(null);
  const incomeRef = useRef(null);
  const expensesRef = useRef(null);
  const emisRef = useRef(null);
  const protectionRef = useRef(null);
  const investmentsRef = useRef(null);

  const scrollTo = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Input Details</h1>
      <p className="text-sm text-slate-300 max-w-2xl">
        Enter rough monthly numbers first. You can always refine them later.
        All amounts are in ₹ per month unless mentioned otherwise.
      </p>

      {/* Personal section */}
      <Card
        title="You & family"
        description="Basic context to tune recommendations."
        innerRef={personalRef}
        onNext={() => scrollTo(incomeRef)}
        nextLabel="Next: Income"
      >
        <div className="grid gap-4 md:grid-cols-4">
          <NumberField
            label="Your age"
            value={data.age}
            onChange={(age) => update({ age })}
          />
          <NumberField
            label="Dependents"
            value={data.dependents}
            onChange={(dependents) => update({ dependents })}
          />
          <SelectField
            label="Employment type"
            value={data.employmentType}
            onChange={(employmentType) => update({ employmentType })}
            options={[
              { value: "", label: "Select" },
              { value: "salaried", label: "Salaried" },
              { value: "business", label: "Business owner" },
              { value: "freelancer", label: "Freelancer" },
              { value: "student", label: "Student" },
              { value: "other", label: "Other" },
            ]}
          />
          <SelectField
            label="City type"
            value={data.cityTier}
            onChange={(cityTier) => update({ cityTier })}
            options={[
              { value: "metro", label: "Metro / Tier 1" },
              { value: "tier2", label: "Tier 2" },
              { value: "tier3", label: "Tier 3 / Others" },
            ]}
          />
        </div>
      </Card>

      {/* Income */}
      <Card
        title="Monthly income"
        description="Income for you, spouse and other family members. Add fixed + variable."
        innerRef={incomeRef}
        onNext={() => scrollTo(expensesRef)}
        nextLabel="Next: Expenses"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <QuickAmountField
            label="Your fixed income"
            value={data.incomeSelf}
            onChange={(incomeSelf) => update({ incomeSelf })}
            suggestions={[30000, 50000, 75000, 100000, 150000]}
          />
          <QuickAmountField
            label="Spouse fixed income"
            value={data.incomeSpouse}
            onChange={(incomeSpouse) => update({ incomeSpouse })}
            suggestions={[0, 25000, 50000, 75000]}
          />
          <QuickAmountField
            label="Other family income (fixed)"
            value={data.incomeOther}
            onChange={(incomeOther) => update({ incomeOther })}
            suggestions={[0, 10000, 20000, 30000]}
          />
          <QuickAmountField
            label="Variable / bonus / freelance"
            value={data.incomeVariable}
            onChange={(incomeVariable) => update({ incomeVariable })}
            suggestions={[0, 5000, 10000, 25000]}
          />
        </div>
      </Card>

      {/* Expenses */}
      <Card
        title="Monthly expenses"
        description="Split needs vs wants. This drives your savings rate and FIRE number."
        innerRef={expensesRef}
        onNext={() => scrollTo(emisRef)}
        nextLabel="Next: EMIs & loans"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Fixed (needs) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <div>
                <h3 className="text-sm font-semibold">Fixed expenses (needs)</h3>
                <p className="text-xs text-slate-400">
                  Essentials you must pay every month.
                </p>
              </div>
              <div className="text-xs text-slate-300">
                Total:{" "}
                <span className="font-semibold">
                  {formatCurrency(fixedTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <QuickAmountField
                label="Rent / home maintenance"
                value={data.fixedRent}
                onChange={(fixedRent) => update({ fixedRent })}
                suggestions={[10000, 20000, 30000, 50000]}
              />
              <QuickAmountField
                label="Food & groceries"
                value={data.fixedFood}
                onChange={(fixedFood) => update({ fixedFood })}
                suggestions={[8000, 15000, 25000, 35000]}
              />
              <QuickAmountField
                label="Utilities & bills (electricity, gas, phone)"
                value={data.fixedUtilities}
                onChange={(fixedUtilities) => update({ fixedUtilities })}
                suggestions={[2000, 4000, 6000, 8000]}
              />
              <QuickAmountField
                label="Medical & insurance premiums (monthly)"
                value={data.fixedMedical}
                onChange={(fixedMedical) => update({ fixedMedical })}
                suggestions={[1000, 2000, 3000, 5000]}
              />
            </div>
          </div>

          {/* Variable (wants) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <div>
                <h3 className="text-sm font-semibold">
                  Variable expenses (wants)
                </h3>
                <p className="text-xs text-slate-400">
                  Lifestyle spends you can flex if needed.
                </p>
              </div>
              <div className="text-xs text-slate-300">
                Total:{" "}
                <span className="font-semibold">
                  {formatCurrency(variableTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <QuickAmountField
                label="WiFi / OTT / subscriptions"
                value={data.varWifi}
                onChange={(varWifi) => update({ varWifi })}
                suggestions={[500, 1000, 1500, 2500]}
              />
              <QuickAmountField
                label="Entertainment (movies, outings, hobbies)"
                value={data.varEntertainment}
                onChange={(varEntertainment) => update({ varEntertainment })}
                suggestions={[2000, 4000, 6000, 10000]}
              />
              <QuickAmountField
                label="Shopping (clothes, gadgets, gifts)"
                value={data.varShopping}
                onChange={(varShopping) => update({ varShopping })}
                suggestions={[3000, 5000, 8000, 12000]}
              />
              <QuickAmountField
                label="Misc. / others"
                value={data.varMisc}
                onChange={(varMisc) => update({ varMisc })}
                suggestions={[1000, 3000, 5000, 8000]}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* EMIs & loans */}
      <Card
        title="EMIs & loans"
        description="Total EMIs and outstanding loans across home, car, personal, credit cards."
        innerRef={emisRef}
        onNext={() => scrollTo(protectionRef)}
        nextLabel="Next: Protection"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <QuickAmountField
            label="Total monthly EMIs"
            value={data.totalEmi}
            onChange={(totalEmi) => update({ totalEmi })}
            suggestions={[0, 10000, 25000, 50000]}
          />
          <QuickAmountField
            label="Total outstanding loan amount"
            value={data.loanOutstanding}
            onChange={(loanOutstanding) => update({ loanOutstanding })}
            suggestions={[0, 500000, 2000000, 5000000]}
          />
        </div>
      </Card>

      {/* Protection */}
      <Card
        title="Financial protection"
        description="Emergency fund + health insurance + life / term cover."
        innerRef={protectionRef}
        onNext={() => scrollTo(investmentsRef)}
        nextLabel="Next: Investments"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAmountField
            label="Emergency fund (savings, FDs, liquid funds)"
            value={data.emergencyFund}
            onChange={(emergencyFund) => update({ emergencyFund })}
            suggestions={[50000, 100000, 300000, 600000]}
          />
          <QuickAmountField
            label="Health insurance cover (family total)"
            value={data.healthCover}
            onChange={(healthCover) => update({ healthCover })}
            suggestions={[500000, 1000000, 2500000]}
          />
          <QuickAmountField
            label="Life / term insurance cover"
            value={data.lifeCover}
            onChange={(lifeCover) => update({ lifeCover })}
            suggestions={[5000000, 10000000, 20000000]}
          />
        </div>
      </Card>

      {/* Investments */}
      <Card
        title="Investments (current value)"
        description="Approximate current value in each bucket."
        innerRef={investmentsRef}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAmountField
            label="Bonds / FDs / RDs"
            value={data.invBonds}
            onChange={(invBonds) => update({ invBonds })}
            suggestions={[0, 100000, 300000, 500000]}
          />
          <QuickAmountField
            label="Mutual funds"
            value={data.invMF}
            onChange={(invMF) => update({ invMF })}
            suggestions={[0, 200000, 500000, 1000000]}
          />
          <QuickAmountField
            label="Stocks"
            value={data.invStocks}
            onChange={(invStocks) => update({ invStocks })}
            suggestions={[0, 100000, 300000, 700000]}
          />
          <QuickAmountField
            label="Gold (physical + ETF)"
            value={data.invGold}
            onChange={(invGold) => update({ invGold })}
            suggestions={[0, 100000, 300000, 500000]}
          />
          <QuickAmountField
            label="Others (REITs, P2P, crypto, etc.)"
            value={data.invOthers}
            onChange={(invOthers) => update({ invOthers })}
            suggestions={[0, 50000, 200000, 500000]}
          />
        </div>
      </Card>
    </div>
  );
}

/* ---------- Other tabs (still placeholders) ---------- */

function ScorePlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Your FinHealth Score</h1>
      <p className="text-sm text-slate-300 max-w-xl">
        This section will turn your inputs into a 0–100 FinHealth score,
        explain why it&apos;s low or high, and show options to improve based on
        Indian benchmarks.
      </p>

      <Card title="Score, savings meter & breakdown">
        <div className="h-32 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-xs text-slate-500">
          Next step: score gauge, savings meter and detailed breakdown.
        </div>
      </Card>
    </div>
  );
}

function FirePlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">FIRE & SIP Planning</h1>
      <p className="text-sm text-slate-300 max-w-xl">
        Here we&apos;ll calculate your FIRE number, show Lean / Normal / Fat
        FIRE options and recommend SIP / lumpsum strategies using Indian equity
        MF return assumptions.
      </p>

      <Card title="FIRE number & SIP suggestions">
        <div className="h-32 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-xs text-slate-500">
          Next step: FIRE corpus cards + SIP / lumpsum calculator.
        </div>
      </Card>
    </div>
  );
}

function SwotPlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">SWOT & Action Plan</h1>
      <p className="text-sm text-slate-300 max-w-xl">
        We&apos;ll map your numbers into Strengths, Weaknesses, Opportunities
        and Threats, and then list concrete action items.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Strengths">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-xs text-slate-500">
            Later: auto-generated strengths (e.g., good savings rate, solid EF).
          </div>
        </Card>
        <Card title="Weaknesses">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-xs text-slate-500">
            Later: weaknesses like low cover, high EMIs, overspending.
          </div>
        </Card>
        <Card title="Opportunities">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-xs text-slate-500">
            Later: opportunities like higher SIPs, better allocation, tax hacks.
          </div>
        </Card>
        <Card title="Threats">
          <div className="h-20 rounded-xl border border-dashed border-slate-700/70 flex items-center justify-center text-xs text-slate-500">
            Later: threats like job loss + EMI load, health risks, underinsurance.
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Shared UI helpers ---------- */

function Card({ title, description, children, innerRef, onNext, nextLabel }) {
  return (
    <div
      ref={innerRef}
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3"
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <h2 className="text-sm md:text-base font-semibold">{title}</h2>
          {description && (
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
      {onNext && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 text-xs md:text-sm text-emerald-300 hover:text-emerald-200"
          >
            <span>{nextLabel || "Save & continue"}</span>
            <span className="text-base">↘</span>
          </button>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="text-slate-200">{label}</label>
      <input
        type="number"
        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="text-slate-200">{label}</label>
      <select
        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function QuickAmountField({ label, value, onChange, suggestions }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="text-slate-200">{label}</label>
      <input
        type="number"
        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
      <div className="flex flex-wrap gap-2 mt-1">
        {suggestions.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(amount)}
            className="px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-100 hover:bg-slate-700"
          >
            ₹{amount.toLocaleString("en-IN")}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 font-medium">{value}</span>
    </div>
  );
}

function formatCurrency(num) {
  const safe = Number(num) || 0;
  return "₹" + safe.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default App;