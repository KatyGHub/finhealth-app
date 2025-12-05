import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import { formatCurrency } from "./utils/formatCurrency";

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

  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  // Main profile data (inputs)
  const [data, setData] = useState(INITIAL_DATA);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

    // PFI history (for chart)
  const [pfiHistory, setPfiHistory] = useState([]);
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const [isDeletingCheckpoint, setIsDeletingCheckpoint] = useState(false);

  // -------------------
  // Auth: session + listener
  // -------------------
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
      setData(INITIAL_DATA);
      setHasStarted(false);
      setPfiHistory([]);
    } catch (err) {
      console.error("Error logging out", err);
    }
  }

  // -------------------
  // Profile: load from Supabase when user logs in
  // -------------------
  useEffect(() => {
    if (!user) {
      setData(INITIAL_DATA);
      setHasStarted(false);
      setPfiHistory([]);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setIsProfileLoading(true);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("data")
        .eq("id", user.id)
        .single();

      if (!cancelled) {
        if (!error && profile?.data) {
          // Pull history out of the JSON blob, everything else goes into `data`
          const { __pfiHistory, ...rest } = profile.data;
          setData({ ...INITIAL_DATA, ...rest });
          setPfiHistory(Array.isArray(__pfiHistory) ? __pfiHistory : []);
          setHasStarted(true);
        }
        setIsProfileLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // -------------------
  // Save profile (+ embedded PFI history) to Supabase
  // -------------------
  async function saveProfileToSupabase(currentData, historyOverride) {
    if (!user) return;

    const payload = {
      id: user.id,
      data: {
        ...currentData,
        __pfiHistory: historyOverride ?? pfiHistory,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      console.error("Error saving profile", error);
    }
  }

  // Auto-save when inputs change (uses current pfiHistory)
  useEffect(() => {
    if (!user) return;
    if (isProfileLoading) return;

    const timer = setTimeout(() => {
      saveProfileToSupabase(data);
    }, 1200); // 1.2s debounce

    return () => clearTimeout(timer);
  }, [user, data, isProfileLoading]); // pfiHistory handled separately

  // -------------------
  // PFI checkpoints: save, delete, export
  // -------------------

  async function handleSaveCheckpoint(pfiValue) {
    if (!user) return;
    if (typeof pfiValue !== "number") return;

    const id =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const newPoint = {
      id,
      pfi: pfiValue,
      created_at: new Date().toISOString(),
    };

    const updatedHistory = [...pfiHistory, newPoint];

    setPfiHistory(updatedHistory);
    setIsSavingCheckpoint(true);

    try {
      // Best-effort write to dedicated table (optional)
      const { error: insertError } = await supabase
        .from("pfi_history")
        .insert({
          user_id: user.id,
          pfi: pfiValue,
        });

      if (insertError) {
        console.error("Error inserting into pfi_history", insertError);
      }

      // Source of truth: embed history in profile JSON
      await saveProfileToSupabase(data, updatedHistory);
    } catch (error) {
      console.error("Error saving PFI checkpoint", error);
      await saveProfileToSupabase(data, updatedHistory);
    } finally {
      setIsSavingCheckpoint(false);
    }
  }

  async function handleDeleteLastCheckpoint() {
    if (!user) return;
    if (!pfiHistory.length) return;

    const lastPoint = pfiHistory[pfiHistory.length - 1];

    const confirmDelete = window.confirm(
      `Delete the latest checkpoint (PFI ${Math.round(
        lastPoint.pfi
      )} saved on ${new Date(lastPoint.created_at).toLocaleDateString(
        "en-IN",
        { day: "2-digit", month: "short", year: "2-digit" }
      )})?`
    );

    if (!confirmDelete) return;

    const updatedHistory = pfiHistory.slice(0, -1);

    // Optimistic update
    setPfiHistory(updatedHistory);
    setIsDeletingCheckpoint(true);

    try {
      // Source of truth: profile JSON
      await saveProfileToSupabase(data, updatedHistory);
      // (Optional) you could also delete from pfi_history table by user_id + created_at if needed.
    } catch (error) {
      console.error("Error deleting last PFI checkpoint", error);
      // In case of error you could choose to restore the old history if you want stricter consistency.
    } finally {
      setIsDeletingCheckpoint(false);
    }
  }

  function handleExportHistory() {
    if (!pfiHistory || pfiHistory.length === 0) return;

    const header = "id,pfi,created_at\n";
    const rows = pfiHistory.map((p) =>
      `${p.id || ""},${Math.round(p.pfi)},${p.created_at}`
    );
    const csv = header + rows.join("\n");

    try {
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pfi_history.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting PFI history CSV", error);
    }
  }

  // -------------------
  // Local helpers
  // -------------------
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

  // -------------------
  // Flow gating
  // -------------------
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading your session…</div>
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

  // -------------------
  // Main dashboard
  // -------------------
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
              onSaveCheckpoint={handleSaveCheckpoint}
              isSavingCheckpoint={isSavingCheckpoint}
              onDeleteLastCheckpoint={handleDeleteLastCheckpoint}
              isDeletingCheckpoint={isDeletingCheckpoint}
              onExportHistory={handleExportHistory}
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
  const loansRef = useRef(null);
  const protectionRef = useRef(null);

  const sectionRefs = [
    personalRef,
    incomeRef,
    expensesRef,
    loansRef,
    protectionRef,
  ];

  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { key: "personal", label: "You & family" },
    { key: "income", label: "Income" },
    { key: "expenses", label: "Expenses" },
    { key: "loans", label: "Loans & EMIs" },
    { key: "protection", label: "Protection & investments" },
  ];

  useEffect(() => {
    const ref = sectionRefs[activeStep]?.current;
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeStep]); // no sectionRefs here to avoid unnecessary re-runs

  function goToStep(index) {
    setActiveStep(index);
  }

  function handleNumberChange(field) {
    return (e) => {
      const raw = e.target.value ?? "";
      const cleaned = raw.toString().replace(/,/g, "");
      const parsed = Number(cleaned);
      const value = Number.isFinite(parsed) ? parsed : 0;
      update({ [field]: value });
    };
  }

  // Normalise all numeric fields to avoid NaN
  const incomeSelf = Number(data.incomeSelf ?? 0);
  const incomeSpouse = Number(data.incomeSpouse ?? 0);
  const incomeOther = Number(data.incomeOther ?? 0);
  const incomeVariable = Number(data.incomeVariable ?? 0);

  const totalIncome =
    incomeSelf + incomeSpouse + incomeOther + incomeVariable;

  const safeFixedTotal = Number(fixedTotal ?? 0);
  const safeVariableTotal = Number(variableTotal ?? 0);

  const totalExpenses = safeFixedTotal + safeVariableTotal;
  const monthlySavings = Math.max(totalIncome - totalExpenses, 0);
  const savingsRate = totalIncome > 0 ? monthlySavings / totalIncome : 0;

  const totalEmi = Number(data.totalEmi ?? 0);
  const emiLoad = totalIncome > 0 ? totalEmi / totalIncome : 0;

  const emergencyFund = Number(data.emergencyFund ?? 0);
  const emergencyMonths =
    totalExpenses > 0 ? emergencyFund / totalExpenses : 0;

  const invBonds = Number(data.invBonds ?? 0);
  const invMF = Number(data.invMF ?? 0);
  const invStocks = Number(data.invStocks ?? 0);
  const invGold = Number(data.invGold ?? 0);
  const invOthers = Number(data.invOthers ?? 0);

  const totalInvestments =
    invBonds + invMF + invStocks + invGold + invOthers;

  function savingsLabel() {
    if (savingsRate <= 0.05) return "Very tight – <5% savings";
    if (savingsRate <= 0.15) return "Okay but improvable – 5–15% savings";
    if (savingsRate <= 0.30) return "Good – 15–30% savings";
    return "Strong – 30%+ savings";
  }

  function emiLabel() {
    if (emiLoad > 0.5) return "Very high EMI load – >50% of income";
    if (emiLoad > 0.4) return "High EMI load – 40–50% of income";
    if (emiLoad > 0.3) return "Moderate EMI load – 30–40% of income";
    if (emiLoad > 0.2) return "Comfortable EMI load – 20–30% of income";
    return "Light EMI load – <20% of income";
  }

  function emergencyLabel() {
    if (emergencyMonths < 1) return "Under 1 month – very fragile";
    if (emergencyMonths < 3) return "1–3 months – low buffer";
    if (emergencyMonths < 6) return "3–6 months – decent base";
    if (emergencyMonths < 12) return "6–12 months – solid safety net";
    return "12+ months – very strong buffer";
  }

  return (
    <div className="space-y-6">
      {/* Step progress strip */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-slate-200">
            PFI journey – step {activeStep + 1} of {steps.length}
          </div>
          <button
            type="button"
            onClick={onShowScore}
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            Go to your PFI score
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const completed = index < activeStep;
            const current = index === activeStep;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => goToStep(index)}
                className={
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] transition-colors " +
                  (current
                    ? "bg-emerald-500 text-slate-950 font-semibold"
                    : completed
                    ? "bg-slate-800 text-slate-100 border border-emerald-400/40"
                    : "bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800")
                }
              >
                <span
                  className={
                    "h-4 w-4 flex items-center justify-center rounded-full text-[10px] " +
                    (completed || current
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-slate-800 text-slate-300")
                  }
                >
                  {index + 1}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* 1. Personal */}
        <section
          ref={personalRef}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-slate-50">
                Step 1 · You & family
              </h2>
              <p className="text-xs md:text-sm text-slate-300">
                Basic context so we can size your protection, emergency fund
                and FIRE targets.
              </p>
            </div>
            <span className="hidden md:inline text-[11px] text-slate-500">
              Inputs here influence protection and FIRE assumptions.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Your age (years)
              </label>
              <input
                type="number"
                min={18}
                max={80}
                value={data.age ?? 0}
                onChange={handleNumberChange("age")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Number of financial dependents
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={data.dependents ?? 0}
                onChange={handleNumberChange("dependents")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Spouse, kids, parents you financially support.
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                City type
              </label>
              <select
                value={data.cityTier ?? "metro"}
                onChange={(e) => update({ cityTier: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="metro">Metro (Tier 1)</option>
                <option value="tier2">Tier 2 / 3</option>
                <option value="other">Other / Semi-urban</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Used for rough insurance and expense assumptions.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Next · Income
            </button>
          </div>
        </section>

        {/* 2. Income */}
<section
  ref={incomeRef}
  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 space-y-4"
>
  <div className="flex items-center justify-between gap-2">
    <div>
      <h2 className="text-sm md:text-base font-semibold text-slate-50">
        Step 2 · Monthly income
      </h2>
      <p className="text-xs md:text-sm text-slate-300">
        Regular monthly inflows after tax. This drives savings rate and
        PFI.
      </p>
    </div>
    <div className="text-right text-[11px] text-slate-400">
      Total income / month
      <div className="text-sm font-semibold text-slate-50">
        {formatCurrency(totalIncome)}
      </div>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <QuickAmountField
      label="Your fixed salary (in-hand, per month)"
      value={incomeSelf}
      onChange={(amount) => update({ incomeSelf: amount })}
      suggestions={[30000, 50000, 75000, 100000]}
    />

    <QuickAmountField
      label="Spouse income (optional)"
      value={incomeSpouse}
      onChange={(amount) => update({ incomeSpouse: amount })}
      suggestions={[20000, 40000, 60000, 80000]}
    />

    <QuickAmountField
      label="Other fixed income (rent, etc.)"
      value={incomeOther}
      onChange={(amount) => update({ incomeOther: amount })}
      suggestions={[5000, 10000, 20000, 30000]}
    />

    <QuickAmountField
      label="Variable / bonus averaged per month"
      value={incomeVariable}
      onChange={(amount) => update({ incomeVariable: amount })}
      suggestions={[5000, 10000, 20000, 50000]}
    />
    <p className="text-[11px] text-slate-500 md:col-span-2">
      If your bonus is once a year, divide by 12 and enter here. You can
      also tap any of the chips above to quickly fill typical amounts.
    </p>
  </div>

  <div className="flex justify-between">
    <button
      type="button"
      onClick={() => goToStep(0)}
      className="text-[11px] rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
    >
      Back · You & family
    </button>
    <button
      type="button"
      onClick={() => goToStep(2)}
      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-emerald-400"
    >
      Next · Expenses
    </button>
  </div>
</section>

       {/* 3. Expenses */}
<section
  ref={expensesRef}
  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 space-y-4"
>
  <div className="flex items-center justify-between gap-2">
    <div>
      <h2 className="text-sm md:text-base font-semibold text-slate-50">
        Step 3 · Monthly expenses
      </h2>
      <p className="text-xs md:text-sm text-slate-300">
        Split your spends into fixed “needs” and variable “wants” to see
        your true savings power.
      </p>
    </div>
    <div className="text-right text-[11px] text-slate-400">
      Fixed + variable / month
      <div className="text-sm font-semibold text-slate-50">
        {formatCurrency(totalExpenses)}
      </div>
    </div>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {/* Fixed */}
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-slate-200">
          Fixed expenses (needs)
        </div>
        <div className="text-[11px] text-slate-400">
          Total: {formatCurrency(safeFixedTotal)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <QuickAmountField
          label="Rent / home contribution"
          value={data.fixedRent ?? 0}
          onChange={(amount) => update({ fixedRent: amount })}
          suggestions={[10000, 15000, 20000, 30000]}
        />

        <QuickAmountField
          label="Groceries & essentials"
          value={data.fixedFood ?? 0}
          onChange={(amount) => update({ fixedFood: amount })}
          suggestions={[5000, 8000, 12000, 15000]}
        />

        <QuickAmountField
          label="Utilities (electricity, water, phone)"
          value={data.fixedUtilities ?? 0}
          onChange={(amount) => update({ fixedUtilities: amount })}
          suggestions={[2000, 3000, 5000, 8000]}
        />

        <QuickAmountField
          label="Medical / insurance premiums (monthly equivalent)"
          value={data.fixedMedical ?? 0}
          onChange={(amount) => update({ fixedMedical: amount })}
          suggestions={[1000, 2000, 3000, 5000]}
        />
      </div>
    </div>

    {/* Variable */}
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-slate-200">
          Variable expenses (wants)
        </div>
        <div className="text-[11px] text-slate-400">
          Total: {formatCurrency(safeVariableTotal)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <QuickAmountField
          label="Wifi, OTT, subscriptions"
          value={data.varWifi ?? 0}
          onChange={(amount) => update({ varWifi: amount })}
          suggestions={[500, 1000, 1500, 2000]}
        />

        <QuickAmountField
          label="Eating out & entertainment"
          value={data.varEntertainment ?? 0}
          onChange={(amount) => update({ varEntertainment: amount })}
          suggestions={[2000, 4000, 6000, 8000]}
        />

        <QuickAmountField
          label="Shopping & non-essentials"
          value={data.varShopping ?? 0}
          onChange={(amount) => update({ varShopping: amount })}
          suggestions={[2000, 5000, 8000, 12000]}
        />

        <QuickAmountField
          label="Misc. lifestyle spends"
          value={data.varMisc ?? 0}
          onChange={(amount) => update({ varMisc: amount })}
          suggestions={[1000, 3000, 5000, 8000]}
        />
      </div>
    </div>
  </div>

  <div className="flex justify-between">
    <button
      type="button"
      onClick={() => goToStep(1)}
      className="text-[11px] rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
    >
      Back · Income
    </button>
    <button
      type="button"
      onClick={() => goToStep(3)}
      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-emerald-400"
    >
      Next · Loans & EMIs
    </button>
  </div>
</section>

        {/* 4. Loans */}
        <section
          ref={loansRef}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-slate-50">
                Step 4 · Loans & EMIs
              </h2>
              <p className="text-xs md:text-sm text-slate-300">
                Capture your monthly EMIs and outstanding loan amounts. These
                heavily influence your PFI.
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              EMI load vs income
              <div className="text-sm font-semibold text-slate-50">
                {Math.round(emiLoad * 100) || 0}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Total EMIs / month (all loans combined)
              </label>
              <input
                type="number"
                min={0}
                value={totalEmi}
                onChange={handleNumberChange("totalEmi")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Home, car, personal, education, credit card EMI conversions.
              </p>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Total loan outstanding (approx.)
              </label>
              <input
                type="number"
                min={0}
                value={data.loanOutstanding ?? 0}
                onChange={handleNumberChange("loanOutstanding")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Helps us interpret how aggressive your debt situation is.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="text-[11px] text-slate-200 mb-1">
              EMI interpretation: {emiLabel()}
            </div>
            <p className="text-[11px] text-slate-400">
              As EMI % rises, PFI will punish you more unless protection and
              emergency fund are very strong. Closing high-interest or small
              loans early can significantly improve your score.
            </p>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="text-[11px] rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
            >
              Back · Expenses
            </button>
            <button
              type="button"
              onClick={() => goToStep(4)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Next · Protection & investments
            </button>
          </div>
        </section>

        {/* 5. Protection & investments */}
        <section
          ref={protectionRef}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-slate-50">
                Step 5 · Protection & investments
              </h2>
              <p className="text-xs md:text-sm text-slate-300">
                Your safety net (emergency fund + insurance) and growth engine
                (investments) complete the PFI picture.
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              Emergency fund
              <div className="text-sm font-semibold text-slate-50">
                {emergencyMonths > 0
                  ? `${emergencyMonths.toFixed(1)} months`
                  : "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Protection */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Protection layer
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Emergency fund (cash + liquid funds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={emergencyFund}
                    onChange={handleNumberChange("emergencyFund")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Target 6–12 months of expenses in safe, liquid options.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Health insurance cover (total, family)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={data.healthCover ?? 0}
                    onChange={handleNumberChange("healthCover")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Include corporate + personal policies. In metros, 10–20L is
                    usually a good range.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Term life cover sum assured
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={data.lifeCover ?? 0}
                    onChange={handleNumberChange("lifeCover")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Aim for 10–15× your annual income, especially if you have
                    dependents and loans.
                  </p>
                </div>
              </div>
            </div>

            {/* Investments */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-200">
                  Investment portfolio
                </div>
                <div className="text-[11px] text-slate-400">
                  Total: {formatCurrency(totalInvestments)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Bonds / fixed income
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={invBonds}
                    onChange={handleNumberChange("invBonds")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Mutual funds (equity / hybrid)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={invMF}
                    onChange={handleNumberChange("invMF")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Direct stocks
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={invStocks}
                    onChange={handleNumberChange("invStocks")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Gold / silver (SGB, ETFs, jewellery)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={invGold}
                    onChange={handleNumberChange("invGold")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Other investments (crypto, ESOPs, etc.)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={invOthers}
                    onChange={handleNumberChange("invOthers")}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="text-[11px] rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
            >
              Back · Loans & EMIs
            </button>
            <button
              type="button"
              onClick={onShowScore}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Show my PFI score
            </button>
          </div>
        </section>
      </div>

      {/* Quick summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5 space-y-2">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          Quick read of your current month
        </div>
        <p className="text-[11px] md:text-xs text-slate-300">
          Savings rate:{" "}
          <span className="font-semibold">
            {Math.round(savingsRate * 100) || 0}%
          </span>{" "}
          · {savingsLabel()}
        </p>
        <p className="text-[11px] md:text-xs text-slate-300">
          EMI load:{" "}
          <span className="font-semibold">
            {Math.round(emiLoad * 100) || 0}%
          </span>{" "}
          · {emiLabel()}
        </p>
        <p className="text-[11px] md:text-xs text-slate-300">
          Emergency fund:{" "}
          <span className="font-semibold">
            {emergencyMonths > 0
              ? `${emergencyMonths.toFixed(1)} months`
              : "0"}
          </span>{" "}
          · {emergencyLabel()}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          These three levers (savings, EMIs, emergency fund) have the biggest
          impact on your Portfolio FinHealth Index and FIRE readiness.
        </p>
      </div>
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

// Small helper to render each pillar bar
function PillarBar({ label, score, maxScore, suffix, valueText, meta }) {
  const pct = Math.min((score / maxScore) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="text-slate-400">
          {score}/{maxScore}
          {suffix ? ` · ${suffix}` : ""}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {valueText && (
        <div className="text-[11px] text-slate-400">{valueText}</div>
      )}
      {meta && (
        <div className="text-[11px] text-slate-500">{meta}</div>
      )}
    </div>
  );
}

// Minimal PFI history chart – replace your existing PfiHistoryChart with this
function PfiHistoryChart({ checkpoints = [] }) {
  if (!checkpoints || checkpoints.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-500">
        No checkpoints yet. Save your first PFI checkpoint to see history.
      </div>
    )
  }

  // Basic SVG geometry
  const svgWidth = 1200
  const svgHeight = 260

  const marginLeft = 60
  const marginRight = 40
  const marginTop = 20
  const marginBottom = 40

  const chartLeft = marginLeft
  const chartRight = svgWidth - marginRight
  const chartTop = marginTop
  const chartBottom = svgHeight - marginBottom

  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop

  const maxScore = 100
  const minScore = 0

  const clampScore = (v) => Math.min(maxScore, Math.max(minScore, v))

  const xStep =
    checkpoints.length > 1 ? chartWidth / (checkpoints.length - 1) : 0

  const getX = (index) => chartLeft + index * xStep

  const getY = (score) => {
    const value = clampScore(score)
    const ratio = (value - minScore) / (maxScore - minScore || 1)
    return chartBottom - ratio * chartHeight
  }

  // Line path
  const linePath = checkpoints
    .map((cp, i) => {
      const x = getX(i)
      const y = getY(cp.score)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // X-axis labels: compact dates
  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  })

  const labelEvery =
    checkpoints.length <= 6
      ? 1
      : checkpoints.length <= 12
      ? 2
      : 3

  return (
    <div className="relative mt-4 h-[260px] w-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={svgWidth}
          height={svgHeight}
          fill="transparent"
        />

        {/* Axes */}
        {/* Y axis */}
        <line
          x1={chartLeft}
          y1={chartTop}
          x2={chartLeft}
          y2={chartBottom}
          stroke="#1f2937"
          strokeWidth={1}
        />
        {/* X axis */}
        <line
          x1={chartLeft}
          y1={chartBottom}
          x2={chartRight}
          y2={chartBottom}
          stroke="#1f2937"
          strokeWidth={1}
        />

        {/* Y-axis ticks and labels (0, 50, 100) – subtle, minimal */}
        {[0, 50, 100].map((value) => {
          const y = getY(value)
          return (
            <g key={value}>
              <line
                x1={chartLeft - 4}
                y1={y}
                x2={chartLeft}
                y2={y}
                stroke="#4b5563"
                strokeWidth={1}
              />
              <text
                x={chartLeft - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="#9ca3af"
              >
                {value}
              </text>
            </g>
          )
        })}

        {/* Y-axis label – vertical, small */}
        <text
          x={20}
          y={(chartTop + chartBottom) / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#6b7280"
          transform={`rotate(-90 20 ${(chartTop + chartBottom) / 2})`}
        >
          PFI SCORE
        </text>

        {/* X-axis labels (dates) */}
        {checkpoints.map((cp, i) => {
          if (i % labelEvery !== 0 && i !== checkpoints.length - 1) return null

          const x = getX(i)
          let label
          try {
            label = formatter.format(new Date(cp.date))
          } catch {
            label = cp.date
          }

          return (
            <g key={cp.date + i}>
              <line
                x1={x}
                y1={chartBottom}
                x2={x}
                y2={chartBottom + 4}
                stroke="#4b5563"
                strokeWidth={1}
              />
              <text
                x={x}
                y={chartBottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* PFI line – minimal, no labels on points */}
        <path
          d={linePath}
          fill="none"
          stroke="#22c55e"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Point markers – very small dots */}
        {checkpoints.map((cp, i) => {
          const x = getX(i)
          const y = getY(cp.score)
          return (
            <circle
              key={cp.date + i}
              cx={x}
              cy={y}
              r={3}
              fill="#ff0000ff"
              stroke="#020617"
              strokeWidth={1.5}
            />
          )
        })}
      </svg>
    </div>
  )
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
  onDeleteLastCheckpoint,
  isDeletingCheckpoint,
  onExportHistory,
}) {
  // Core metrics
  const savingsRate = totalIncome > 0 ? monthlySavings / totalIncome : 0;
  const savingsPct = Math.round(savingsRate * 100) || 0;

  const monthlyExpenses = totalExpenses;
  const emergencyMonths =
    monthlyExpenses > 0 ? data.emergencyFund / monthlyExpenses : 0;
  const efMonthsRounded = emergencyMonths.toFixed(1);

  const emiRatio = totalIncome > 0 ? data.totalEmi / totalIncome : 0;
  const emiPct = Math.round(emiRatio * 100) || 0;

  const annualIncome = totalIncome * 12;
  const targetLifeCover = annualIncome * 15; // 15x annual income
  const actualCover = Math.max(data.lifeCover + data.healthCover, 0);
  const coverGapPct =
    targetLifeCover > 0
      ? Math.max(
          0,
          ((targetLifeCover - actualCover) / targetLifeCover) * 100
        )
      : 100;

  // Stricter scoring
  let savingsScore = 0;
  if (savingsRate >= 0.3) savingsScore = 40;
  else if (savingsRate >= 0.2) savingsScore = 30;
  else if (savingsRate >= 0.1) savingsScore = 15;
  else if (savingsRate > 0) savingsScore = 5;

  let efScore = 0;
  if (emergencyMonths >= 6) efScore = 20;
  else if (emergencyMonths >= 3) efScore = 12;
  else if (emergencyMonths > 0) efScore = 5;

  let emiScore = 0;
  if (emiRatio <= 0.2) emiScore = 20;
  else if (emiRatio <= 0.3) emiScore = 15;
  else if (emiRatio <= 0.4) emiScore = 8;
  else if (emiRatio <= 0.5) emiScore = 3;

  let protectionScore = 0;
  if (coverGapPct <= 0) protectionScore = 20;
  else if (coverGapPct <= 25) protectionScore = 15;
  else if (coverGapPct <= 50) protectionScore = 8;
  else if (coverGapPct <= 75) protectionScore = 3;

  const pfiScore = Math.round(
    savingsScore + efScore + emiScore + protectionScore
  );

  // History insights
  const hasHistory = pfiHistory && pfiHistory.length > 0;
  // Data for chart: oldest → latest, { date, score }
  const checkpointsForChart = (pfiHistory ?? [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((p) => ({
      date: p.created_at,
      score: Math.round(p.pfi),
    }));

  function formatDateLabel(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  }

  let bestPFI = null;
  let bestDateLabel = "";
  let avgLast5 = null;
  let latestPFI = null;
  let previousPFI = null;
  let deltaLabel = "";
  let deltaClass = "text-slate-300";
  let oldestDateLabel = "";
  let latestDateLabel = "";

  if (hasHistory) {
    const sorted = [...pfiHistory].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const count = sorted.length;

    const lastPoint = sorted[count - 1];
    const prevPoint = count > 1 ? sorted[count - 2] : null;

    latestPFI = Math.round(lastPoint.pfi);
    previousPFI = prevPoint ? Math.round(prevPoint.pfi) : null;

    if (previousPFI == null || latestPFI === previousPFI) {
      deltaLabel = "No change vs last checkpoint";
      deltaClass = "text-slate-300";
    } else if (latestPFI > previousPFI) {
      const diff = latestPFI - previousPFI;
      deltaLabel = `Up by ${diff} vs last checkpoint`;
      deltaClass = "text-emerald-300";
    } else {
      const diff = previousPFI - latestPFI;
      deltaLabel = `Down by ${diff} vs last checkpoint`;
      deltaClass = "text-rose-300";
    }

    // Best PFI
    let bestPoint = sorted[0];
    for (const p of sorted) {
      if (p.pfi > bestPoint.pfi) bestPoint = p;
    }
    bestPFI = Math.round(bestPoint.pfi);
    bestDateLabel = formatDateLabel(bestPoint.created_at);

    // Avg of last 5
    const lastFive = sorted.slice(-5);
    const avg =
      lastFive.reduce((sum, p) => sum + (Number(p.pfi) || 0), 0) /
      lastFive.length;
    avgLast5 = Math.round(avg);

    oldestDateLabel = formatDateLabel(sorted[0].created_at);
    latestDateLabel = formatDateLabel(sorted[count - 1].created_at);
  }

  return (
    <div className="space-y-6">
      {/* Main PFI + pillars */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Portfolio FinHealth Index (PFI)
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Composite score combining savings strength, emergency fund, EMI
              stress and protection cover – tuned for Indian investors.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSaveCheckpoint(pfiScore)}
            disabled={isSavingCheckpoint}
            className="self-start inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSavingCheckpoint ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                Saving…
              </>
            ) : (
              "Save this PFI checkpoint"
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-6">
          {/* Score card */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 flex flex-col items-center justify-center text-center">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
              Current PFI
            </div>
            <div className="text-5xl font-semibold text-emerald-400">
              {pfiScore}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 mb-3">
              / 100
            </div>
            <p className="text-[11px] text-slate-400 max-w-[170px]">
              Higher is better. Focus on improving one pillar at a time.
            </p>
          </div>

          {/* Pillars */}
          <div className="space-y-4">
            <PillarBar
              label="Savings strength"
              score={savingsScore}
              maxScore={40}
              suffix={`${savingsPct}%`}
              valueText={`Aim for 20–30%+ savings rate for aggressive FIRE. You’re at ${savingsPct}%.`}
            />

            <PillarBar
              label="Emergency fund"
              score={efScore}
              maxScore={20}
              suffix={`${efMonthsRounded} months`}
              valueText={`Target 6 months of expenses in liquid funds. You’re at ${efMonthsRounded} months.`}
            />

            <PillarBar
              label="EMI load"
              score={emiScore}
              maxScore={20}
              suffix={`${emiPct}%`}
              valueText={`Keep total EMIs under 30% of take-home. You’re at ${emiPct}%.`}
            />

            <PillarBar
              label="Protection cover"
              score={protectionScore}
              maxScore={20}
              suffix={`${Math.round(coverGapPct)}% gap`}
              valueText="Life cover of ~15× annual income + strong health insurance gives your family robust protection."
            />
          </div>
        </div>
      </section>

      {/* History section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-6 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              PFI history
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              We plot each checkpoint you save. Simple line, oldest on the
              left, latest on the right.
            </p>
          </div>

          {hasHistory && (
            <div className="flex flex-wrap gap-2 text-[11px] md:text-xs">
              <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 flex items-baseline gap-1 text-slate-200">
                <span className="text-slate-400">Best</span>
                <span className="font-semibold text-emerald-300">
                  {bestPFI}
                </span>
                <span className="text-slate-500 text-[10px]">
                  {bestDateLabel}
                </span>
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 flex items-baseline gap-1 text-slate-200">
                <span className="text-slate-400">Last 5 avg</span>
                <span className="font-semibold">
                  {avgLast5 != null ? avgLast5 : "-"}
                </span>
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 flex items-baseline gap-1">
                <span className="text-slate-400">Trend</span>
                <span className={`font-semibold ${deltaClass}`}>
                  {deltaLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        <PfiHistoryChart checkpoints={checkpointsForChart} />

        {hasHistory && (
          <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] text-slate-500">
            <div>
              Oldest: {oldestDateLabel} · Latest: {latestDateLabel}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Checkpoints: {pfiHistory.length} · Latest PFI:{" "}
                {latestPFI}
              </span>
              <button
                type="button"
                onClick={onExportHistory}
                className="text-[11px] rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={onDeleteLastCheckpoint}
                disabled={isDeletingCheckpoint || !pfiHistory.length}
                className="text-[11px] rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingCheckpoint ? "Deleting…" : "Delete last"}
              </button>
            </div>
          </div>
        )}

        {!hasHistory && (
          <div className="mt-2 text-[11px] text-slate-500">
            Once you save a few checkpoints, we’ll show the oldest and
            latest dates plus quick stats here.
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- FIRE / SWOT sections ---------- */

function FireTab({ data, totalExpenses, totalInvestments, monthlySavings }) {
  const currentAge = Number(data.age || 30);

  const [fireStyle, setFireStyle] = useState("standard"); // lean | standard | fat
  const [retireAge, setRetireAge] = useState(
    Math.max(currentAge + 20, 55) // default that feels reasonable
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
    yearsToRetire > 0
      ? currentCorpus * Math.pow(1 + rAnnual, yearsToRetire)
      : currentCorpus;

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
      ? "Already funded for this goal at current assumptions."
      : monthlySavings >= sipRequired * 0.9
      ? "Roughly on track at this savings pace."
      : "You’ll need either higher SIPs, more years, or a lower FIRE lifestyle to reach this goal.";

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
      multiplier: "≈30×+",
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

  // ---------- Quick what-if calculations ----------
  const safeMonthlySIP = Math.max(monthlySavings, 0);

  const fvWithCurrentSIP =
    sipFactor > 0
      ? futureValueCurrentCorpus + safeMonthlySIP * sipFactor
      : futureValueCurrentCorpus;

  const corpusShortfallCurrent = Math.max(0, targetCorpus - fvWithCurrentSIP);

  const sipPlus5k = safeMonthlySIP + 5000;
  const fvWithPlus5k =
    sipFactor > 0
      ? futureValueCurrentCorpus + sipPlus5k * sipFactor
      : futureValueCurrentCorpus;
  const corpusShortfallPlus5k = Math.max(0, targetCorpus - fvWithPlus5k);

  const altRAnnual = 0.10;
  const altRMonthly = altRAnnual / 12;
  const altSipFactor =
    nMonths > 0 && altRMonthly > 0
      ? ((Math.pow(1 + altRMonthly, nMonths) - 1) / altRMonthly) * (1 + altRMonthly)
      : 0;
  const futureValueCurrentCorpusAlt =
    yearsToRetire > 0
      ? currentCorpus * Math.pow(1 + altRAnnual, yearsToRetire)
      : currentCorpus;
  const altSipRequired =
    altSipFactor > 0
      ? Math.max(0, (targetCorpus - futureValueCurrentCorpusAlt) / altSipFactor)
      : 0;

  // ---------- Current allocation breakdown ----------
  const equity = (data.invMF || 0) + (data.invStocks || 0);
  const debt = data.invBonds || 0;
  const goldSilver = data.invGold || 0;
  const others = data.invOthers || 0;

  const invTotal =
    totalInvestments && totalInvestments > 0
      ? totalInvestments
      : equity + debt + goldSilver + others;

  const pct = (val) => (invTotal > 0 ? (val / invTotal) * 100 : 0);

  const equityPct = pct(equity);
  const debtPct = pct(debt);
  const goldPct = pct(goldSilver);
  const othersPct = pct(others);

  let mixSummary = "";
  if (!invTotal || invTotal <= 0) {
    mixSummary = "Once you add your investment amounts, we’ll show your mix here.";
  } else if (equityPct >= 60 && equityPct <= 80 && goldPct <= 15) {
    mixSummary =
      "Your mix is broadly FIRE-friendly – equity-heavy with some stabilisers. Ensure the equity chunk is mostly in diversified, low-cost funds.";
  } else if (equityPct < 40) {
    mixSummary =
      "Equity allocation looks on the lower side for long-term FIRE. Consider gradually shifting fresh money towards equity funds while keeping debt for stability.";
  } else if (goldPct > 20) {
    mixSummary =
      "Gold + silver are a bit heavy relative to typical FIRE plans. You can keep some for diversification, but avoid making it the core growth driver.";
  } else if (debtPct > 50) {
    mixSummary =
      "Debt portion is high. This is safer, but may drag returns if you’re still far from retirement. Keep essential goals in debt and let surplus lean more towards equity.";
  } else {
    mixSummary =
      "Your mix is workable. Fine-tune over time: keep equity as the growth engine, quality debt for stability, and gold/silver as a small hedge.";
  }

  // ---------- New: Tax & protection heuristics (India) ----------
  const MAX_80C = 150000; // old regime, typical cap for many tax-saving instruments
  const monthlyToMax80C = MAX_80C / 12; // ≈ 12.5k/month

  const canComfortablyMax80C = monthlySavings >= monthlyToMax80C;

  // Simple health cover band based on city + dependents
  function getHealthCoverBand(cityTier, age, dependents) {
    const deps = Number(dependents || 0);
    const base =
      cityTier === "metro"
        ? 1500000
        : cityTier === "tier2"
        ? 1000000
        : 750000;

    const depFactor = 1 + Math.min(deps, 3) * 0.25; // max +75%
    const ageFactor = age >= 45 ? 1.25 : 1;

    const lower = base * depFactor * ageFactor;
    const upper = lower * 1.5;

    return {
      lower,
      upper,
    };
  }

  const { lower: healthLower, upper: healthUpper } = getHealthCoverBand(
    data.cityTier || "metro",
    currentAge,
    data.dependents || 0
  );

  let healthComment = "";
  if (!data.healthCover || data.healthCover <= 0) {
    healthComment =
      "You haven’t entered any health cover. For most Indian families, dedicated health insurance is a must-have before aggressive investing.";
  } else if (data.healthCover < healthLower * 0.6) {
    healthComment =
      "Your health cover looks on the lower side for your city and family size. Consider a higher base cover or a top-up policy over your existing cover.";
  } else if (data.healthCover > healthUpper * 1.2) {
    healthComment =
      "Your health cover looks quite strong relative to typical ranges. Focus next on building investments and closing high-interest debt.";
  } else {
    healthComment =
      "Your health cover looks broadly reasonable. Review every few years as medical costs and lifestyle change.";
  }

  const annualSavingsApprox = monthlySavings * 12;

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
            In rupees at retirement age, after factoring inflation.
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
            If you prefer lump sum over SIP, this is the approximate extra
            amount you need now.
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
              Long-term equity heavy portfolios in India often sit around
              11–13% before inflation. Use lower numbers if you want to be
              conservative.
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
              India typically has higher inflation than developed markets;
              5–7% is a reasonable planning range for long-term goals.
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

        {/* Quick what-if insights */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="text-xs font-semibold text-slate-200 mb-1">
              What if you invest your full monthly savings as SIP?
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Treat your current savings (~
              {formatCurrency(Math.round(safeMonthlySIP))}/month) as a FIRE
              dedicated SIP.
            </p>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span>Projected corpus at {retireAge}</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(fvWithCurrentSIP))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shortfall vs FIRE target</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(corpusShortfallCurrent))}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              If the shortfall is large, either increase SIP, push retirement
              out a bit, or consider a leaner FIRE lifestyle.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            <div className="text-xs font-semibold text-slate-200 mb-1">
              What if returns are only 10% or you add ₹5K more SIP?
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              See how lower returns or a slightly higher SIP change the picture.
            </p>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span>SIP needed at 10% returns</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(altSipRequired))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Using savings + ₹5K as SIP</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(sipPlus5k))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Corpus with (savings + ₹5K) SIP</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(fvWithPlus5k))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shortfall with (savings + ₹5K) SIP</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(corpusShortfallPlus5k))}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              This shows how sensitive your plan is to returns and how much a
              small bump in SIP can close the gap.
            </p>
          </div>
        </div>
      </div>

      {/* Your current allocation visual */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 space-y-3">
        <h3 className="text-sm md:text-base font-semibold text-slate-50">
          Your current allocation
        </h3>
        <p className="text-xs md:text-sm text-slate-300 max-w-3xl">
          This is how your existing investments are split between equity, debt,
          gold/silver and everything else. For most long-term FIRE journeys,
          equity is the growth engine, debt provides stability, and gold/silver
          act as a small hedge.
        </p>

        <div className="mt-3 space-y-3">
          <div className="h-4 rounded-full bg-slate-800 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500/90"
              style={{ width: `${Math.max(0, Math.min(equityPct, 100))}%` }}
            />
            <div
              className="h-full bg-sky-500/80"
              style={{ width: `${Math.max(0, Math.min(debtPct, 100))}%` }}
            />
            <div
              className="h-full bg-amber-400/80"
              style={{ width: `${Math.max(0, Math.min(goldPct, 100))}%` }}
            />
            <div
              className="h-full bg-fuchsia-500/80"
              style={{ width: `${Math.max(0, Math.min(othersPct, 100))}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-slate-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <div>
                <div className="font-semibold">Equity (MF + stocks)</div>
                <div className="text-slate-400">
                  {invTotal > 0
                    ? `${equityPct.toFixed(1)}% · ${formatCurrency(equity)}`
                    : "Add amounts above to see this"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <div>
                <div className="font-semibold">Debt / fixed income</div>
                <div className="text-slate-400">
                  {invTotal > 0
                    ? `${debtPct.toFixed(1)}% · ${formatCurrency(debt)}`
                    : "Bonds, FDs, PPF, etc."}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <div>
                <div className="font-semibold">Gold / silver</div>
                <div className="text-slate-400">
                  {invTotal > 0
                    ? `${goldPct.toFixed(1)}% · ${formatCurrency(goldSilver)}`
                    : "SGBs, Gold ETFs, jewellery"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
              <div>
                <div className="font-semibold">Other</div>
                <div className="text-slate-400">
                  {invTotal > 0
                    ? `${othersPct.toFixed(1)}% · ${formatCurrency(others)}`
                    : "Crypto, ESOPs, etc."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-1">{mixSummary}</p>
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

      {/* New: tax & protection checklist (India) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 space-y-4">
        <h3 className="text-sm md:text-base font-semibold text-slate-50">
          Tax and protection checklist (India)
        </h3>
        <p className="text-xs md:text-sm text-slate-300 max-w-3xl">
          This isn’t tax advice, but a simple checklist to pair your FIRE plan
          with common Indian tax and protection levers. Use it to ask better
          questions to your CA / advisor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 80C-like bucket */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-100">
              1. Annual tax-saving bucket around ₹1.5L
            </div>
            <p className="text-[11px] text-slate-300">
              Typical old-regime tax rules allow about ₹1.5L/year of certain
              investments and expenses to reduce taxable income.
            </p>
            <p className="text-[11px] text-slate-300">
              That’s roughly{" "}
              <span className="font-semibold">
                {formatCurrency(Math.round(monthlyToMax80C))}
              </span>{" "}
              per month.
            </p>
            <p className="text-[11px] text-slate-400">
              With your current savings of{" "}
              <span className="font-semibold">
                {formatCurrency(Math.round(monthlySavings))}
              </span>{" "}
              per month:
            </p>
            <ul className="text-[11px] text-slate-300 space-y-1.5">
              <li>
                •{" "}
                {canComfortablyMax80C
                  ? "You could comfortably earmark ~₹12–13K/month into tax-efficient instruments (EPF/PPF/ELSS/home-loan principal, etc.)."
                  : "If you can gradually move towards saving ~₹12–13K/month, you’ll be able to fully utilise this bucket."}
              </li>
              <li>
                • Prioritise this before very aggressive non-tax-efficient
                investing, especially if you’re in a higher slab.
              </li>
            </ul>
          </div>

          {/* Health cover + 80D style */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-100">
              2. Health cover and premiums
            </div>
            <p className="text-[11px] text-slate-300">
              Current health cover (self + family):{" "}
              <span className="font-semibold">
                {formatCurrency(data.healthCover || 0)}
              </span>
            </p>
            <p className="text-[11px] text-slate-300">
              For your profile, a rough working band is around{" "}
              <span className="font-semibold">
                {formatCurrency(Math.round(healthLower))} –{" "}
                {formatCurrency(Math.round(healthUpper))}
              </span>{" "}
              of total cover.
            </p>
            <p className="text-[11px] text-slate-400">{healthComment}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              In practice, health insurance premiums for this cover often fit
              within the commonly used tax-deduction buckets for medical
              insurance. The main point: ensure cover is adequate first, tax
              benefit second.
            </p>
          </div>

          {/* How savings splits between FIRE and tax */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-100">
              3. Splitting your monthly savings smartly
            </div>
            <p className="text-[11px] text-slate-300">
              Approx annual savings at this pace:{" "}
              <span className="font-semibold">
                {formatCurrency(Math.round(annualSavingsApprox))}
              </span>
              .
            </p>
            <p className="text-[11px] text-slate-300">
              A simple way to think about your monthly savings:
            </p>
            <ul className="text-[11px] text-slate-300 space-y-1.5">
              <li>
                • First, secure{" "}
                <span className="font-semibold">
                  6–12 months of expenses as emergency fund
                </span>{" "}
                (liquid funds + bank).
              </li>
              <li>
                • Then, route up to ~₹12–13K/month into{" "}
                <span className="font-semibold">
                  tax-efficient long-term buckets
                </span>{" "}
                (EPF/PPF/ELSS/retirement-focused products).
              </li>
              <li>
                • Remaining savings go into your{" "}
                <span className="font-semibold">
                  FIRE equity / debt / gold plan
                </span>{" "}
                from the allocation ideas above.
              </li>
            </ul>
            <p className="text-[11px] text-slate-500 mt-1">
              Over time, this helps you align three things together: emergency
              safety, tax optimisation, and long-term wealth building.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Always confirm tax details (old vs new regime, slab, age, parents’
          cover, etc.) with a CA or a trusted tax resource before making
          decisions. Use this section as a thinking aid, not a filing guide.
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
  const [actions, setActions] = useState([]);

  const savingsRate = totalIncome > 0 ? monthlySavings / totalIncome : 0;
  const emergencyMonths =
    totalExpenses > 0 ? data.emergencyFund / totalExpenses : 0;
  const emiLoad = totalIncome > 0 ? data.totalEmi / totalIncome : 0;

  const annualIncome = totalIncome * 12;
  const targetLifeCover = annualIncome * 15; // 15x annual income
  const lifeCoverRatio =
    targetLifeCover > 0 ? data.lifeCover / targetLifeCover : 0;

  const baseHealthTarget = 750000;
  const depFactor = 1 + (data.dependents || 0) * 0.25;
  const metroBump = data.cityTier === "metro" ? 1.3 : 1;
  const targetHealthCover = baseHealthTarget * depFactor * metroBump;
  const healthCoverRatio =
    targetHealthCover > 0 ? data.healthCover / targetHealthCover : 0;

  const avgProtectionRatio = (lifeCoverRatio + healthCoverRatio) / 2;

  // -----------------------
  // Build SWOT items
  // -----------------------
  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];

  // Savings
  if (savingsRate >= 0.3) {
    strengths.push({
      id: "s_savings_high",
      label:
        "High savings rate – strong monthly surplus available for SIPs and prepayments.",
    });
  } else if (savingsRate >= 0.15) {
    strengths.push({
      id: "s_savings_ok",
      label:
        "Decent savings rate – with a few tweaks you can accelerate your FIRE journey.",
    });
  } else {
    weaknesses.push({
      id: "w_savings_low",
      label:
        "Low savings rate – most of your income is getting consumed by monthly expenses.",
    });
  }

  // Emergency fund
  if (emergencyMonths >= 6) {
    strengths.push({
      id: "s_emergency_strong",
      label:
        "Healthy emergency fund – at least 6 months of expenses covered in liquid assets.",
    });
  } else if (emergencyMonths >= 3) {
    opportunities.push({
      id: "o_emergency_mid",
      label:
        "Emergency fund between 3–6 months – good base, but pushing towards 9–12 months increases safety.",
    });
  } else {
    weaknesses.push({
      id: "w_emergency_low",
      label:
        "Emergency fund under 3 months – vulnerable to job loss, medical events or business slowdowns.",
    });
  }

  // EMI load
  if (emiLoad < 0.2) {
    strengths.push({
      id: "s_emi_low",
      label:
        "Low EMI burden – less than 20% of income, gives you flexibility to step up investments.",
    });
  } else if (emiLoad <= 0.4) {
    opportunities.push({
      id: "o_emi_mid",
      label:
        "Moderate EMI load – consider occasional prepayments when bonuses or windfalls come in.",
    });
  } else {
    threats.push({
      id: "t_emi_high",
      label:
        "High EMI load – more than 40% of income to EMIs increases stress and dependency on salary.",
    });
  }

  // Protection
  if (avgProtectionRatio >= 0.9) {
    strengths.push({
      id: "s_protection_good",
      label:
        "Protection almost on target – term + health cover close to recommended levels.",
    });
  } else if (lifeCoverRatio < 0.5 || healthCoverRatio < 0.5) {
    weaknesses.push({
      id: "w_protection_gap",
      label:
        "Protection gap – term or health cover is significantly below suggested levels for your income and family size.",
    });
  } else {
    opportunities.push({
      id: "o_protection_tune",
      label:
        "Protection can be fine-tuned – you are partially covered but can optimise term and health cover further.",
    });
  }

  // Corpus vs income
  if (totalInvestments >= annualIncome * 3) {
    strengths.push({
      id: "s_corpus_meaningful",
      label:
        "Meaningful invested corpus – compounding can start doing heavier lifting vs fresh contributions.",
    });
  } else if (totalInvestments <= annualIncome) {
    threats.push({
      id: "t_corpus_small",
      label:
        "Invested corpus is still small compared to your annual income – early stage of the wealth curve.",
    });
  }

  // -----------------------
  // Suggestion blueprints (linked to SWOT ids)
  // -----------------------
  const suggestionBlueprints = [
    {
      key: "act_savings_boost",
      title: "Increase savings rate by 5–10 percentage points.",
      detail:
        "Pick 1–2 big-ticket wants (eating out, subscriptions, impulse shopping), fix a monthly cap and move the freed-up amount into a SIP on salary day.",
      tag: "Cashflow",
      relatedSwotIds: ["w_savings_low"],
    },
    {
      key: "act_auto_sip",
      title: "Automate a fixed SIP on salary day.",
      detail:
        "Instead of saving what is left, invest first. Set up an auto-SIP a day after salary credit so saving becomes the default behaviour.",
      tag: "Habits",
      relatedSwotIds: ["w_savings_low", "s_savings_ok"],
    },
    {
      key: "act_build_emergency",
      title: "Build or top up emergency fund to at least 6 months.",
      detail:
        "Move towards 6–9 months of expenses in liquid mutual funds / high-quality savings. Start by tagging 1–2 SIPs or lumpsums as 'emergency-only'.",
      tag: "Safety net",
      relatedSwotIds: ["w_emergency_low", "o_emergency_mid"],
    },
    {
      key: "act_emi_prepay",
      title: "Plan a structured EMI prepayment strategy.",
      detail:
        "Target the highest-interest / smallest-loan EMI first. Use bonuses, tax refunds or RSU vests to make one prepayment per year until EMI load is below ~30%.",
      tag: "Debt",
      relatedSwotIds: ["t_emi_high", "o_emi_mid"],
    },
    {
      key: "act_term_cover",
      title: "Right-size term insurance to 10–15× annual income.",
      detail:
        "Shortlist 2–3 term plans from IRDAI-regulated insurers, compare claim settlement ratios and premium difference, and lock cover till at least age 60–65.",
      tag: "Protection",
      relatedSwotIds: ["w_protection_gap", "o_protection_tune"],
    },
    {
      key: "act_health_cover",
      title: "Ensure adequate family floater health cover.",
      detail:
        "Aim for 10–15L family floater in metros; add super-top-up if corporate cover is temporary or small. This protects your corpus from medical shocks.",
      tag: "Protection",
      relatedSwotIds: ["w_protection_gap", "o_protection_tune"],
    },
    {
      key: "act_stepup_sip",
      title: "Plan a yearly SIP step-up of 5–10%.",
      detail:
        "Every appraisal cycle, increase SIPs by at least 5–10% even if your expenses also rise. This keeps your FIRE plan ahead of lifestyle creep.",
      tag: "Investing",
      relatedSwotIds: ["t_corpus_small", "s_corpus_meaningful"],
    },
  ];

  // Helper: find suggestions that relate to a given SWOT item id
  function suggestionsForSwotId(swotId) {
    return suggestionBlueprints.filter((s) =>
      s.relatedSwotIds.includes(swotId)
    );
  }

  // -----------------------
  // Actions state
  // -----------------------
  function handleAddAction(blueprint) {
    setActions((prev) => {
      if (prev.some((a) => a.key === blueprint.key)) return prev;
      return [
        ...prev,
        {
          key: blueprint.key,
          title: blueprint.title,
          detail: blueprint.detail,
          tag: blueprint.tag,
          done: false,
        },
      ];
    });
  }

  function toggleActionDone(key) {
    setActions((prev) =>
      prev.map((a) =>
        a.key === key ? { ...a, done: !a.done } : a
      )
    );
  }

  function clearCompletedActions() {
    setActions((prev) => prev.filter((a) => !a.done));
  }

  const nextMoves = actions.filter((a) => !a.done).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Next 3 moves card */}
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-sm md:text-base font-semibold text-slate-50">
              Your next 3 moves
            </h2>
            {nextMoves.length === 0 ? (
              <p className="text-xs md:text-sm text-slate-200">
                Convert any weakness or opportunity into an action using
                “Add as action”. Your top 3 active moves will show up here.
              </p>
            ) : (
              <p className="text-xs md:text-sm text-slate-200">
                These are the highest-leverage changes based on your current
                numbers. Mark them done when you actually execute them.
              </p>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Focus on a small number of concrete steps instead of trying to
            fix everything at once.
          </div>
        </div>

        {nextMoves.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {nextMoves.map((a) => (
              <div
                key={a.key}
                className="rounded-2xl border border-emerald-400/60 bg-slate-950/80 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-400/60 text-emerald-300">
                    {a.tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActionDone(a.key)}
                    className={
                      "text-[11px] px-2 py-0.5 rounded-full border " +
                      (a.done
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-slate-600 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    {a.done ? "Done" : "Mark done"}
                  </button>
                </div>
                <div className="text-xs font-semibold text-slate-50">
                  {a.title}
                </div>
                <div className="text-[11px] text-slate-300">
                  {a.detail}
                </div>
              </div>
            ))}
          </div>
        )}

        {actions.some((a) => a.done) && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearCompletedActions}
              className="text-[11px] text-slate-300 underline underline-offset-2 hover:text-slate-100"
            >
              Clear completed actions
            </button>
          </div>
        )}
      </div>

      {/* SWOT grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
          <div className="text-xs font-semibold text-emerald-300">
            Strengths
          </div>
          {strengths.length === 0 ? (
            <p className="text-xs text-slate-400">
              Once you build stronger savings, emergency fund, low EMI and
              good protection, those will be listed here.
            </p>
          ) : (
            <ul className="space-y-2">
              {strengths.map((s) => (
                <li
                  key={s.id}
                  className="text-[11px] md:text-xs text-slate-200"
                >
                  • {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Weaknesses */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
          <div className="text-xs font-semibold text-rose-300">
            Weaknesses
          </div>
          {weaknesses.length === 0 ? (
            <p className="text-xs text-slate-400">
              No critical weaknesses detected based on your inputs. Keep an
              eye on EMIs, emergency fund and protection as your life
              situation changes.
            </p>
          ) : (
            <ul className="space-y-3">
              {weaknesses.map((w) => {
                const related = suggestionsForSwotId(w.id);
                const firstSuggestion = related[0];
                const alreadyAdded =
                  firstSuggestion &&
                  actions.some((a) => a.key === firstSuggestion.key);

                return (
                  <li
                    key={w.id}
                    className="text-[11px] md:text-xs text-slate-200"
                  >
                    <div>• {w.label}</div>
                    {firstSuggestion && (
                      <button
                        type="button"
                        onClick={() => handleAddAction(firstSuggestion)}
                        disabled={alreadyAdded}
                        className={
                          "mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] border " +
                          (alreadyAdded
                            ? "border-slate-700 text-slate-400 cursor-default"
                            : "border-rose-400/60 text-rose-200 hover:bg-rose-500/10")
                        }
                      >
                        {alreadyAdded
                          ? "Action added to your list"
                          : "Add as action"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Opportunities */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
          <div className="text-xs font-semibold text-amber-300">
            Opportunities
          </div>
          {opportunities.length === 0 ? (
            <p className="text-xs text-slate-400">
              As your income grows and loans reduce, new optimisation
              opportunities (tax, asset allocation, upgrades) will show up
              here.
            </p>
          ) : (
            <ul className="space-y-3">
              {opportunities.map((o) => {
                const related = suggestionsForSwotId(o.id);
                const firstSuggestion = related[0];
                const alreadyAdded =
                  firstSuggestion &&
                  actions.some((a) => a.key === firstSuggestion.key);

                return (
                  <li
                    key={o.id}
                    className="text-[11px] md:text-xs text-slate-200"
                  >
                    <div>• {o.label}</div>
                    {firstSuggestion && (
                      <button
                        type="button"
                        onClick={() => handleAddAction(firstSuggestion)}
                        disabled={alreadyAdded}
                        className={
                          "mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] border " +
                          (alreadyAdded
                            ? "border-slate-700 text-slate-400 cursor-default"
                            : "border-amber-400/60 text-amber-200 hover:bg-amber-500/10")
                        }
                      >
                        {alreadyAdded
                          ? "Action added to your list"
                          : "Add as action"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Threats */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-300">
            Threats
          </div>
          {threats.length === 0 ? (
            <p className="text-xs text-slate-400">
              No major structural threats flagged from your inputs right now.
              The biggest long-term threats are usually inflation, health
              shocks and job / business risk.
            </p>
          ) : (
            <ul className="space-y-3">
              {threats.map((t) => {
                const related = suggestionsForSwotId(t.id);
                const firstSuggestion = related[0];
                const alreadyAdded =
                  firstSuggestion &&
                  actions.some((a) => a.key === firstSuggestion.key);

                return (
                  <li
                    key={t.id}
                    className="text-[11px] md:text-xs text-slate-200"
                  >
                    <div>• {t.label}</div>
                    {firstSuggestion && (
                      <button
                        type="button"
                        onClick={() => handleAddAction(firstSuggestion)}
                        disabled={alreadyAdded}
                        className={
                          "mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] border " +
                          (alreadyAdded
                            ? "border-slate-700 text-slate-400 cursor-default"
                            : "border-slate-500 text-slate-200 hover:bg-slate-800")
                        }
                      >
                        {alreadyAdded
                          ? "Action added to your list"
                          : "Add as action"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Full action list (below SWOT) */}
      {actions.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm md:text-base font-semibold text-slate-50">
                Your action list
              </h3>
              <p className="text-xs text-slate-400">
                These are all the moves you’ve chosen from the SWOT analysis.
              </p>
            </div>
            <div className="text-[11px] text-slate-500">
              Active: {actions.filter((a) => !a.done).length} · Completed:{" "}
              {actions.filter((a) => a.done).length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {actions.map((a) => (
              <div
                key={a.key}
                className={
                  "rounded-2xl border p-3 flex flex-col gap-2 " +
                  (a.done
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/80")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-200">
                    {a.tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActionDone(a.key)}
                    className={
                      "text-[11px] px-2 py-0.5 rounded-full border " +
                      (a.done
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-slate-600 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    {a.done ? "Mark as active" : "Mark done"}
                  </button>
                </div>
                <div className="text-xs font-semibold text-slate-50">
                  {a.title}
                </div>
                <div className="text-[11px] text-slate-300">
                  {a.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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