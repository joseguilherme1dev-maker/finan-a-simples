/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Wallet, 
  Zap, 
  GraduationCap, 
  Home, 
  CalendarDays,
  Menu, 
  X, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Target,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Banknote,
  Trash2,
  Edit2,
  Check,
  Undo2,
  Circle,
  CircleCheck,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from 'recharts';
import { Bill, BillsState, FinancialState, Transaction } from './types';
import { cn } from './lib/utils';
import BillsReminderView from './BillsReminderView';
import { expandBillsForMonth, startOfMonth } from './lib/bills';

type ThemeMode = 'light' | 'dark';

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('financa_simples_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'control' | 'automation' | 'education' | 'bills'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [state, setState] = useState<FinancialState>({
    balance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    goal: 500,
    transactions: []
  });
  const [billsState, setBillsState] = useState<BillsState>({ bills: [] });
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('financa_simples_theme', theme);
  }, [theme]);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('financa_simples_data');
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved data", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('financa_simples_data', JSON.stringify(state));
  }, [state]);

  // Sidebar collapsed preference
  useEffect(() => {
    const saved = localStorage.getItem('financa_simples_sidebar_collapsed');
    if (!saved) return;
    setIsSidebarCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('financa_simples_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Bills: load/save from local storage
  useEffect(() => {
    const saved = localStorage.getItem('financa_simples_bills');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as BillsState;
      if (parsed?.bills && Array.isArray(parsed.bills)) {
        setBillsState({
          bills: parsed.bills.map((b: any) => ({
            ...b,
            paidDates: Array.isArray(b?.paidDates) ? b.paidDates : [],
          })),
        });
      }
    } catch (e) {
      console.error("Failed to load saved bills", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('financa_simples_bills', JSON.stringify(billsState));
  }, [billsState]);

  const recalculateTotals = (transactions: Transaction[]) => {
    let balance = 0;
    let income = 0;
    let expenses = 0;
    let savings = 0;

    transactions.forEach(t => {
      if (t.type === 'income') {
        balance += t.amount;
        income += t.amount;
      } else if (t.type === 'expense') {
        balance -= t.amount;
        expenses += t.amount;
      } else if (t.type === 'savings') {
        balance -= t.amount;
        savings += t.amount;
      }
    });

    return { balance, totalIncome: income, totalExpenses: expenses, totalSavings: savings };
  };

  const addTransaction = (desc: string, val: number, type: 'income' | 'expense' | 'savings') => {
    addTransactionAtDate(desc, val, type, new Date().toISOString());
  };

  const addTransactionAtDate = (
    desc: string,
    val: number,
    type: 'income' | 'expense' | 'savings',
    isoDate: string
  ) => {
    if (!desc || isNaN(val) || val <= 0) return;

    if (type === 'savings' && val > state.balance) {
      alert("Saldo insuficiente para guardar esse valor!");
      return;
    }

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      description: desc,
      amount: val,
      type,
      date: isoDate
    };

    const newTransactions = [newTransaction, ...state.transactions];
    const totals = recalculateTotals(newTransactions);

    setState(prev => ({
      ...prev,
      ...totals,
      transactions: newTransactions
    }));
  };

  const markBillPaid = (billId: string, instanceDate: string) => {
    setBillsState(prev => ({
      bills: prev.bills.map((b: Bill) => {
        if (b.id !== billId) return b;
        const paidDates = Array.isArray((b as any).paidDates) ? (b as any).paidDates : [];
        if (paidDates.includes(instanceDate)) return b;
        return { ...b, paidDates: [instanceDate, ...paidDates] };
      })
    }));
  };

  const registerBillPayment = (bill: { title: string; amount: number; instanceDate: string; id?: string }) => {
    // Avoid timezone shifting the "day" by pinning at noon local time.
    const iso = new Date(`${bill.instanceDate}T12:00:00`).toISOString();
    addTransactionAtDate(`Conta: ${bill.title}`, bill.amount, 'expense', iso);
    if (bill.id) markBillPaid(bill.id, bill.instanceDate);
  };

  const deleteTransaction = (id: string) => {
    const newTransactions = state.transactions.filter(t => t.id !== id);
    const totals = recalculateTotals(newTransactions);
    setState(prev => ({
      ...prev,
      ...totals,
      transactions: newTransactions
    }));
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    const newTransactions = state.transactions.map(t => 
      t.id === id ? { ...t, ...updated } : t
    );
    
    // Check if savings update is valid
    const transaction = newTransactions.find(t => t.id === id);
    if (transaction?.type === 'savings') {
      // Temporarily calculate balance without this updated transaction to check limit
      const otherTransactions = newTransactions.filter(t => t.id !== id);
      const tempTotals = recalculateTotals(otherTransactions);
      if (transaction.amount > tempTotals.balance) {
        alert("Saldo insuficiente para esta alteração na meta!");
        return;
      }
    }

    const totals = recalculateTotals(newTransactions);
    setState(prev => ({
      ...prev,
      ...totals,
      transactions: newTransactions
    }));
  };

  const chartData = [
    { name: 'Ganhos', value: state.totalIncome || 1, color: '#10b981' },
    { name: 'Gastos', value: state.totalExpenses, color: '#f43f5e' },
    { name: 'Meta', value: state.totalSavings, color: '#3b82f6' },
  ];

  const sidebarItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'control', label: 'Dashboard', icon: BarChart3 },
    { id: 'bills', label: 'Lembrete de contas', icon: CalendarDays },
    { id: 'automation', label: 'Vincular Bancos', icon: Zap },
    { id: 'education', label: 'Educa Finança', icon: GraduationCap },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-8 py-8"
          >
            <div className="text-center space-y-4">
              <h1 className="text-5xl font-display font-bold text-indigo-950 dark:text-indigo-100 tracking-tight">
                Finança<span className="text-emerald-500 dark:text-emerald-400">Simples</span>
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                A tecnologia que elimina os gastos invisíveis e transforma sua relação com o dinheiro.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pt-8">
              <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 mb-6">
                    <TrendingDown size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">O Problema</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Sabe aqueles pequenos gastos diários? Eles são o maior veneno para o seu crescimento. Sem monitoramento, você nunca atinge sua liberdade.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('control')}
                  className="mt-8 text-rose-600 font-semibold flex items-center gap-2 group"
                >
                  Começar a controlar <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="p-8 bg-indigo-900 rounded-3xl shadow-xl shadow-indigo-200/50 text-white flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-indigo-800 rounded-2xl flex items-center justify-center text-emerald-400 mb-6">
                    <TrendingUp size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">A Solução</h3>
                  <p className="text-indigo-100">
                    Use inteligência para visualizar exatamente para onde seu dinheiro vai. Defina metas e deixe que nossa automação cuide do resto.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('automation')}
                  className="mt-8 text-emerald-400 font-semibold flex items-center gap-2 group"
                >
                  Conhecer automações <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Educação é o caminho</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm italic items-center flex gap-1">
                  "O investimento em conhecimento paga os melhores juros." — Benjamin Franklin
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('education')}
                className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 px-6 py-3 rounded-xl font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                Acessar Cursos
              </button>
            </div>
          </motion.div>
        );
      case 'control':
        return (
          <Dashboard 
            state={state} 
            setState={setState} 
            onAdd={addTransaction} 
            onDelete={deleteTransaction}
            onUpdate={updateTransaction}
            chartData={chartData} 
            theme={theme}
            billsState={billsState}
            onRegisterBillPayment={(payload) => {
              registerBillPayment(payload);
              if (payload.id) markBillPaid(payload.id, payload.instanceDate);
            }}
          />
        );
      case 'automation':
        return <AutomationView />;
      case 'education':
        return <EducationView />;
      case 'bills':
        return (
          <BillsReminderView
            billsState={billsState}
            setBillsState={setBillsState}
            onRegisterPayment={({title, amount, instanceDate}) => registerBillPayment({title, amount, instanceDate})}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-all lg:translate-x-0 lg:static flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        <div className={cn("flex items-center gap-3", isSidebarCollapsed ? "p-4" : "p-8")}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 flex-shrink-0">
            <Wallet size={20} />
          </div>
          {!isSidebarCollapsed && (
            <span className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Simples</span>
          )}

          <button
            onClick={() => setIsSidebarCollapsed(v => !v)}
            className={cn(
              "ml-auto p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hidden lg:inline-flex",
              isSidebarCollapsed && "ml-0"
            )}
            title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isSidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className={cn("flex-1 py-4 space-y-1", isSidebarCollapsed ? "px-2" : "px-4")}>
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-200 group",
                isSidebarCollapsed ? "justify-center px-0 py-3.5" : "gap-4 px-4 py-3.5",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950/50" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400"
              )}
            >
              <item.icon size={20} />
              {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
              {activeTab === item.id && !isSidebarCollapsed && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-40"
                />
              )}
            </button>
          ))}
        </nav>

        {!isSidebarCollapsed && (
          <div className="p-6 border-t border-slate-50 dark:border-slate-800">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest mb-1">Status Pro</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Open Finance Ativo</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="h-20 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Olá, Guilherme</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Plano Avançado</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold overflow-hidden shadow-inner">
               <span className="text-sm">GJ</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function Dashboard({
  state,
  setState,
  onAdd,
  onDelete,
  onUpdate,
  chartData,
  theme,
  billsState,
  onRegisterBillPayment,
}: { 
  state: FinancialState, 
  setState: (s: any) => void,
  onAdd: (d: string, v: number, t: any) => void, 
  onDelete: (id: string) => void,
  onUpdate: (id: string, updated: Partial<Transaction>) => void,
  chartData: any[],
  theme: ThemeMode,
  billsState: BillsState,
  onRegisterBillPayment: (payload: { id: string; title: string; amount: number; instanceDate: string }) => void
}) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'savings'>('income');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{description: string, amount: string, type: 'income' | 'expense' | 'savings'}>({
    description: '',
    amount: '',
    type: 'income'
  });

  const progress = Math.min((state.totalSavings / (state.goal || 1)) * 100, 100);

  const startEditing = (tr: Transaction) => {
    setEditingId(tr.id);
    setEditForm({
      description: tr.description,
      amount: tr.amount.toString(),
      type: tr.type
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, {
        description: editForm.description,
        amount: parseFloat(editForm.amount),
        type: editForm.type
      });
      setEditingId(null);
    }
  };

  const billsThisMonth = expandBillsForMonth(billsState.bills ?? [], startOfMonth(new Date()))
    .slice()
    .sort((a, b) => a.instanceDate.localeCompare(b.instanceDate));

  const unpaidBills = billsThisMonth.filter(b => !b.isPaid);
  const unpaidTotal = unpaidBills.reduce((sum, b) => sum + (Number.isFinite(b.amount) ? b.amount : 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visão geral das suas finanças e contas do mês.</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-xl">
            {new Date().toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ganhos</p>
            <p className="font-mono font-bold text-emerald-600">
              {state.totalIncome.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Gastos</p>
            <p className="font-mono font-bold text-rose-600">
              {state.totalExpenses.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Meta</p>
            <p className="font-mono font-bold text-blue-600">
              {state.totalSavings.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
            </p>
          </div>
        </div>
        {/* Goal Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
              <Target size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>Meta Mensal</span>
            </div>
            <input 
              type="number" 
              value={state.goal} 
              onChange={(e) => setState({ ...state, goal: Number(e.target.value) })}
              className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-right font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 ring-indigo-100 dark:ring-indigo-900 transition-all"
            />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
              />
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-500 dark:text-slate-400">Guardado: R$ {state.totalSavings.toFixed(2)}</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progress.toFixed(0)}%</span>
            </div>
          </div>
          {progress >= 100 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2"
            >
              🎉 Meta Atingida! Parabéns!
            </motion.div>
          )}
        </div>

        {/* Action Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-indigo-50 dark:border-indigo-900/40 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Plus size={18} className="text-indigo-600 dark:text-indigo-400" />
            Novo Registro
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">Descrição</label>
              <input 
                type="text" 
                placeholder="Ex: Salário, Jantar, PIX" 
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-100 dark:focus:border-indigo-800 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">Valor (R$)</label>
              <input 
                type="number" 
                placeholder="0,00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-100 dark:focus:border-indigo-800 outline-none transition-all font-mono font-bold text-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'income', label: 'Ganho', class: 'text-emerald-600 bg-emerald-50' },
                  { id: 'expense', label: 'Gasto', class: 'text-rose-600 bg-rose-50' },
                  { id: 'savings', label: 'Meta', class: 'text-blue-600 bg-blue-50' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id as any)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold transition-all border-2",
                      type === t.id ? `border-indigo-600 ${t.class}` : "border-transparent bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => {
                onAdd(desc, parseFloat(amount), type);
                setDesc('');
                setAmount('');
              }}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-indigo-950/40 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Registrar Movimentação
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-8">
        {/* Bills Reminder Integration */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
                <CalendarDays size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Contas do mês</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {unpaidBills.length === 0
                  ? 'Tudo pago por aqui.'
                  : `${unpaidBills.length} pendente(s) • Total: ${unpaidTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`}
              </p>
            </div>
            <span className={cn(
              "text-xs font-bold px-3 py-2 rounded-xl border",
              unpaidBills.length === 0 ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50" : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/50"
            )}>
              {unpaidBills.length === 0 ? 'OK' : 'Pendente'}
            </span>
          </div>

          <div className="mt-5 grid gap-2">
            {billsThisMonth.length === 0 ? (
              <div className="py-8 text-center opacity-50">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma conta cadastrada</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Adicione em “Lembrete de contas”.</p>
              </div>
            ) : (
              billsThisMonth.slice(0, 6).map(b => (
                <div
                  key={`${b.id}-${b.instanceDate}`}
                  className={cn(
                    "p-4 rounded-2xl border flex items-center justify-between gap-4",
                    b.isPaid ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      b.isPaid ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700"
                    )}>
                      {b.isPaid ? <CircleCheck size={18} /> : <Circle size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{b.title}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                        {new Date(`${b.instanceDate}T00:00:00`).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={cn(
                      "font-mono font-bold text-sm",
                      b.isPaid ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {b.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                    </p>
                    {!b.isPaid ? (
                      <button
                        onClick={() => onRegisterBillPayment({id: b.id, title: b.title, amount: b.amount, instanceDate: b.instanceDate})}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all"
                      >
                        Registrar
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 rounded-xl">
                        Pago
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Balance & Chart Section */}
        <div className="grid md:grid-cols-5 gap-8 overflow-hidden">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-500 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
              <p className="text-indigo-200 text-sm font-medium mb-1 flex items-center gap-2">
                Saldo Disponível <Wallet size={14} className="opacity-60" />
              </p>
              <h2 className="text-4xl font-display font-bold leading-none mb-6">
                R$ {state.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
              <div className="pt-6 border-t border-white/10 flex justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-tighter">Ganhos Total</p>
                  <p className="text-sm font-bold text-emerald-300">R$ {state.totalIncome.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-tighter">Gastos Total</p>
                  <p className="text-sm font-bold text-rose-200">R$ {state.totalExpenses.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 h-[280px]">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-4 tracking-widest text-center">Distribuição</h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center" 
                    iconType="circle"
                    wrapperStyle={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity List */}
          <div className="md:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Atividades Recentes</h3>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded-md">{state.transactions.length} itens</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[520px] p-6 space-y-3">
              {state.transactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                  <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <Banknote size={32} strokeWidth={1} />
                  </div>
                  <p className="text-sm font-medium">Nenhum registro ainda</p>
                  <p className="text-xs">Comece adicionando seu primeiro ganho!</p>
                </div>
              ) : (
                state.transactions.map((tr) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={tr.id} 
                    className={cn(
                      "flex flex-col p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border transition-all group hover:bg-white dark:hover:bg-slate-800",
                      editingId === tr.id ? "border-indigo-600 bg-white dark:bg-slate-800 shadow-lg ring-4 ring-indigo-50 dark:ring-indigo-950" : "border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                    )}
                  >
                    {editingId === tr.id ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <Edit2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                           <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Editando Registro</span>
                        </div>
                        <input 
                          type="text" 
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm font-bold text-slate-900 dark:text-slate-100"
                          placeholder="Descrição"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="number" 
                            value={editForm.amount}
                            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm font-mono font-bold text-slate-900 dark:text-slate-100"
                            placeholder="Valor"
                          />
                          <select 
                            value={editForm.type}
                            onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 rounded-xl outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm font-bold text-slate-900 dark:text-slate-100"
                          >
                            <option value="income">Ganho</option>
                            <option value="expense">Gasto</option>
                            <option value="savings">Meta</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={saveEdit}
                            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1"
                          >
                            <Check size={14} /> Salvar
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1"
                          >
                            <Undo2 size={14} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                            tr.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 
                            tr.type === 'expense' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                          )}>
                            {tr.type === 'income' ? <TrendingUp size={18} /> : 
                             tr.type === 'expense' ? <TrendingDown size={18} /> : <Target size={18} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{tr.description}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              {new Date(tr.date).toLocaleDateString('pt-BR')} às {new Date(tr.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={cn(
                              "font-mono font-bold leading-tight",
                              tr.type === 'income' ? 'text-emerald-600' : 
                              tr.type === 'expense' ? 'text-rose-600' : 'text-blue-600'
                            )}>
                              {tr.type === 'income' ? '+' : '-'}{tr.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-slate-300 dark:text-slate-500 font-bold uppercase tracking-widest">{tr.type === 'income' ? 'Ganho' : tr.type === 'expense' ? 'Gasto' : 'Meta'}</p>
                          </div>
                          
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEditing(tr)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => onDelete(tr.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function AutomationView() {
  const banks = [
    { name: 'Nubank', logo: 'https://logodownload.org/wp-content/uploads/2019/08/nubank-logo.png', color: '#8a05be' },
    { name: 'Banco Inter', logo: 'https://logodownload.org/wp-content/uploads/2018/11/banco-inter-logo-9.png', color: '#ff7a00' },
    { name: 'Itaú', logo: 'https://logodownload.org/wp-content/uploads/2014/05/itau-logo-0.png', color: '#ec7000' },
    { name: 'Santander', logo: 'https://logodownload.org/wp-content/uploads/2017/05/santander-logo-3.png', color: '#ec0000' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-8 py-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Controle Automático</h2>
        <p className="text-slate-500 dark:text-slate-400">Conecte suas contas via Open Finance e pare de digitar lançamentos manualmente.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {banks.map((bank) => (
          <div key={bank.name} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 flex items-center justify-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <img src={bank.logo} alt={bank.name} className="max-h-full max-w-full object-contain" />
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">{bank.name}</span>
            </div>
            <button 
              onClick={() => alert(`Iniciando fluxo Open Finance com ${bank.name}...`)}
              className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all group-hover:scale-105"
            >
              Vincular
            </button>
          </div>
        ))}
      </div>

      <div className="p-8 bg-indigo-50 dark:bg-indigo-950/30 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-6">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/60 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">
          <Zap size={24} />
        </div>
        <div>
          <h4 className="font-bold text-indigo-900 dark:text-indigo-100">Por que vincular?</h4>
          <p className="text-sm text-indigo-700 dark:text-indigo-300">Com o Open Finance, seu controle financeiro passará a ser 100% automatizado, capturando cada gasto em tempo real.</p>
        </div>
      </div>
    </motion.div>
  );
}

function EducationView() {
  const courses = [
    { 
      title: 'Educação Financeira Pessoal', 
      desc: 'Aprenda os fundamentos para gerir sua renda de forma produtiva.',
      url: 'https://www.escolavirtual.gov.br/curso/1076',
      tag: 'Fundamental'
    },
    { 
      title: 'Finanças e Cooperativismo', 
      desc: 'Entenda como o sistema financeiro pode trabalhar a seu favor.',
      url: 'https://www.escolavirtual.gov.br/curso/903',
      tag: 'Avançado'
    },
    { 
      title: 'Investimentos para Iniciantes', 
      desc: 'Saia da poupança e comece a construir seu patrimônio.',
      url: 'https://www.escolavirtual.gov.br/curso/343',
      tag: 'Investimento'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8 py-8"
    >
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <GraduationCap size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Cursos de Qualificação</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Parceria oficial com a Escola Virtual.Gov</p>
        </div>
      </div>

      <div className="grid gap-6">
        {courses.map((course) => (
          <div key={course.title} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-colors">
            <div className="space-y-2 max-w-xl">
              <span className="text-[10px] uppercase font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400 tracking-wider">
                {course.tag}
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{course.title}</h3>
              <p className="text-slate-500 dark:text-slate-400">{course.desc}</p>
            </div>
            <button 
              onClick={() => window.open(course.url, '_blank')}
              className="bg-slate-900 dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all whitespace-nowrap"
            >
              Acessar Aula <ExternalLink size={18} />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
