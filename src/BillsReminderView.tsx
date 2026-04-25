import {useEffect, useMemo, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {Check, ChevronLeft, ChevronRight, Circle, CircleCheck, Edit2, Plus, Trash2, X} from 'lucide-react';
import {cn} from './lib/utils';
import type {Bill, BillsState, RepeatRule} from './types';
import {expandBillsForMonth, parseISODate, startOfMonth, toISODate, monthKey, daysInMonth, isSameMonth} from './lib/bills';

const STORAGE_KEY = 'financa_simples_bills';
const UI_STORAGE_KEY = 'financa_simples_bills_ui';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function weekdayIndexMondayFirst(d: Date) {
  // JS: 0=Sun..6=Sat -> convert to 0=Mon..6=Sun
  return (d.getDay() + 6) % 7;
}

function clampAmount(v: number) {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 100) / 100;
}

export default function BillsReminderView({
  billsState,
  setBillsState,
  onRegisterPayment,
}: {
  billsState?: BillsState;
  setBillsState?: (s: BillsState) => void;
  onRegisterPayment?: (bill: {title: string; amount: number; instanceDate: string}) => void;
}) {
  const [internalState, setInternalState] = useState<BillsState>({bills: []});
  const state = billsState ?? internalState;
  const setState = setBillsState ?? setInternalState;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{title: string; amount: string; repeat: RepeatRule}>({
    title: '',
    amount: '',
    repeat: 'monthly',
  });

  // If controlled from App, App owns persistence; otherwise we persist here.
  useEffect(() => {
    if (billsState && setBillsState) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as BillsState;
      if (parsed?.bills && Array.isArray(parsed.bills)) {
        // migration: ensure paidDates exists
        setState({
          bills: parsed.bills.map(b => ({...b, paidDates: Array.isArray((b as any).paidDates) ? (b as any).paidDates : []})),
        });
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (billsState && setBillsState) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, billsState, setBillsState]);

  // Persist/restore UI so switching tabs doesn't "lose" context
  useEffect(() => {
    const savedUI = localStorage.getItem(UI_STORAGE_KEY);
    if (!savedUI) return;
    try {
      const parsed = JSON.parse(savedUI) as {viewMonth?: string; selectedDate?: string};
      if (parsed?.viewMonth) {
        const m = parseISODate(parsed.viewMonth);
        setViewMonth(startOfMonth(m));
      }
      if (parsed?.selectedDate) setSelectedDate(parsed.selectedDate);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        viewMonth: toISODate(viewMonth),
        selectedDate,
      })
    );
  }, [viewMonth, selectedDate]);

  const expandedForMonth = useMemo(() => {
    return expandBillsForMonth(
      state.bills.map(b => ({...b, paidDates: Array.isArray((b as any).paidDates) ? (b as any).paidDates : []})),
      viewMonth
    );
  }, [state.bills, viewMonth]);

  const billsByDate = useMemo(() => {
    const map = new Map<string, typeof expandedForMonth>();
    for (const b of expandedForMonth) {
      const arr = map.get(b.instanceDate) ?? [];
      arr.push(b);
      map.set(b.instanceDate, arr);
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.title.localeCompare(b.title));
      map.set(k, v);
    }
    return map;
  }, [expandedForMonth]);

  const selectedBills = billsByDate.get(selectedDate) ?? [];

  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const leading = weekdayIndexMondayFirst(first);
    const dim = daysInMonth(viewMonth);
    const total = Math.ceil((leading + dim) / 7) * 7;

    const cells: Array<{date: Date; inMonth: boolean; iso: string}> = [];
    for (let i = 0; i < total; i++) {
      const dayOffset = i - leading;
      const d = new Date(first.getFullYear(), first.getMonth(), 1 + dayOffset);
      cells.push({date: d, inMonth: isSameMonth(d, viewMonth), iso: toISODate(d)});
    }
    return cells;
  }, [viewMonth]);

  const monthLabel = useMemo(() => {
    return viewMonth.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
  }, [viewMonth]);

  const openNew = (iso: string) => {
    setSelectedDate(iso);
    setEditingId(null);
    setForm({title: '', amount: '', repeat: 'monthly'});
    setIsModalOpen(true);
  };

  const openEdit = (bill: Bill) => {
    setSelectedDate(bill.date);
    setEditingId(bill.id);
    setForm({
      title: bill.title,
      amount: String(bill.amount),
      repeat: bill.repeat,
    });
    setIsModalOpen(true);
  };

  const saveBill = () => {
    const title = form.title.trim();
    const amount = clampAmount(Number(form.amount.replace(',', '.')));
    if (!title) return;

    if (!selectedDate) return;

    if (editingId) {
      setState(prev => ({
        bills: prev.bills.map(b =>
          b.id === editingId
            ? {
                ...b,
                title,
                amount,
                // Important: store the "base" date for monthly repeats.
                date: selectedDate,
                repeat: form.repeat,
                paidDates: Array.isArray((b as any).paidDates) ? (b as any).paidDates : [],
              }
            : b
        ),
      }));
    } else {
      const newBill: Bill = {id: randomId(), title, amount, date: selectedDate, repeat: form.repeat, paidDates: []};
      setState(prev => ({bills: [newBill, ...prev.bills]}));
    }

    setIsModalOpen(false);
  };

  const deleteBill = (id: string) => {
    setState(prev => ({bills: prev.bills.filter(b => b.id !== id)}));
  };

  const togglePaid = (billId: string, instanceDate: string) => {
    setState(prev => ({
      bills: prev.bills.map(b => {
        if (b.id !== billId) return b;
        const paidDates = Array.isArray((b as any).paidDates) ? (b as any).paidDates : [];
        const next = paidDates.includes(instanceDate)
          ? paidDates.filter(d => d !== instanceDate)
          : [instanceDate, ...paidDates];
        return {...b, paidDates: next};
      }),
    }));
  };

  return (
    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="max-w-7xl mx-auto space-y-8 py-8">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Lembrete de contas</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhe suas contas do mês em um calendário editável. Tudo fica salvo neste dispositivo.
          </p>
        </div>
        <button
          onClick={() => openNew(toISODate(new Date()))}
          className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-950/40 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <Plus size={18} /> Nova conta
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMonth(m => addMonths(m, -1))}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Calendário</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">{monthLabel}</h3>
              </div>
              <button
                onClick={() => setViewMonth(m => addMonths(m, 1))}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={() => {
                const now = startOfMonth(new Date());
                setViewMonth(now);
                setSelectedDate(toISODate(new Date()));
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              Hoje
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-7 gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(w => (
                <div key={w} className="text-center">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map(cell => {
                const count = (billsByDate.get(cell.iso) ?? []).length;
                const isSelected = cell.iso === selectedDate;
                const isToday = cell.iso === toISODate(new Date());

                return (
                  <button
                    key={cell.iso}
                    onClick={() => setSelectedDate(cell.iso)}
                    onDoubleClick={() => openNew(cell.iso)}
                    className={cn(
                      'h-20 rounded-2xl border transition-all text-left p-3 group relative overflow-hidden',
                      cell.inMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/60',
                      isSelected ? 'border-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-950' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn('text-sm font-bold', cell.inMonth ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
                        {cell.date.getDate()}
                      </div>
                      {isToday && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                          Hoje
                        </span>
                      )}
                    </div>

                    {count > 0 && (
                      <div className="absolute left-3 bottom-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{count} conta{count > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white/70 dark:bg-slate-800/80 backdrop-blur px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                        Duplo clique: adicionar
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side list */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Selecionado</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {startOfDay(parseISODate(selectedDate)).toLocaleDateString('pt-BR', {weekday: 'long', day: '2-digit', month: 'short'})}
              </h3>
            </div>
            <button
              onClick={() => openNew(selectedDate)}
              className="bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          <div className="p-6 space-y-3">
            {selectedBills.length === 0 ? (
              <div className="py-10 text-center opacity-50">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma conta nesse dia</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Clique em “Adicionar” ou dê duplo clique no calendário.</p>
              </div>
            ) : (
              selectedBills.map(b => (
                <div
                  key={`${b.id}-${b.instanceDate}`}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePaid(b.id, b.instanceDate)}
                          className={cn(
                            'p-1.5 rounded-xl transition-colors',
                            b.isPaid ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' : 'text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                          )}
                          title={b.isPaid ? 'Marcar como não paga' : 'Marcar como paga'}
                        >
                          {b.isPaid ? <CircleCheck size={16} /> : <Circle size={16} />}
                        </button>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{b.title}</p>
                        {b.isPaid && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                            Paga
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {b.repeat === 'monthly' ? 'Repete todo mês' : 'Somente neste mês'} •{' '}
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {b.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onRegisterPayment && !b.isPaid && (
                        <button
                          onClick={() => {
                            onRegisterPayment({title: b.title, amount: b.amount, instanceDate: b.instanceDate});
                            togglePaid(b.id, b.instanceDate);
                          }}
                          className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-bold"
                          title="Registrar pagamento no Dashboard"
                        >
                          Registrar
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(b)}
                        className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteBill(b.id)}
                        className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 dark:bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{opacity: 0, y: 20, scale: 0.98}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: 20, scale: 0.98}}
              className="fixed z-50 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-24 w-auto sm:w-[520px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-300/30 dark:shadow-black/40 overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {editingId ? 'Editar conta' : 'Nova conta'}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {startOfDay(parseISODate(selectedDate)).toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'})}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">Descrição</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({...f, title: e.target.value}))}
                    placeholder="Ex: Aluguel, Internet, Cartão"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-100 dark:focus:border-indigo-800 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">Valor (R$)</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                      placeholder="0,00"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-100 dark:focus:border-indigo-800 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 font-mono font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">Repetição</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {id: 'monthly', label: 'Todo mês'},
                        {id: 'none', label: 'Só este mês'},
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setForm(f => ({...f, repeat: opt.id as RepeatRule}))}
                          className={cn(
                            'py-3 rounded-2xl text-xs font-bold transition-all border-2',
                            form.repeat === opt.id
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                              : 'border-transparent bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={saveBill}
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-indigo-950/40 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={18} /> Salvar
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

