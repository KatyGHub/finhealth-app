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

    fixedRent: 0,
    fixedFood: 0,
    fixedUtilities: 0,
    fixedMedical: 0,

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

      <main className="flex-1 flex flex-col md:flex-row">
        <section className="flex-1 px-4 md:px-8 py-6 space-y-4 overflow-y-auto">
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
              onShowScore={() => setActiveTab("Your Score")}
            />
          )}

          {activeTab === "Your Score" && (
            <ScoreTab
              data={data}
              fixedTotal={fixedTotal}
              variableTotal={variableTotal}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              monthlySavings={monthlySavings}
              totalInvestments={totalInvestments}
            />
          )}

          {activeTab === "FIRE & SIP" && (
            <FireTab
              data={data}
              totalExpenses={totalExpenses}
              totalInvestments={totalInvestments}
              monthlySavings={monthlySavings}
            />
          )}

         {activeTab === "SWOT & Actions" && (
          <SwotTab
            data={data}
            fixedTotal={fixedTotal}
            variableTotal={variableTotal}
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            monthlySavings={monthlySavings}
            totalInvestments={totalInvestments}
          />
        )}

        <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/90 px-4 py-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="text-xs font-semibold text-slate-300 mb-1">
              Live FinHealth snapshot
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Cash flow overview. This will drive your Portfolio FinHealth Index
              and FIRE plan.
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
      </section>
      </main>
    </div>
  );
}

/* ---------- Input Details Tab (journey) ---------- */

