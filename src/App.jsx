import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

const INITIAL_DATA = {
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
};

const TABS = [
  "Input Details",
  "Your Score",
  "FIRE & SIP",
  "SWOT & Actions",
];

function App() {
  const [activeTab, setActiveTab] = useState("Input Details");

  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const [data, setData] = useState(INITIAL_DATA);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [pfiHistory, setPfiHistory] = useState([]);

  // 1) Auth session: check existing session + listen for changes
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!cancelled) {
        setUser(session?.user ?? null);
        setIsAuthLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
      });
    } catch (err) {
      console.error("Error logging in", err);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setHasStarted(false);
      setData(INITIAL_DATA);
      setPfiHistory([]);
    } catch (err) {
      console.error("Error logging out", err);
    }
  }

  // 2) Save current profile to Supabase
  async function saveProfileToSupabase(currentData) {
    if (!user) return;

    const payload = {
      id: user.id,
      data: currentData,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      console.error("Error saving profile", error);
    }
  }

  // 3) Load profile whenever user changes (login)
  useEffect(() => {
    if (!user) {
      setData(INITIAL_DATA);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setIsProfileLoading(true);

      const { data: rows, error } = await supabase
        .from("profiles")
        .select("data")
        .eq("id", user.id)
        .limit(1);

      if (cancelled) return;

      if (error) {
        console.error("Error loading profile", error);
        setIsProfileLoading(false);
        return;
      }

      if (rows && rows.length > 0 && rows[0].data) {
        // Existing user: merge saved data with defaults
        setData({ ...INITIAL_DATA, ...rows[0].data });
        setHasStarted(true); // they already had a profile once
      } else {
        // First-time user: create default row
        await saveProfileToSupabase(INITIAL_DATA);
        setData(INITIAL_DATA);
      }

      setIsProfileLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 4) Auto-save profile when data changes
  useEffect(() => {
    if (!user) return;
    if (isProfileLoading) return; // don’t save while loading

    const timeout = setTimeout(() => {
      saveProfileToSupabase(data);
    }, 1200); // save 1.2s after last change

    return () => clearTimeout(timeout);
  }, [data, user, isProfileLoading]);

  // 5) Load PFI history for this user
  useEffect(() => {
    if (!user) {
      setPfiHistory([]);
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      const { data: rows, error } = await supabase
        .from("portfolio_history")
        .select("id, created_at, pfi")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Error loading PFI history", error);
        return;
      }

      setPfiHistory(
        (rows || []).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          pfi: Number(row.pfi),
        }))
      );
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 6) Save a PFI snapshot to Supabase + update local history
  async function savePfiSnapshot(pfiValue) {
    if (!user) return;

    const payload = {
      user_id: user.id,
      pfi: pfiValue,
      snapshot: data,
    };

    const { data: rows, error } = await supabase
      .from("portfolio_history")
      .insert(payload)
      .select("id, created_at, pfi")
      .single();

    if (error) {
      console.error("Error saving PFI snapshot", error);
      return;
    }

    setPfiHistory((prev) => [
      ...prev,
      {
        id: rows.id,
        createdAt: rows.created_at,
        pfi: Number(rows.pfi),
      },
    ]);
  }

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

  // Flow gating: loading → auth landing → profile onboarding → main dashboard

  if (isAuthLoading || (user && isProfileLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading your data…</div>
      </div>
    );
  }

  if (!user) {
    return <AuthLanding onLogin={handleLogin} />;
  }

  if (!hasStarted) {
    return (
      <ProfileOnboarding
        data={data}
        update={update}
        onContinue={() => setHasStarted(true)}
        onLogout={handleLogout}
        user={user}
      />
    );
  }

  // Main dashboard (PFI journey)
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

        <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 mr-1" />
            Live simulator · Updates as you fill details
            {isProfileLoading && (
              <span className="ml-2 text-slate-500">
                Syncing with cloud…
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300 max-w-[160px] truncate">
              {user.user_metadata?.full_name || user.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
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
              pfiHistory={pfiHistory}
              onSaveSnapshot={savePfiSnapshot}
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
        </section>

        <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/90 px-4 py-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="text-xs font-semibold text-slate-300 mb-1">
              Live FinHealth snapshot
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Cash flow overview. This will drive your Portfolio FinHealth
              Index and FIRE plan.
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
              Later we&apos;ll show how this tracks against your FIRE target
              and recommended MF / stocks / gold / bonds mix.
            </p>
          </div>
        </aside>
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

function computePFI({
  savingsRate,
  emergencyFundMonths,
  emiToIncome,
  protectionRatio,
}) {
  // 0–40 pts: savings rate (target 40% or more)
  const sr =
    savingsRate <= 0
      ? 0
      : savingsRate >= 0.4
      ? 40
      : Math.round((savingsRate / 0.4) * 40);

  // 0–20 pts: emergency fund (target 6 months of expenses)
  const ef =
    emergencyFundMonths >= 6
      ? 20
      : Math.round((emergencyFundMonths / 6) * 20);

  // 0–20 pts: EMI stress (target <= 30% of income)
  const emiScore =
    emiToIncome >= 0.6
      ? 0
      : emiToIncome <= 0.3
      ? 20
      : Math.round(((0.6 - emiToIncome) / 0.3) * 20);

  // 0–20 pts: life cover adequacy vs target
  const prot =
    protectionRatio >= 1
      ? 20
      : Math.round(protectionRatio * 20);

  const total = sr + ef + emiScore + prot;

  return {
    total,
    breakdown: {
      sr,
      ef,
      emiScore,
      prot,
    },
  };
}

function ScoreTab({
  data,
  fixedTotal,
  variableTotal,
  totalIncome,
  totalExpenses,
  monthlySavings,
  totalInvestments,
  pfiHistory,
  onSaveCheckpoint,
  isSavingCheckpoint,
}) {
  const savingsRate = totalIncome > 0 ? monthlySavings / totalIncome : 0;

  // Emergency fund in months of expenses
  const emergencyMonths =
    totalExpenses > 0 ? data.emergencyFund / totalExpenses : 0;

  // EMI load vs income
  const emiLoad = totalIncome > 0 ? data.totalEmi / totalIncome : 0;

  // Protection: life + health vs rough Indian benchmarks
  const annualIncome = totalIncome * 12;
  const targetLifeCover = annualIncome * 15; // 15x annual income
  const lifeCoverRatio =
    targetLifeCover > 0 ? data.lifeCover / targetLifeCover : 0;

  // Simple health benchmark: ₹7.5L base, add some for dependents & metro
  const baseHealthTarget = 750_000;
  const depFactor = 1 + (data.dependents || 0) * 0.25;
  const metroBump = data.cityTier === "metro" ? 1.3 : 1;
  const targetHealthCover = baseHealthTarget * depFactor * metroBump;
  const healthCoverRatio =
    targetHealthCover > 0 ? data.healthCover / targetHealthCover : 0;

  const avgProtectionRatio = (lifeCoverRatio + healthCoverRatio) / 2;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // Scoring bands – tuned for India
  const savingsScore = clamp01(savingsRate / 0.3) * 40; // 30%+ savings = full 40
  const emergencyScore = clamp01(emergencyMonths / 6) * 20; // 6 months = full 20
  const emiScore =
    emiLoad <= 0.3
      ? 20
      : emiLoad <= 0.4
      ? 14
      : emiLoad <= 0.5
      ? 8
      : emiLoad <= 0.6
      ? 4
      : 0;
  const protectionScore = clamp01(avgProtectionRatio) * 20;

  const currentPFI = Math.round(
    savingsScore + emergencyScore + emiScore + protectionScore
  );

  // History for chart
  const history = (pfiHistory && pfiHistory.length > 0
    ? pfiHistory
    : [{ pfi: currentPFI, created_at: new Date().toISOString() }]
  ).slice(0, 60); // keep it sane

  const chartWidth = 1000;
  const chartHeight = 120;
  const paddingX = 40;
  const paddingY = 20;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const xStep =
    history.length > 1 ? innerWidth / (history.length - 1) : innerWidth / 2;

  const points = history.map((h, index) => {
    const x = paddingX + index * xStep;
    const y =
      paddingY +
      innerHeight -
      (clamp01(h.pfi / 100) || 0) * innerHeight; // higher PFI = higher point
    return { x, y, pfi: h.pfi };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const latestPFI = history[history.length - 1]?.pfi ?? currentPFI;

  return (
    <div className="space-y-6">
      {/* PFI headline card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-lg md:text-xl font-semibold text-slate-50">
              Portfolio FinHealth Index (PFI)
            </h2>
            <p className="text-sm md:text-base text-slate-300">
              Composite score combining savings strength, emergency fund, EMI
              stress and protection cover – tuned for Indian investors.
            </p>
            <p className="text-xs md:text-sm text-slate-400">
              Higher is better. Start by fixing one pillar at a time rather than
              everything together.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="h-28 w-28 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 flex flex-col items-center justify-center">
              <div className="text-xs text-slate-400 mb-1">Current PFI</div>
              <div className="text-4xl font-semibold text-emerald-300">
                {currentPFI}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">/ 100</div>
            </div>

            <button
              type="button"
              onClick={() => onSaveCheckpoint(currentPFI)}
              disabled={isSavingCheckpoint}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSavingCheckpoint ? "Saving…" : "Save this PFI checkpoint"}
            </button>
          </div>
        </div>

        {/* Pillar bars */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Savings strength */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Savings strength</span>
              <span>
                {Math.round(clamp01(savingsRate) * 100)}% ·{" "}
                {Math.round(savingsScore)}/40
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${Math.min(savingsRate * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-[11px] md:text-xs text-slate-400">
              Aim for a 20–30%+ savings rate for aggressive FIRE. Under 10% is a
              red flag.
            </p>
          </div>

          {/* Emergency fund */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Emergency fund</span>
              <span>
                {Math.round(emergencyMonths * 10) / 10} months ·{" "}
                {Math.round(emergencyScore)}/20
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${Math.min(emergencyMonths / 6, 1) * 100}%`,
                }}
              />
            </div>
            <p className="text-[11px] md:text-xs text-slate-400">
              Target at least 6 months of expenses in liquid funds / safe
              options for India.
            </p>
          </div>

          {/* EMI load */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>EMI load</span>
              <span>
                {Math.round(emiLoad * 100) || 0}% · {Math.round(emiScore)}/20
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={
                  "h-full " +
                  (emiLoad <= 0.3
                    ? "bg-emerald-500"
                    : emiLoad <= 0.5
                    ? "bg-amber-400"
                    : "bg-red-500")
                }
                style={{
                  width: `${Math.min(emiLoad * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-[11px] md:text-xs text-slate-400">
              Try to keep total EMIs under ~30% of take-home. Over 50% feels
              tight and hurts savings.
            </p>
          </div>

          {/* Protection cover */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Protection cover</span>
              <span>{Math.round(protectionScore)}/20</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${clamp01(avgProtectionRatio) * 100}%`,
                }}
              />
            </div>
            <p className="text-[11px] md:text-xs text-slate-400">
              Thumb rule: life cover ≈ 15x annual income via term plan, health
              cover ≥ ₹7.5L for metro families.
            </p>
          </div>
        </div>
      </div>

      {/* PFI history with labels */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm md:text-base font-semibold text-slate-50">
              PFI history
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Each checkpoint is stored when you click “Save this PFI
              checkpoint”. This shows how your Portfolio FinHealth Index has
              moved over time.
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            Checkpoints: {history.length} · Latest PFI: {latestPFI}
          </div>
        </div>

        <div className="mt-4 h-40 md:h-44 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-3 md:px-4 py-3">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* baseline */}
            <line
              x1={paddingX}
              y1={chartHeight - paddingY}
              x2={chartWidth - paddingX}
              y2={chartHeight - paddingY}
              stroke="#1f2937"
              strokeWidth="1"
            />

            {/* line */}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePoints}
              />
            )}

            {/* points + labels */}
            {points.map((p, index) => (
              <g key={index}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#34d399"
                  stroke="#22c55e"
                  strokeWidth="1"
                />
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  className="fill-emerald-300"
                  fontSize="10"
                >
                  {p.pfi}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-2 text-[11px] text-slate-500 text-right">
            Oldest on the left, latest on the right.
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ history }) {
  if (!history || history.length === 0) return null;

  const values = history.map((h) => h.pfi);
  const points = history.map((h, idx) => ({
    x: idx,
    y: h.pfi,
  }));

  // If there is only one point, duplicate it so we still draw a line
  if (points.length === 1) {
    points.push({ x: 1, y: points[0].y });
    values.push(points[0].y);
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // Zoom into the actual range so small changes are visible.
  // Add a bit of padding so the line doesn't stick to the borders.
  let domainMin = rawMin;
  let domainMax = rawMax;

  if (domainMax - domainMin < 5) {
    const pad = (5 - (domainMax - domainMin)) / 2;
    domainMin = Math.max(0, domainMin - pad);
    domainMax = Math.min(100, domainMax + pad);
  }

  const range = domainMax - domainMin || 1;

  const maxX = points.length - 1 || 1;
  const width = 260;
  const height = 80;
  const padding = 8;

  const toSvgCoords = (p) => {
    const normX = p.x / maxX;
    const normY = (p.y - domainMin) / range; // 0…1 within [domainMin, domainMax]

    const x =
      padding + normX * (width - padding * 2);
    const y =
      height -
      (padding + normY * (height - padding * 2));

    return { x, y };
  };

  const path = points
    .map((p, idx) => {
      const { x, y } = toSvgCoords(p);
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke="rgb(52 211 153)"
        strokeWidth="1.5"
      />
      {points.map((p, idx) => {
        const { x, y } = toSvgCoords(p);
        return (
          <circle
            key={idx}
            cx={x}
            cy={y}
            r="2"
            fill="rgb(52 211 153)"
          />
        );
      })}
    </svg>
  );
}

/* ---------- FIRE / SWOT sections ---------- */

function FireTab({ data, totalExpenses, totalInvestments, monthlySavings }) {
  const currentAge = Number(data.age || 30);

  const [fireStyle, setFireStyle] = useState("standard"); // lean | standard | fat
  const [retireAge, setRetireAge] = useState(
    Math.max(currentAge + 20, 55) // nudge to a reasonable default
  );
  const [expectedReturn, setExpectedReturn] = useState(12); // p.a.
  const [inflation, setInflation] = useState(6); // p.a.

  const yearsToRetire = Math.max(retireAge - currentAge, 0);
  const monthlyExpense = totalExpenses || 0;
  const annualExpenseToday = monthlyExpense * 12;

  const fireMultiplier =
    fireStyle === "lean" ? 20 : fireStyle === "fat" ? 30 : 25;

  // Inflate expenses to retirement
  const annualExpenseAtRetirement =
    yearsToRetire > 0
      ? annualExpenseToday * Math.pow(1 + inflation / 100, yearsToRetire)
      : annualExpenseToday;

  const targetCorpus = annualExpenseAtRetirement * fireMultiplier;

  const rAnnual = expectedReturn / 100;
  const rMonthly = rAnnual / 12;
  const nMonths = yearsToRetire * 12;

  const currentCorpus = totalInvestments || 0;
  const futureValueCurrentCorpus =
    yearsToRetire > 0 ? currentCorpus * Math.pow(1 + rAnnual, yearsToRetire) : currentCorpus;

  const sipFactor =
    nMonths > 0 && rMonthly > 0
      ? ((Math.pow(1 + rMonthly, nMonths) - 1) / rMonthly) * (1 + rMonthly)
      : 0;

  const sipRequired =
    sipFactor > 0
      ? Math.max(0, (targetCorpus - futureValueCurrentCorpus) / sipFactor)
      : 0;

  const corpusNeededToday =
    yearsToRetire > 0 ? targetCorpus / Math.pow(1 + rAnnual, yearsToRetire) : targetCorpus;

  const lumpSumGap = Math.max(0, corpusNeededToday - currentCorpus);

  const onTrackFlag =
    sipRequired === 0
      ? "Already funded"
      : monthlySavings >= sipRequired * 0.9
      ? "Roughly on track at this savings pace."
      : "You’ll need either higher SIPs or more years to reach this FIRE goal.";

  const styleLabel =
    fireStyle === "lean"
      ? "Lean FIRE (minimalist lifestyle)"
      : fireStyle === "fat"
      ? "Fat FIRE (higher lifestyle, more flexibility)"
      : "Normal FIRE (comfortable baseline)";

  const scenarios = [
    {
      key: "lean",
      title: "Lean FIRE",
      desc: "20× annual expenses · bare-bones but free. Works if you’re okay with a frugal lifestyle and low fixed costs.",
      multiplier: "≈20×",
      lifestyle: "Minimal, geo-arbitrage, low rent, basic travel.",
    },
    {
      key: "standard",
      title: "Normal FIRE",
      desc: "25× annual expenses · standard 4% withdrawal rule. Target for most Indian professionals.",
      multiplier: "≈25×",
      lifestyle: "Comfortable city life, yearly trips, school fees, health buffer.",
    },
    {
      key: "fat",
      title: "Fat FIRE",
      desc: "30×+ annual expenses · aspirational, more margin of safety.",
      multiplier: "30×+",
      lifestyle: "Premium schools, frequent travel, early upgrades, more legacy.",
    },
  ];

  const allocations = [
    {
      title: "Starter allocation (1–3 yrs experience investing)",
      mix: "60% equity · 30% debt · 10% gold/silver",
      bullets: [
        "Use 2–3 diversified index funds / flexi-cap mutual funds for equity.",
        "Debt via high-quality short duration / target-maturity funds, EPF, PPF.",
        "Gold via Sovereign Gold Bonds or low-cost Gold ETFs; small silver ETF slice for diversification.",
      ],
    },
    {
      title: "Balanced allocation (mid-career, kids / home loan)",
      mix: "50% equity · 35% debt · 15% gold/silver",
      bullets: [
        "Shift part of equity to large-cap / index funds to reduce volatility.",
        "Keep emergency fund in liquid / money-market funds + bank.",
        "Use Gold ETFs / SGBs + 2–3% Silver ETFs as a crisis hedge.",
      ],
    },
    {
      title: "Aggressive allocation (long runway, stable income)",
      mix: "70% equity · 20% debt · 10% gold/silver",
      bullets: [
        "Major chunk into low-cost equity index funds (Nifty 50 / Next 50 / Sensex).",
        "Use debt only for stability and near-term goals (3–5 years).",
        "Cap gold + silver at ≈10% of portfolio so it stays a diversifier, not the core.",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-xs text-slate-400 mb-1">Your FIRE style</div>
          <div className="text-sm font-semibold text-slate-50 mb-1">
            {styleLabel}
          </div>
          <p className="text-[11px] text-slate-400">
            This decides how big your target corpus needs to be.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-xs text-slate-400 mb-1">Target FIRE corpus</div>
          <div className="text-base md:text-lg font-semibold text-emerald-300">
            {formatCurrency(Math.round(targetCorpus))}
          </div>
          <p className="text-[11px] text-slate-400">
            In today&apos;s rupees at retirement age, after factoring inflation.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-xs text-slate-400 mb-1">
            Required monthly SIP
          </div>
          <div className="text-base md:text-lg font-semibold text-emerald-300">
            {formatCurrency(Math.round(sipRequired))}
          </div>
          <p className="text-[11px] text-slate-400">
            To reach FIRE by {retireAge}, assuming ~{expectedReturn}% annual
            returns.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-xs text-slate-400 mb-1">
            Extra lump sum gap (today)
          </div>
          <div className="text-base md:text-lg font-semibold text-emerald-300">
            {formatCurrency(Math.round(lumpSumGap))}
          </div>
          <p className="text-[11px] text-slate-400">
            If you prefer lump sum over SIP, this is the additional amount you
            roughly need now.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Plan your FIRE & SIP journey
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl">
              Set your retirement age, choose a FIRE style and adjust expected
              returns / inflation to see how your required SIP changes. All
              numbers are educational estimates, not investment advice.
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            Current age: <span className="font-semibold">{currentAge}</span>{" "}
            years
            <br />
            Years to FIRE target:{" "}
            <span className="font-semibold">{yearsToRetire}</span>
          </div>
        </div>

        {/* FIRE style chips */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400 mb-1">Choose FIRE style</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scenarios.map((s) => {
              const selected = s.key === fireStyle;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFireStyle(s.key)}
                  className={
                    "text-left rounded-2xl border px-4 py-3 transition-transform " +
                    (selected
                      ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]"
                      : "border-slate-700 bg-slate-900 hover:bg-slate-800/80")
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-50">
                      {s.title}
                    </span>
                    <span className="text-[11px] text-emerald-300">
                      {s.multiplier}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-1">{s.desc}</p>
                  <p className="text-[11px] text-slate-400">{s.lifestyle}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders / inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Target retirement age</span>
              <span className="text-slate-200 font-medium">{retireAge}</span>
            </div>
            <input
              type="range"
              min={Math.max(currentAge + 5, 40)}
              max={65}
              value={retireAge}
              onChange={(e) => setRetireAge(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>40</span>
              <span>50</span>
              <span>60</span>
              <span>65</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Expected portfolio returns (p.a.)</span>
              <span className="text-slate-200 font-medium">
                {expectedReturn}%
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={15}
              step={0.5}
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-500">
              Long-term equity heavy portfolios in India historically have done
              ~11–13% before inflation. Use lower numbers to be conservative.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Inflation assumption (p.a.)</span>
              <span className="text-slate-200 font-medium">{inflation}%</span>
            </div>
            <input
              type="range"
              min={4}
              max={8}
              step={0.5}
              value={inflation}
              onChange={(e) => setInflation(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-500">
              India has structurally higher inflation than developed markets;
              5–7% is a reasonable planning range.
            </p>
          </div>
        </div>

        {/* On-track summary */}
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="text-xs font-semibold text-emerald-300 mb-1">
            How does this compare to your current savings?
          </div>
          <p className="text-xs md:text-sm text-slate-100 mb-1">
            You currently save around{" "}
            <span className="font-semibold">
              {formatCurrency(Math.round(monthlySavings))}
            </span>{" "}
            per month. For your chosen FIRE style and retirement age, you need a
            SIP of roughly{" "}
            <span className="font-semibold">
              {formatCurrency(Math.round(sipRequired))}
            </span>
            .
          </p>
          <p className="text-[11px] md:text-xs text-slate-200">{onTrackFlag}</p>
        </div>
      </div>

      {/* Educational allocations */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 space-y-4">
        <h3 className="text-sm md:text-base font-semibold text-slate-50">
          How to translate this into actual investments
        </h3>
        <p className="text-xs md:text-sm text-slate-300 max-w-3xl">
          Below are simple, India-friendly allocation ideas. They are not
          recommendations for specific funds, but blueprints you can implement
          using low-cost index funds, high-quality debt funds, and gold / silver
          ETFs or Sovereign Gold Bonds.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {allocations.map((a, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 hover:border-emerald-400/60 hover:bg-slate-900 transition-colors"
            >
              <div className="text-xs text-emerald-300 mb-1">{a.mix}</div>
              <div className="text-sm font-semibold text-slate-50 mb-2">
                {a.title}
              </div>
              <ul className="space-y-1.5">
                {a.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-[11px] md:text-xs text-slate-300 leading-snug"
                  >
                    • {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500">
          Always double-check tax rules, fund costs and your own risk tolerance.
          When in doubt, take help from a SEBI-registered fee-only planner and
          then execute your plan through direct mutual fund platforms / brokers.
        </p>
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

function AuthLanding({ onLogin }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-xl w-full rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-sm font-semibold text-emerald-300">
            FH
          </div>
          <div>
            <div className="text-lg font-semibold tracking-wide">
              Findependence – Build Wealth. Retire Earlier.
            </div>
            <div className="text-xs text-slate-400">
              FinHealth – Indian Portfolio &amp; FIRE Coach
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-300">
          <p>
            Track your <span className="font-semibold">Portfolio FinHealth Index (PFI)</span>, savings
            rate and FIRE number, tailored for Indian investors.
          </p>
          <ul className="list-disc list-inside text-slate-400 text-xs md:text-sm space-y-1">
            <li>Map income, expenses, EMIs and investments in one place</li>
            <li>Check if your health + term cover is adequate</li>
            <li>Get FIRE targets and SIP ideas using Indian return assumptions</li>
          </ul>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onLogin}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 text-slate-950 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-400"
          >
            Sign in with Google to start
          </button>
          <p className="text-[11px] text-slate-500 text-center">
            We only use your email to keep your PFI journey and portfolio saved.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileOnboarding({ data, update, onContinue, onLogout, user }) {
  const handleContinue = () => {
    if (!data.age || data.age <= 0) {
      alert("Add your age to continue");
      return;
    }
    if (!data.employmentType) {
      alert("Select your employment type");
      return;
    }
    onContinue();
  };

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

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden md:inline text-slate-300 max-w-[160px] truncate">
            {user?.user_metadata?.full_name || user?.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 space-y-6">
          <div>
            <h1 className="text-xl font-semibold mb-1">
              Let&apos;s set up your profile
            </h1>
            <p className="text-sm text-slate-400">
              We&apos;ll use this to personalise your Portfolio FinHealth Index
              (PFI) and FIRE recommendations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">Your age</label>
              <input
                type="number"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={data.age}
                onChange={(e) =>
                  update({ age: Number(e.target.value) || 0 })
                }
                min={18}
                max={80}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">Dependents</label>
              <input
                type="number"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={data.dependents}
                onChange={(e) =>
                  update({ dependents: Number(e.target.value) || 0 })
                }
                min={0}
                max={10}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">
                Employment type
              </label>
              <select
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={data.employmentType}
                onChange={(e) => update({ employmentType: e.target.value })}
              >
                <option value="">Select</option>
                <option value="salaried">Salaried</option>
                <option value="business">
                  Self-employed / Business owner
                </option>
                <option value="freelancer">Freelancer / Consultant</option>
                <option value="student">Student</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">City type</label>
              <select
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={data.cityTier}
                onChange={(e) => update({ cityTier: e.target.value })}
              >
                <option value="metro">Metro / Tier 1</option>
                <option value="tier2">Tier 2</option>
                <option value="tier3">Tier 3 / Others</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-xs text-slate-400 max-w-md">
              You can tweak these later in the journey. Next, we&apos;ll map
              your income and spends to calculate your first PFI score.
            </p>
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 text-slate-950 px-5 py-2 text-sm font-semibold hover:bg-emerald-400"
            >
              Start my PFI journey
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;