function InputDetailsTab({
  data,
  update,
  fixedTotal,
  variableTotal,
  onShowScore,
}) {
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
        Move left to right like a journey. Start with rough monthly numbers;
        refine later. All amounts are in ₹ per month unless mentioned otherwise.
      </p>

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

      <Card
        title="Monthly expenses"
        description="Split needs vs wants. This drives your savings rate and FIRE number."
        innerRef={expensesRef}
        onNext={() => scrollTo(emisRef)}
        nextLabel="Next: EMIs & loans"
      >
        <div className="grid gap-4 md:grid-cols-2">
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
                onChange={(fixedUtilities) =>
                  update({ fixedUtilities })
                }
                suggestions={[2000, 4000, 6000, 8000]}
              />
              <QuickAmountField
                label="Medical & premiums (monthly)"
                value={data.fixedMedical}
                onChange={(fixedMedical) => update({ fixedMedical })}
                suggestions={[1000, 2000, 3000, 5000]}
              />
            </div>
          </div>

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
                onChange={(varEntertainment) =>
                  update({ varEntertainment })
                }
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

      <Card
        title="EMIs & loans"
        description="Home, car, personal loans and credit card EMIs."
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

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={onShowScore}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
          >
            Show Portfolio FinHealth Index
            <span className="text-base">→</span>
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Score tab with real index ---------- */

function ScoreTab({
  data,
  fixedTotal,
  variableTotal,
  totalIncome,
  totalExpenses,
  monthlySavings,
  totalInvestments,
}) {
  const result = computeFinHealth(
    data,
    fixedTotal,
    variableTotal,
    totalIncome,
    totalExpenses,
    monthlySavings,
    totalInvestments
  );

  const color =
    result.score >= 80
      ? "text-emerald-400"
      : result.score >= 60
      ? "text-lime-300"
      : result.score >= 45
      ? "text-amber-300"
      : "text-red-400";

  const gaugeBg =
    result.score >= 80
      ? "from-emerald-500/60 via-emerald-400/40 to-emerald-500/10"
      : result.score >= 60
      ? "from-lime-400/60 via-lime-300/40 to-lime-400/10"
      : result.score >= 45
      ? "from-amber-400/60 via-amber-300/40 to-amber-400/10"
      : "from-red-500/60 via-red-400/40 to-red-500/10";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Your Portfolio FinHealth Index</h1>
      <p className="text-sm text-slate-300 max-w-2xl">
        The Portfolio FinHealth Index (PFI) is a 0–100 score built for Indian
        households. It looks at savings rate, EMI burden, emergency fund,
        insurance cover and investments.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col items-center justify-center">
          <div className="relative h-40 w-40 mb-4">
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-tr ${gaugeBg}`}
            />
            <div className="absolute inset-3 rounded-full bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
              <div className={`text-4xl font-bold ${color}`}>
                {Math.round(result.score)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                out of 100 BFI
              </div>
            </div>
          </div>

          <div className={`text-base font-semibold ${color}`}>
            {result.bandLabel}
          </div>
          <div className="text-xs text-slate-400 mt-1 text-center max-w-xs">
            {result.bandText}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 text-sm">
          <h2 className="text-sm font-semibold">Why your BFI looks like this</h2>
          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <MetricChip
              label="Savings rate"
              value={`${Math.round(result.metrics.savingsRate * 100) || 0}%`}
              comment={result.comments.savings}
            />
            <MetricChip
              label="EMI burden"
              value={`${Math.round(result.metrics.emiRatio * 100) || 0}% of income`}
              comment={result.comments.emi}
            />
            <MetricChip
              label="Emergency fund"
              value={`${result.metrics.efMonths.toFixed(1)} months`}
              comment={result.comments.ef}
            />
            <MetricChip
              label="Protection cover"
              value={`Health: ${result.metrics.healthAdequacy}% · Life: ${result.metrics.lifeAdequacy}%`}
              comment={result.comments.protection}
            />
            <MetricChip
              label="Investments vs target"
              value={`${result.metrics.invCoverage}% of long-term target`}
              comment={result.comments.investments}
            />
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-semibold mb-2">
              Priority actions to improve your BFI
            </h3>
            <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
              {result.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- FIRE / SWOT sections ---------- */

function FireTab({ data, totalExpenses, totalInvestments, monthlySavings }) {
  const [returnRate, setReturnRate] = useState(12); // 10–14% typical equity MF range in India

  const age = data.age || 30;
  const annualExpenses = totalExpenses * 12;

  // If user hasn't filled expenses yet, show a gentle nudge
  if (!annualExpenses) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">FIRE & SIP Planning</h1>
        <p className="text-sm text-slate-300 max-w-xl">
          To calculate your FIRE number, we need your monthly expenses first.
          Go back to Input Details and add fixed + variable spends.
        </p>

        <Card title="What you&apos;ll see here">
          <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
            <li>Lean, Normal and Fat FIRE corpus based on your expenses</li>
            <li>Time to FIRE and age at FIRE</li>
            <li>Required monthly SIP and one-time lumpsum to reach each target</li>
          </ul>
        </Card>
      </div>
    );
  }

  // Years you’ll keep investing (target: 60; minimum: 5)
  const yearsToFireBase = Math.max(5, 60 - age);
  const rYear = returnRate / 100;
  const rMonth = rYear / 12;
  const nMonths = yearsToFireBase * 12;

  const plans = [
    {
      id: "lean",
      label: "Lean FIRE",
      multiple: 20,
      tag: "20x annual expenses – minimalist lifestyle",
    },
    {
      id: "normal",
      label: "Normal FIRE",
      multiple: 25,
      tag: "25x annual expenses – standard 4% withdrawal rate",
    },
    {
      id: "fat",
      label: "Fat FIRE",
      multiple: 40,
      tag: "40x annual expenses – more travel, upgrades and buffer",
    },
  ];

  const makePlanStats = (plan) => {
    const targetCorpus = annualExpenses * plan.multiple;
    const achievedPct = targetCorpus
      ? Math.min((totalInvestments / targetCorpus) * 100, 100)
      : 0;
    const gap = Math.max(targetCorpus - totalInvestments, 0);

    let requiredSip = 0;
    if (gap > 0 && nMonths > 0) {
      if (rMonth > 0) {
        const factor = Math.pow(1 + rMonth, nMonths) - 1;
        requiredSip = (gap * rMonth) / factor;
      } else {
        requiredSip = gap / nMonths;
      }
    }

    let requiredLumpsum = 0;
    if (gap > 0) {
      requiredLumpsum = gap / Math.pow(1 + rYear, yearsToFireBase);
    }

    const canRetireNow = gap <= 0;

    return {
      targetCorpus,
      achievedPct,
      gap,
      requiredSip,
      requiredLumpsum,
      canRetireNow,
    };
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">FIRE & SIP Planning</h1>
      <p className="text-sm text-slate-300 max-w-2xl">
        Based on your current expenses and investments, we estimate how big a
        corpus you need for Lean / Normal / Fat FIRE. We assume long-term
        equity mutual fund returns of{" "}
        <span className="font-semibold">{returnRate}% p.a.</span> (pre-tax).
      </p>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Expected return (p.a.)</span>
          <div className="inline-flex rounded-full bg-slate-900 border border-slate-700 p-1">
            {[10, 12, 14].map((rate) => {
              const selected = rate === returnRate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setReturnRate(rate)}
                  className={
                    "px-3 py-1 rounded-full transition " +
                    (selected
                      ? "bg-emerald-500 text-slate-950 font-semibold"
                      : "text-slate-200 hover:bg-slate-800")
                  }
                >
                  {rate}%
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-slate-400">
          Current monthly savings:{" "}
          <span className="text-slate-100 font-medium">
            {formatCurrency(monthlySavings)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const stats = makePlanStats(plan);
          const yearsToFire = yearsToFireBase;
          const ageAtFire = age + yearsToFire;

          return (
            <div
              key={plan.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {plan.label}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {plan.tag}
                    </div>
                  </div>
                  <div className="text-xs rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                    Target corpus
                  </div>
                </div>
                <div className="text-lg font-semibold text-emerald-300">
                  {formatCurrency(stats.targetCorpus)}
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-slate-200">
                      {Math.round(stats.achievedPct)}% achieved
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${stats.achievedPct}%`,
                      }}
                    />
                  </div>
                </div>

                {!stats.canRetireNow && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2">
                      <div className="text-slate-400">Time to FIRE</div>
                      <div className="text-slate-100 font-semibold">
                        {yearsToFire} years
                      </div>
                      <div className="text-slate-500">
                        Age at FIRE: {Math.round(ageAtFire)} yrs
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-2">
                      <div className="text-slate-400">
                        Required monthly SIP
                      </div>
                      <div className="text-slate-100 font-semibold">
                        {stats.requiredSip
                          ? formatCurrency(stats.requiredSip)
                          : "₹0"}
                      </div>
                      <div className="text-slate-500">
                        At {returnRate}% p.a. till age ~60
                      </div>
                    </div>
                  </div>
                )}

                {stats.canRetireNow && (
                  <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-2 text-[11px] text-emerald-200">
                    Your current investments already meet this FIRE target on
                    paper. Double-check lifestyle assumptions and taxes before
                    quitting your job.
                  </div>
                )}
              </div>

              {!stats.canRetireNow && (
                <div className="pt-2 border-t border-slate-800 mt-2 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      If investing as lumpsum today
                    </span>
                    <span className="text-slate-100 font-semibold">
                      {stats.requiredLumpsum
                        ? formatCurrency(stats.requiredLumpsum)
                        : "₹0"}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    Invest this amount now at {returnRate}% p.a. to reach the
                    target by age ~60 (ignoring future tax changes).
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SwotTab({
  data,
  fixedTotal,
  variableTotal,
  totalIncome,
  totalExpenses,
  monthlySavings,
  totalInvestments,
}) {
  const result = computeFinHealth(
    data,
    fixedTotal,
    variableTotal,
    totalIncome,
    totalExpenses,
    monthlySavings,
    totalInvestments
  );

  const { savingsRate, emiRatio, efMonths, healthAdequacy, lifeAdequacy, invCoverage } =
    result.metrics;

  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];

  // Strengths
  if (savingsRate >= 0.25) {
    strengths.push(
      `Strong savings discipline – saving about ${Math.round(
        savingsRate * 100
      )}% of monthly income.`
    );
  } else if (savingsRate >= 0.18) {
    strengths.push(
      `Decent savings rate of ~${Math.round(
        savingsRate * 100
      )}%. With a few tweaks you can cross 25%.`
    );
  }

  if (emiRatio < 0.25 && data.totalEmi > 0) {
    strengths.push(
      `EMI load is under control at ~${Math.round(
        emiRatio * 100
      )}% of income.`
    );
  }

  if (efMonths >= 6) {
    strengths.push(
      `Solid emergency fund – can handle about ${efMonths.toFixed(
        1
      )} months of expenses.`
    );
  }

  if (healthAdequacy >= 100) {
    strengths.push("Health insurance cover roughly matches Indian benchmarks.");
  }
  if (lifeAdequacy >= 60) {
    strengths.push(
      "Life / term insurance is reasonably aligned to income and dependents."
    );
  }

  if (invCoverage >= 60) {
    strengths.push(
      "Investments are compounding well compared to a typical 10–15 year target."
    );
  }

  // Weaknesses
  if (savingsRate < 0.15) {
    weaknesses.push(
      `Low savings rate (~${Math.round(
        savingsRate * 100
      )}%). Any shock can derail goals.`
    );
  }

  if (emiRatio >= 0.35) {
    weaknesses.push(
      `High EMI burden – about ${Math.round(
        emiRatio * 100
      )}% of income goes to EMIs.`
    );
  }

  if (efMonths < 3) {
    weaknesses.push(
      `Emergency fund is thin at only ${efMonths.toFixed(
        1
      )} months of expenses.`
    );
  }

  if (healthAdequacy < 80) {
    weaknesses.push(
      "Health insurance cover is below typical 5–10L Indian benchmark."
    );
  }

  if (lifeAdequacy < 40 && totalIncome > 0) {
    weaknesses.push(
      "Life / term cover is low compared to the ideal ~15x annual income."
    );
  }

  if (invCoverage < 40) {
    weaknesses.push(
      "Long-term investments are behind where they should be for future goals."
    );
  }

  // Opportunities
  if (savingsRate < 0.25) {
    opportunities.push(
      "Push savings rate towards 25–30% by trimming non-essential variable spends and negotiating income growth."
    );
  } else {
    opportunities.push(
      "Channel your strong savings rate into a structured SIP plan mapped to clear goals (FIRE, kids’ education, house, etc.)."
    );
  }

  if (emiRatio >= 0.25 && emiRatio < 0.45) {
    opportunities.push(
      "Use bonuses or surplus cash to prepay high-interest loans and bring EMIs under 25% of income."
    );
  }

  if (efMonths < 6) {
    opportunities.push(
      "Direct part of monthly surplus into an emergency bucket (FDs / liquid MFs) until you reach 6 months of expenses."
    );
  }

  if (healthAdequacy < 120) {
    opportunities.push(
      "Explore floater health plans or super-topups to raise cover without huge premium jumps."
    );
  }

  if (lifeAdequacy < 100 && totalIncome > 0) {
    opportunities.push(
      "Top up term cover (online level-term plans) to move closer to 15x annual income."
    );
  }

  if (invCoverage < 100) {
    opportunities.push(
      "Increase SIPs into diversified equity mutual funds (Nifty 50 / Nifty Next 50 / flexi-cap) to accelerate towards your FIRE corpus."
    );
  }

  // Threats
  if (emiRatio >= 0.45) {
    threats.push(
      "Job loss or income dip could quickly become unmanageable with current EMI burden."
    );
  }
  if (efMonths < 1) {
    threats.push(
      "No real emergency buffer – even a 1–2 month disruption may force you into fresh debt."
    );
  }
  if (healthAdequacy === 0) {
    threats.push(
      "No health insurance – a single hospitalisation can wipe out savings or push you into debt."
    );
  }
  if (lifeAdequacy === 0 && data.dependents > 0) {
    threats.push(
      "Dependents are fully exposed if the primary earner is not around; term cover is critical."
    );
  }
  if (invCoverage === 0 && monthlySavings > 0) {
    threats.push(
      "Surplus cash is not being invested; inflation will silently erode its value over time."
    );
  }

  // Fallbacks so the cards are never empty
  if (!strengths.length) {
    strengths.push(
      "You have taken the first step by measuring your money flows – that alone is a big strength compared to most households."
    );
  }
  if (!weaknesses.length) {
    weaknesses.push(
      "No major structural weaknesses detected from the current numbers. Keep revisiting annually."
    );
  }
  if (!opportunities.length) {
    opportunities.push(
      "You can fine-tune tax optimisation, asset allocation and goal-based investing as your income grows."
    );
  }
  if (!threats.length) {
    threats.push(
      "Main risk is behavioural – inconsistent investing or overreacting to market volatility."
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">SWOT & Action Plan</h1>
      <p className="text-sm text-slate-300 max-w-2xl">
        Based on your Bharat FinHealth Index, expenses, EMIs and protection, here&apos;s a quick
        SWOT view of your finances and where to act next.
      </p>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-200">
          BFI: <span className="font-semibold">{Math.round(result.score)}</span> / 100 ·{" "}
          {result.bandLabel}
        </span>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">
          Savings: {Math.round(savingsRate * 100) || 0}% · EMIs:{" "}
          {Math.round(emiRatio * 100) || 0}% of income
        </span>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-400">
          EF: {efMonths.toFixed(1)} months · Health: {healthAdequacy}% · Life:{" "}
          {lifeAdequacy}%
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card title="Strengths">
          <ul className="list-disc list-inside text-xs text-slate-200 space-y-1">
            {strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card title="Weaknesses">
          <ul className="list-disc list-inside text-xs text-slate-200 space-y-1">
            {weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card title="Opportunities">
          <ul className="list-disc list-inside text-xs text-slate-200 space-y-1">
            {opportunities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card title="Threats">
          <ul className="list-disc list-inside text-xs text-slate-200 space-y-1">
            {threats.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Scoring logic ---------- */

function computeFinHealth(
  data,
  fixedTotal,
  variableTotal,
  totalIncome,
  totalExpenses,
  monthlySavings,
  totalInvestments
) {
  const savingsRate =
    totalIncome > 0 ? monthlySavings / totalIncome : 0;

  const emiRatio =
    totalIncome > 0 ? data.totalEmi / totalIncome : 0;

  const efMonths =
    totalExpenses > 0 ? data.emergencyFund / totalExpenses : 0;

  const healthTarget = 500000; // base 5L recommendation
  const healthAdequacy =
    healthTarget > 0
      ? Math.round(
          Math.min((data.healthCover / healthTarget) * 100, 200)
        )
      : 0;

  const annualIncome = totalIncome * 12;
  const lifeTarget = annualIncome * 15; // 15x annual income
  const lifeAdequacy =
    lifeTarget > 0
      ? Math.round(
          Math.min((data.lifeCover / lifeTarget) * 100, 200)
        )
      : 0;

  const annualExpenses = totalExpenses * 12;
  const invTarget = annualExpenses * 10; // 10 years of expenses
  const invCoverage =
    invTarget > 0
      ? Math.round(
          Math.min((totalInvestments / invTarget) * 100, 200)
        )
      : 0;

  // Savings score (0–30)
  let savingsScore = 0;
  if (savingsRate >= 0.3) savingsScore = 30;
  else if (savingsRate >= 0.2) savingsScore = 24;
  else if (savingsRate >= 0.15) savingsScore = 18;
  else if (savingsRate >= 0.1) savingsScore = 10;
  else if (savingsRate > 0) savingsScore = 5;

  // EMI score (0–20) – lower EMI% is better
  let emiScore = 0;
  if (emiRatio < 0.2) emiScore = 20;
  else if (emiRatio < 0.3) emiScore = 15;
  else if (emiRatio < 0.4) emiScore = 10;
  else if (emiRatio < 0.6) emiScore = 5;

  // Emergency fund (0–20)
  let efScore = 0;
  if (efMonths >= 6) efScore = 20;
  else if (efMonths >= 3) efScore = 14;
  else if (efMonths >= 1) efScore = 8;
  else if (efMonths > 0) efScore = 4;

  // Protection (0–20) – 10 for health, 10 for life
  let healthScore = 0;
  if (healthAdequacy >= 150) healthScore = 10;
  else if (healthAdequacy >= 100) healthScore = 8;
  else if (healthAdequacy >= 60) healthScore = 5;
  else if (healthAdequacy > 0) healthScore = 2;

  let lifeScore = 0;
  if (lifeAdequacy >= 100) lifeScore = 10;
  else if (lifeAdequacy >= 60) lifeScore = 7;
  else if (lifeAdequacy >= 30) lifeScore = 4;
  else if (lifeAdequacy > 0) lifeScore = 1;

  const protectionScore = healthScore + lifeScore; // 0–20

  // Investments (0–10)
  let invScore = 0;
  if (invCoverage >= 100) invScore = 10;
  else if (invCoverage >= 60) invScore = 7;
  else if (invCoverage >= 30) invScore = 4;
  else if (invCoverage > 0) invScore = 2;

  const score =
    savingsScore + emiScore + efScore + protectionScore + invScore;

  let bandLabel = "Critical";
  let bandText =
    "Very fragile position. Focus on basics: emergency fund, debt control and minimum insurance.";
  if (score >= 85) {
    bandLabel = "Financially strong";
    bandText =
      "Excellent overall health. You can focus on optimising returns and FIRE timelines.";
  } else if (score >= 70) {
    bandLabel = "Secure";
    bandText =
      "Solid foundation. Some tuning of cover, savings and investments can push you to the next level.";
  } else if (score >= 55) {
    bandLabel = "Stable but exposed";
    bandText =
      "You are managing, but risks exist. Prioritise emergency fund, debt load and cover gaps.";
  } else if (score >= 30) {
    bandLabel = "Vulnerable";
    bandText =
      "A few shocks (job loss, medical issue) can hurt badly. Move quickly on protection and savings.";
  }

  const comments = {
    savings:
      savingsRate >= 0.2
        ? "Healthy savings rate. Try to sustain 20–30% over many years."
        : savingsRate > 0.1
        ? "Okay but thin. Aim to push savings to at least 20% of income."
        : "Very low savings. Cut wants and increase income to free up at least 15–20% of income.",
    emi:
      emiRatio < 0.2
        ? "EMI load is comfortable."
        : emiRatio < 0.35
        ? "EMIs are noticeable but manageable. Avoid new loans."
        : "High EMI burden. Prioritise prepayment / consolidation and avoid fresh EMIs.",
    ef:
      efMonths >= 6
        ? "Strong emergency buffer in place."
        : efMonths >= 3
        ? "Decent buffer. Push towards 6 months of expenses."
        : efMonths > 0
        ? "Some buffer, but fragile. Build towards at least 3 months."
        : "No emergency fund. This is the first priority.",
    protection:
      healthAdequacy >= 100 && lifeAdequacy >= 60
        ? "Protection looks broadly adequate; review cover every 2–3 years."
        : "Cover looks light. Aim for 5–10L health cover and ~15x annual income in term insurance.",
    investments:
      invCoverage >= 60
        ? "Investments are compounding well. Stay disciplined with equity MFs for long-term goals."
        : "Investments are behind where they should be. Consider SIPs into diversified equity MFs.",
  };

  const actions = [];

  if (savingsRate < 0.2) {
    actions.push(
      "Target at least 20% savings rate by trimming variable spends and/or increasing income."
    );
  }
  if (emiRatio > 0.3) {
    actions.push(
      "Plan a debt strategy: prepay high-interest loans and avoid new EMIs until EMI/income falls below 25%."
    );
  }
  if (efMonths < 3) {
    actions.push(
      "Build an emergency fund of at least 3–6 months of expenses in liquid assets (savings, FDs, liquid MFs)."
    );
  }
  if (healthAdequacy < 100) {
    actions.push(
      "Upgrade family health insurance to at least ₹5–10L cover, especially if you are in a metro."
    );
  }
  if (lifeAdequacy < 60) {
    actions.push(
      "Increase term life cover towards ~15x annual income, especially if dependents rely on your income."
    );
  }
  if (invCoverage < 60) {
    actions.push(
      "Start or increase SIPs into diversified equity mutual funds to gradually reach your long-term corpus."
    );
  }
  if (actions.length === 0) {
    actions.push(
      "Maintain your current discipline; review cover, EMIs and asset allocation annually."
    );
  }

  return {
    score,
    bandLabel,
    bandText,
    metrics: {
      savingsRate,
      emiRatio,
      efMonths,
      healthAdequacy,
      lifeAdequacy,
      invCoverage,
    },
    comments,
    actions,
  };
}

/* ---------- UI helpers ---------- */

function Card({
  title,
  description,
  children,
  innerRef,
  onNext,
  nextLabel,
}) {
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

function MetricChip({ label, value, comment }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] font-semibold text-slate-200">
          {label}
        </span>
        <span className="text-[11px] text-emerald-300 font-medium">
          {value}
        </span>
      </div>
      <p className="text-[11px] text-slate-400">{comment}</p>
    </div>
  );
}

function formatCurrency(num) {
  const safe = Number(num) || 0;
  return "₹" + safe.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default App;