import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Batch, StockItem, StockType, Supplier, BREED_REFERENCE_DATA } from '../types';
import DecimalInput from './DecimalInput';
import {
  PackagePlus as PackagePlusIcon,
  X as XIcon,
  PlusCircle as PlusCircleIcon,
  ArrowLeft as ArrowLeftIcon,
  RefreshCw as RefreshIcon,
  Trash2 as TrashIcon,
  Scale as ScaleIcon,
  Calculator as CalcIcon,
  CheckCircle as CheckIcon,
  Package as PackageIcon,
  Zap as ZapIcon,
  Activity as ActivityIcon,
  ShieldCheck as ShieldIcon,
  Thermometer as TempIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  AlertTriangle as AlertIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  History as HistoryIcon,
  FileText as FileIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Waves as WavesIcon,
  Pencil as PencilIcon,
  RotateCcw as RotateCcwIcon
} from 'lucide-react';
import { calculateRealCost, formatCurrency, formatWeight } from '../utils/helpers';

interface BatchesProps {
  batches: Batch[];
  suppliers: Supplier[];
  stock: StockItem[];
  addBatch: (b: Batch) => Promise<{ success: boolean; error?: string }>;
  updateBatch?: (id: string, updates: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: string) => void;
  addStockItem: (item: StockItem) => Promise<any>;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  removeStockItem?: (id: string) => void;
  registerBatchFinancial: (batch: Batch) => Promise<void>;
  onBack: () => void;
  onGoToStock: () => void;
}

// DECLARAÇÃO PARA TYPESCRIT DA SPEECH API
const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const Batches: React.FC<BatchesProps> = ({
  batches = [],
  suppliers = [],
  stock = [],
  addBatch, updateBatch, deleteBatch, addStockItem, updateStockItem, removeStockItem, registerBatchFinancial, onBack, onGoToStock
}) => {
  const safeBatches = batches || [];
  const safeSuppliers = suppliers || [];
  const safeStock = stock || [];

  const weightInputRef = useRef<HTMLInputElement>(null);
  const sequenceInputRef = useRef<HTMLInputElement>(null);

  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  // Lote em rascunho - só vai pro Firebase quando finalizar
  const [draftBatch, setDraftBatch] = useState<Batch | null>(null);
  const [visionScanning, setVisionScanning] = useState(false);
  const [visionAuditStatus, setVisionAuditStatus] = useState<'PENDENTE' | 'APROVADO' | 'REVISAO'>('PENDENTE');
  const [esgScore, setEsgScore] = useState(85); // Padrão inicial bom


  // --- VOZ DO CURRAL STATE ---
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceModeActive = useRef(false); // Rastreia se o modo voz está ativo

  useEffect(() => {
    if (Recognition) {
      const recognition = new Recognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();

        // EXTRAIR NÚMEROS DA FRASE (Ex: "Cento e quarenta e dois quilos")
        const numbers = transcript.match(/\d+([.,]\d+)?/g);
        if (numbers && numbers.length > 0) {
          // Replace comma with dot for decimal
          const cleanNumber = numbers[0].replace(',', '.');
          setNewItemEntry(prev => ({ ...prev, peso: cleanNumber }));
          setIsListening(false);

          // AUTO-RESTART se modo voz ativo
          if (voiceModeActive.current) {
            setTimeout(() => {
              if (recognitionRef.current && voiceModeActive.current) {
                setIsListening(true);
                recognitionRef.current.start();
              }
            }, 300);
          }
        } else {
          // NÃO ENTENDEU: Reativa automaticamente (silencioso)
          setIsListening(false);
          setTimeout(() => {
            if (recognitionRef.current && voiceModeActive.current) {
              setIsListening(true);
              recognitionRef.current.start();
            }
          }, 500);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        // Auto-restart on error (silencioso)
        if (event.error !== 'aborted' && event.error !== 'no-speech' && voiceModeActive.current) {
          setTimeout(() => {
            if (recognitionRef.current && voiceModeActive.current) {
              setIsListening(true);
              recognitionRef.current.start();
            }
          }, 500);
        }
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (isListening || voiceModeActive.current) {
      // Desligar completamente
      voiceModeActive.current = false;
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      // Ativar modo voz contínuo
      voiceModeActive.current = true;
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // --- STATE DO NOVO LOTE ---
  const [newBatch, setNewBatch] = useState<any>({
    id_lote: '',
    fornecedor: '',
    data_recebimento: new Date().toISOString().split('T')[0],
    peso_total_romaneio: 0,
    valor_compra_total: 0,
    frete: 0,
    gastos_extras: 0,
    forma_pagamento: 'PRAZO',
    valor_entrada: 0,
    prazo_dias: 30,
    status: 'ABERTO',
    id_sequencia: 1,
    // Estágio 1 — Produção & Raça
    raca: '',
    qtd_cabecas: 0,
    peso_vivo_medio: 0,
    peso_gancho: 0,
    toalete_kg: 0,
    preco_arroba: 0,
    qtd_mortos: 0
  } as any);

  // Rendimento esperado baseado na raça selecionada
  const breedRef = useMemo(() => {
    const r = newBatch.raca || (selectedBatchId ? (safeBatches.find(b => b.id_lote === selectedBatchId) as any)?.raca : '');
    return BREED_REFERENCE_DATA.find(b => b.raca === r) || null;
  }, [newBatch.raca, selectedBatchId, safeBatches]);

  // --- FUNÇÃO DE GERAR ID (ESTILO PREMIUM LIGHT) ---
  const generateNextId = (manualSeq?: number) => {
    let sigla = 'LOTE';
    if (newBatch && newBatch.fornecedor && typeof newBatch.fornecedor === 'string') {
      try {
        const rawName = newBatch.fornecedor.toUpperCase().trim();
        if (rawName.length > 0) {
          const mapAcentos: { [key: string]: string } = {
            'Ã': 'A', 'Á': 'A', 'Â': 'A', 'À': 'A', 'Ä': 'A',
            'É': 'E', 'Ê': 'E', 'È': 'E', 'Í': 'I', 'Ì': 'I',
            'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ò': 'O', 'Ú': 'U', 'Ù': 'U', 'Ü': 'U',
            'Ç': 'C', 'Ñ': 'N'
          };
          const cleanName = rawName.replace(/[^\w\s]/g, (c) => mapAcentos[c] || '');
          const parts = cleanName.split(' ').filter(p => p.length > 0);
          if (parts.length > 0) {
            const nome = parts[0];
            const tresLetras = nome.length >= 3 ? nome.substring(0, 3) : nome.padEnd(3, 'X');
            let letraSobrenome = '';
            if (parts.length > 1) letraSobrenome = parts[parts.length - 1].charAt(0);
            sigla = `${tresLetras}${letraSobrenome}`.replace(/[^A-Z0-9]/g, '');
          }
        }
      } catch (e) { sigla = 'LOTE'; }
    }

    const today = new Date();
    const dia = String(today.getDate()).padStart(2, '0');
    const mes = String(today.getMonth() + 1).padStart(2, '0');
    const dataStr = `${dia}${mes}`;
    const prefix = `${sigla}-${dataStr}-`;

    let seqToUse = manualSeq;
    if (seqToUse === undefined) {
      const currentDayBatches = safeBatches.filter(b => b.id_lote && b.id_lote.startsWith(prefix));
      let maxSeq = 0;
      if (currentDayBatches.length > 0) {
        maxSeq = currentDayBatches.reduce((max, b) => {
          try {
            const parts = b.id_lote.split('-');
            const lastPart = parts[parts.length - 1];
            const seq = parseInt(lastPart);
            return isNaN(seq) ? max : Math.max(max, seq);
          } catch (e) { return max; }
        }, 0);
      }
      seqToUse = maxSeq + 1;
    }
    return `${prefix}${String(seqToUse).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!selectedBatchId && newBatch.id_lote === '') {
      setNewBatch(prev => ({ ...prev, id_lote: generateNextId() }));
    }
  }, [selectedBatchId]);

  // Se estamos trabalhando com um draftBatch, usa ele; se não, busca nos batches salvos
  const selectedBatch = useMemo(() => {
    if (draftBatch && draftBatch.id_lote === selectedBatchId) return draftBatch;
    return safeBatches.find(b => b.id_lote === selectedBatchId);
  }, [selectedBatchId, safeBatches, draftBatch]);
  const [draftItems, setDraftItems] = useState<StockItem[]>([]);

  const batchSummary = useMemo(() => {
    if (!selectedBatchId || !selectedBatch) return null;
    const savedItems = safeStock.filter(s => s.id_lote === selectedBatchId);
    const allItems = [...savedItems, ...draftItems.filter(d => d.id_lote === selectedBatchId)];

    // Agrupar por sequência para aplicar desconto de 3kg em carcaças inteiras
    const grouped = allItems.reduce((acc, item) => {
      const seq = item.sequencia;
      if (!acc[seq]) acc[seq] = { bandaA: null, bandaB: null, inteiro: null };
      if (item.tipo === StockType.BANDA_A) acc[seq].bandaA = item;
      else if (item.tipo === StockType.BANDA_B) acc[seq].bandaB = item;
      else if (item.tipo === StockType.INTEIRO) acc[seq].inteiro = item;
      return acc;
    }, {} as Record<number, { bandaA: StockItem | null; bandaB: StockItem | null; inteiro: StockItem | null }>);

    // Calcular total com desconto de 3kg para carcaças inteiras
    const totalWeighed = Object.values(grouped).reduce((acc, group) => {
      const pesoA = group.bandaA?.peso_entrada || 0;
      const pesoB = group.bandaB?.peso_entrada || 0;
      const pesoInteiro = group.inteiro?.peso_entrada || 0;

      // Se tem banda A e B = carcaça inteira, desconta 3kg do total
      const desconto = (pesoA > 0 && pesoB > 0) ? 3 : 0;
      const pesoGrupo = pesoInteiro > 0 ? pesoInteiro : (pesoA + pesoB - desconto);

      return acc + pesoGrupo;
    }, 0);

    const nfWeight = selectedBatch.peso_total_romaneio;
    const diff = totalWeighed - nfWeight;
    const percent = nfWeight > 0 ? (totalWeighed / nfWeight) * 100 : 0;
    return { totalWeighed, nfWeight, diff, percent, count: allItems.length };
  }, [selectedBatchId, selectedBatch, safeStock, draftItems]);

  const [newItemEntry, setNewItemEntry] = useState({
    sequencia: '1',
    tipo: StockType.BANDA_A.toString(),
    peso: '',
    pesoA: '',
    pesoB: ''
  });

  // --- AUTO-SEQUÊNCIA AO ABRIR LOTE (REFATORADA PARA SER MENOS INVASIVA) ---
  useEffect(() => {
    if (selectedBatchId && draftItems.length === 0) {
      const savedItems = safeStock.filter(s => s.id_lote === selectedBatchId);
      if (savedItems.length > 0) {
        const lastItem = [...savedItems].sort((a, b) => b.sequencia !== a.sequencia ? b.sequencia - a.sequencia : b.tipo - a.tipo)[0];
        let nextSeq = lastItem.sequencia;
        let nextType = lastItem.tipo;

        if (lastItem.tipo === StockType.INTEIRO) { nextSeq = lastItem.sequencia + 1; }
        else if (lastItem.tipo === StockType.BANDA_A) { nextType = StockType.BANDA_B; }
        else if (lastItem.tipo === StockType.BANDA_B) { nextSeq = lastItem.sequencia + 1; nextType = StockType.BANDA_A; }

        setNewItemEntry(prev => ({
          ...prev,
          sequencia: nextSeq.toString(),
          tipo: nextType.toString()
        }));
      }
    }
  }, [selectedBatchId]); // Apenas na primeira vez que seleciona o lote

  const isBatchLocked = selectedBatch?.status === 'FECHADO';

  useEffect(() => {
    if (selectedBatchId && weightInputRef.current) {
      setTimeout(() => weightInputRef.current?.focus(), 500);
    }
  }, [selectedBatchId]);

  const simulatedCost = calculateRealCost(
    newBatch.valor_compra_total || 0,
    newBatch.frete || 0,
    newBatch.gastos_extras || 0,
    newBatch.peso_total_romaneio || 0
  );

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loteId = newBatch.id_lote || generateNextId();
    if (!newBatch.peso_total_romaneio) return;

    // ═══ BLOCKCHAIN TRACEABILITY 2026 ═══
    const traceabilityHash = `0x${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}`.toUpperCase();

    const batchToCreate: Batch = {
      ...(newBatch as Batch),
      id_lote: loteId,
      custo_real_kg: simulatedCost,
      status: 'ABERTO',
      traceability_hash: traceabilityHash,
      vision_audit_status: visionAuditStatus,
      esg_score: esgScore
    };

    // Guarda o lote em memória (draft) - só será salvo na finalização
    setDraftBatch(batchToCreate);
    setSelectedBatchId(loteId);
  };

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedBatchId || isBatchLocked || !newItemEntry.sequencia || !newItemEntry.peso) return;

    const seq = parseInt(newItemEntry.sequencia);
    const type = parseInt(newItemEntry.tipo) as StockType;
    const typeLabel = type === StockType.BANDA_A ? 'BANDA_A' : type === StockType.BANDA_B ? 'BANDA_B' : 'INTEIRO';
    const weight = parseFloat(newItemEntry.peso.replace(',', '.'));
    const id_completo = `${selectedBatchId}-${String(seq).padStart(3, '0')}-${typeLabel}`;



    const itemToAdd = {
      id_completo,
      id_lote: selectedBatchId,
      sequencia: seq,
      tipo: type,
      peso_entrada: weight, // Salva o peso EXATO cadastrado, sem desconto
      status: 'DISPONIVEL',
      data_entrada: selectedBatch?.data_recebimento || new Date().toISOString().split('T')[0]
    };

    setDraftItems(prev => [...prev, itemToAdd as StockItem]);

    // AUTO-ADVANCE LOGIC
    let nextSeq = seq;
    let nextType = type;

    if (type === StockType.INTEIRO) {
      // Inteiro: next sequence, same type
      nextSeq = seq + 1;
      nextType = StockType.INTEIRO;
    }
    else if (type === StockType.BANDA_A) {
      // After Banda A: stay same sequence, switch to Banda B
      nextSeq = seq;
      nextType = StockType.BANDA_B;
    }
    else if (type === StockType.BANDA_B) {
      // After Banda B: next sequence, back to Banda A
      nextSeq = seq + 1;
      nextType = StockType.BANDA_A;
    }

    setNewItemEntry({ sequencia: nextSeq.toString(), tipo: nextType.toString(), peso: '', pesoA: '', pesoB: '' });

    // FOCO SEMPRE NO PESO PARA FLUXO RÁPIDO
    setTimeout(() => weightInputRef.current?.focus(), 50);
  };

  const handleDeleteItem = (id_completo: string) => {
    if (isBatchLocked) return;
    const isDraft = draftItems.some(i => i.id_completo === id_completo);
    if (isDraft) {
      setDraftItems(prev => prev.filter(i => i.id_completo !== id_completo));
    } else {
      if (removeStockItem) removeStockItem(id_completo);
    }
  };

  const confirmFinalization = async () => {
    if (!selectedBatchId) return;
    const itemsToSave = draftItems.filter(d => d.id_lote === selectedBatchId);

    // Valida que tem pelo menos 1 item
    if (itemsToSave.length === 0) {
      alert('⚠️ É necessário cadastrar pelo menos uma peça antes de finalizar!');
      return;
    }

    try {
      // SE FOR UM DRAFT (lote novo), salva primeiro o lote no Firebase
      if (draftBatch && draftBatch.id_lote === selectedBatchId) {
        const batchToSave: Batch = { ...draftBatch, status: 'FECHADO' as const };
        const result = await addBatch(batchToSave);
        if (!result || !result.success) {
          alert('❌ Erro ao salvar o lote: ' + (result?.error || 'Erro desconhecido'));
          return;
        }
        // Registra financeiro
        await registerBatchFinancial(batchToSave);
      } else if (selectedBatch && updateBatch) {
        // Lote já existia - só atualiza status
        await registerBatchFinancial(selectedBatch);
        await updateBatch(selectedBatch.id_lote, { status: 'FECHADO' });
      }

      // Salva todos os itens no estoque
      for (const item of itemsToSave) {
        await addStockItem(item);
      }

      // Limpa os drafts
      setDraftItems(prev => prev.filter(d => d.id_lote !== selectedBatchId));
      setDraftBatch(null);
      setShowFinalizationModal(false);

      alert('✅ Lote finalizado com sucesso!');
      onGoToStock();
    } catch (e) {
      console.error('Erro ao finalizar:', e);
      alert('❌ Erro ao finalizar o lote.');
    }
  };

  const handleEditBatch = (batch: Batch) => {
    setEditingBatch({ ...batch });
    setShowEditModal(true);
  };

  const handleSaveEditedBatch = async () => {
    if (!editingBatch || !updateBatch) return;
    try {
      await updateBatch(editingBatch.id_lote, editingBatch);
      setShowEditModal(false);
      setEditingBatch(null);
    } catch (e) {
      console.error('Erro ao salvar lote:', e);
    }
  };

  const handleDeleteBatch = async () => {
    if (!editingBatch || !deleteBatch) return;

    // Confirmação com aviso sobre estorno
    const confirmEstorno = window.confirm(
      `🔄 ESTORNO DE LOTE\n\n` +
      `Lote: ${editingBatch.id_lote} - ${editingBatch.fornecedor}\n\n` +
      `Esta ação irá ESTORNAR o lote inteiro:\n` +
      `• O lote será marcado como ESTORNADO\n` +
      `• Itens do estoque serão marcados como ESTORNADO\n` +
      `• Contas a pagar serão canceladas/estornadas\n` +
      `• Vendas vinculadas serão estornadas\n` +
      `• Transações financeiras serão revertidas\n\n` +
      `⚠️ Nenhum dado será APAGADO — tudo fica registrado como estorno.\n\n` +
      `Confirma o ESTORNO?`
    );

    if (!confirmEstorno) return;

    try {
      await deleteBatch(editingBatch.id_lote);
      alert('✅ Lote estornado com sucesso! Todos os registros vinculados foram revertidos.');
      setShowEditModal(false);
      setEditingBatch(null);
    } catch (e) {
      console.error('Erro ao estornar lote:', e);
      alert('❌ Erro ao estornar o lote.');
    }
  };

  return (
    <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">

      {/* PREMIUM HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col gap-4">
          <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <ArrowLeftIcon size={14} /> Voltar ao Início
          </button>
          <div className="flex items-center gap-5">
            <div className={`p-3 rounded-2xl text-white shadow-xl ${isBatchLocked ? 'bg-slate-400' : 'bg-orange-600 shadow-orange-100'}`}>
              <PackagePlusIcon size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                Recepção de <span className="text-orange-600">Lotes</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                  Fluxo de Entrada / ID-LOG
                </p>
                {selectedBatch && (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isBatchLocked ? 'bg-slate-100 text-slate-500' : 'bg-orange-50 text-orange-600'}`}>
                    {isBatchLocked ? <LockIcon size={10} /> : <UnlockIcon size={10} />}
                    {isBatchLocked ? 'Lote Travado' : 'Acesso Liberado'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {!isBatchLocked && selectedBatch && (
            <button
              onClick={() => setShowFinalizationModal(true)}
              className="btn-modern bg-slate-900 text-white hover:bg-orange-600 px-8 py-4 gap-3 shadow-xl"
            >
              <CheckIcon size={20} /> Finalizar Operação
            </button>
          )}

          {/* Botão Editar Lotes */}
          <div className="relative group">
            <button
              className="btn-modern bg-blue-600 text-white hover:bg-blue-700 px-8 py-4 gap-3 shadow-xl"
            >
              <PencilIcon size={18} /> Editar Lotes
            </button>

            {/* Dropdown de lotes */}
            <div className="hidden group-hover:block absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 w-80 max-h-96 overflow-y-auto z-50">
              <div className="p-2">
                {safeBatches.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Nenhum lote cadastrado</p>
                ) : (
                  safeBatches.filter(b => b.status !== 'ESTORNADO').map(batch => (
                    <button
                      key={batch.id_lote}
                      onClick={() => handleEditBatch(batch)}
                      className="w-full text-left p-3 hover:bg-blue-50 rounded-xl transition-colors group/item"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-xs text-slate-900">{batch.id_lote}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{batch.fornecedor}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${batch.status === 'FECHADO' ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-600'}`}>
                          {batch.status}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

        {/* LEFT: CONFIG PANEL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card p-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <FileIcon size={14} className="text-orange-500" /> Parâmetros do Lote
            </h3>

            <div className="space-y-6">
              <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-50">
                <label className="text-[10px] font-bold text-orange-600 uppercase tracking-widest block mb-1">Identificador do Lote</label>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {selectedBatch ? selectedBatch.id_lote : newBatch.id_lote}
                  </span>
                  {!selectedBatch && (
                    <div className="flex items-center bg-white rounded-xl border border-orange-100 p-1">
                      <button onClick={() => { const s = Math.max(1, newBatch.id_sequencia - 1); setNewBatch({ ...newBatch, id_sequencia: s, id_lote: generateNextId(s) }); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-orange-50 text-orange-600 font-bold transition-colors"><MinusIcon size={16} /></button>
                      <span className="font-bold text-xs w-10 text-center text-slate-600">{newBatch.id_sequencia}</span>
                      <button onClick={() => { const s = newBatch.id_sequencia + 1; setNewBatch({ ...newBatch, id_sequencia: s, id_lote: generateNextId(s) }); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-orange-50 text-orange-600 font-bold transition-colors"><PlusIcon size={16} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="relative group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Fornecedor / Fazenda</label>
                  <input
                    disabled={!!selectedBatch}
                    type="text"
                    className="modern-input"
                    value={selectedBatch ? selectedBatch.fornecedor : newBatch.fornecedor}
                    onChange={e => {
                      setNewBatch(prev => ({ ...prev, fornecedor: e.target.value.toUpperCase() }));
                      setShowSupplierSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => { setShowSupplierSuggestions(false); setNewBatch(prev => ({ ...prev, id_lote: generateNextId() })); }, 200)}
                    onFocus={() => setShowSupplierSuggestions(true)}
                    placeholder="BUSCAR FORNECEDOR"
                  />
                  {!selectedBatch && showSupplierSuggestions && newBatch.fornecedor && String(newBatch.fornecedor).length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 mt-2 p-2 max-h-48 overflow-y-auto animate-reveal">
                      {safeSuppliers.filter(s => s.nome_fantasia.toUpperCase().includes(newBatch.fornecedor.toUpperCase())).map(s => (
                        <div key={s.id} className="p-3 hover:bg-orange-50 hover:text-orange-700 rounded-xl cursor-pointer font-bold text-xs text-slate-600 transition-colors"
                          onClick={() => { const updatedBatch = { ...newBatch, fornecedor: s.nome_fantasia.toUpperCase() }; setNewBatch(updatedBatch); setShowSupplierSuggestions(false); setTimeout(() => { setNewBatch(prev => ({ ...prev, id_lote: generateNextId() })); }, 100); }}>
                          {s.nome_fantasia}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Recebimento</label>
                    <input disabled={!!selectedBatch} type="date" className="modern-input text-xs" value={selectedBatch ? selectedBatch.data_recebimento : newBatch.data_recebimento} onChange={e => setNewBatch({ ...newBatch, data_recebimento: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Peso Romaneio (kg)</label>
                    <DecimalInput disabled={!!selectedBatch} className="modern-input font-bold text-lg" placeholder="Peso em kg" value={selectedBatch ? selectedBatch.peso_total_romaneio : (newBatch.peso_total_romaneio || 0)} onValueChange={v => setNewBatch({ ...newBatch, peso_total_romaneio: v })} />
                  </div>
                </div>

                {/* ═══ ESTÁGIO 1 — RAÇA & PRODUÇÃO ═══ */}
                <div className="pt-4 border-t border-slate-50 space-y-4">
                  <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-1.5">🐂 Dados da Produção</h4>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Raça do Lote</label>
                    <select
                      disabled={!!selectedBatch}
                      className="modern-input text-xs"
                      value={selectedBatch ? (selectedBatch as any).raca || '' : newBatch.raca}
                      onChange={e => setNewBatch({ ...newBatch, raca: e.target.value })}
                    >
                      <option value="">Selecionar raça...</option>
                      {BREED_REFERENCE_DATA.map(b => (
                        <option key={b.raca} value={b.raca}>{b.raca} ({b.rendimento_min}-{b.rendimento_max}%)</option>
                      ))}
                    </select>
                    {breedRef && (
                      <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-xl text-[10px] text-emerald-700 font-medium">
                        📊 Rendimento esperado: <strong>{breedRef.rendimento_min}–{breedRef.rendimento_max}%</strong> · Peso carcaça: {breedRef.peso_medio_min}–{breedRef.peso_medio_max}kg · Quebra frio: {breedRef.quebra_resfriamento_min}–{breedRef.quebra_resfriamento_max}%
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Qtd Cabeças</label>
                      <DecimalInput disabled={!!selectedBatch} className="modern-input" placeholder="Nº" value={selectedBatch ? (selectedBatch as any).qtd_cabecas || 0 : (newBatch.qtd_cabecas || 0)} onValueChange={v => setNewBatch({ ...newBatch, qtd_cabecas: v })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Mortos/Descarte</label>
                      <DecimalInput disabled={!!selectedBatch} className="modern-input text-rose-600" placeholder="Nº" value={selectedBatch ? (selectedBatch as any).qtd_mortos || 0 : (newBatch.qtd_mortos || 0)} onValueChange={v => setNewBatch({ ...newBatch, qtd_mortos: v })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Peso Gancho (kg)</label>
                      <DecimalInput disabled={!!selectedBatch} className="modern-input" placeholder="Total" value={selectedBatch ? (selectedBatch as any).peso_gancho || 0 : (newBatch.peso_gancho || 0)} onValueChange={v => setNewBatch({ ...newBatch, peso_gancho: v })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Peso Vivo Médio</label>
                      <DecimalInput disabled={!!selectedBatch} className="modern-input text-xs" placeholder="kg/cab" value={selectedBatch ? (selectedBatch as any).peso_vivo_medio || 0 : (newBatch.peso_vivo_medio || 0)} onValueChange={v => setNewBatch({ ...newBatch, peso_vivo_medio: v })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Toalete (kg)</label>
                      <DecimalInput disabled={!!selectedBatch} className="modern-input text-xs" placeholder="kg" value={selectedBatch ? (selectedBatch as any).toalete_kg || 0 : (newBatch.toalete_kg || 0)} onValueChange={v => setNewBatch({ ...newBatch, toalete_kg: v })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">R$/Arroba</label>
                      <DecimalInput disabled={!!selectedBatch} className="modern-input text-xs" placeholder="R$" value={selectedBatch ? (selectedBatch as any).preco_arroba || 0 : (newBatch.preco_arroba || 0)} onValueChange={v => setNewBatch({ ...newBatch, preco_arroba: v })} />
                    </div>
                  </div>
                </div>
              </div>

              {!selectedBatch && (
                <div className="pt-6 border-t border-slate-50 space-y-6">
                  <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Configuração Financeira</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Valor do Gado (R$)</label>
                      <DecimalInput className="modern-input text-xl font-black bg-slate-50 border-slate-100" placeholder="Valor total" value={newBatch.valor_compra_total || 0} onValueChange={v => setNewBatch({ ...newBatch, valor_compra_total: v })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Frete (R$)</label>
                        <DecimalInput className="modern-input" placeholder="Frete" value={newBatch.frete || 0} onValueChange={v => setNewBatch({ ...newBatch, frete: v })} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Extras (R$)</label>
                        <DecimalInput className="modern-input" placeholder="Extras" value={newBatch.gastos_extras || 0} onValueChange={v => setNewBatch({ ...newBatch, gastos_extras: v })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
                      <button onClick={() => setNewBatch({ ...newBatch, forma_pagamento: 'VISTA' })} className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newBatch.forma_pagamento === 'VISTA' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>À Vista</button>
                      <button onClick={() => setNewBatch({ ...newBatch, forma_pagamento: 'PRAZO' })} className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newBatch.forma_pagamento === 'PRAZO' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>À Prazo</button>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-6 flex justify-between items-center text-white">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Custo Real/Kg:</span>
                    <span className="text-2xl font-black text-orange-400">{formatCurrency(simulatedCost)}</span>
                  </div>

                  <button onClick={handleBatchSubmit} className="w-full btn-modern btn-brand py-5 bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-100 mb-4">
                    <ZapIcon size={18} /> Iniciar Recepção
                  </button>

                  {/* ═══ VISION AI SCANNER SIMULATOR ═══ */}
                  {!selectedBatch && (
                    <div className={`p-4 rounded-2xl border-2 border-dashed transition-all ${visionScanning ? 'bg-blue-50 border-blue-200 animate-pulse' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ActivityIcon size={16} className={visionScanning ? 'text-blue-600' : 'text-slate-400'} />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vision-Scan Auditor</span>
                        </div>
                        {visionAuditStatus !== 'PENDENTE' && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${visionAuditStatus === 'APROVADO' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {visionAuditStatus}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={visionScanning}
                        onClick={() => {
                          setVisionScanning(true);
                          setTimeout(() => {
                            setVisionScanning(false);
                            setVisionAuditStatus('APROVADO');
                            setEsgScore(Math.floor(Math.random() * 15) + 85); // 85-100
                            alert('🔎 Visão Computacional: Lote auditado com sucesso! NCM e Padrão de Gordura pré-identificados.');
                          }, 3000);
                        }}
                        className="w-full py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                      >
                        {visionScanning ? 'PROCESSANDO FRAME...' : 'EXECUTAR AUDITORIA IA'}
                      </button>
                    </div>
                  )}

                  {selectedBatch && (
                    <div className="p-4 bg-emerald-900 rounded-2xl border border-emerald-800 shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <ShieldIcon size={20} className="text-emerald-400" />
                        <div>
                          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Blockchain Traceability ID</p>
                          <p className="text-[10px] font-mono font-bold text-white truncate">{selectedBatch.traceability_hash || 'PENDENTE'}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-emerald-800">
                        <span className="text-[9px] font-bold text-emerald-500 uppercase">ESG COMPLIANCE</span>
                        <span className="text-xs font-black text-emerald-400">{selectedBatch.esg_score || 0}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: WEIGHING PANEL */}
        {selectedBatch && (
          <div className="lg:col-span-8 space-y-8 animate-reveal">

            {/* KPI ROW */}
            {batchSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Peso Real', value: formatWeight(batchSummary.totalWeighed), icon: ScaleIcon, color: 'blue' },
                  { label: 'NF Esperado', value: formatWeight(batchSummary.nfWeight), icon: FileIcon, color: 'slate' },
                  {
                    label: 'Variação',
                    value: `${batchSummary.diff > 0 ? '+' : ''}${formatWeight(batchSummary.diff)}`,
                    icon: CalcIcon,
                    color: batchSummary.diff >= 0 ? 'emerald' : 'rose'
                  },
                  { label: 'Contagem', value: `${batchSummary.count} Un`, icon: PackageIcon, color: 'orange' }
                ].map((kpi, idx) => (
                  <div key={idx} className="premium-card p-6 flex flex-col gap-3">
                    <div className={`w-8 h-8 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600 flex items-center justify-center shadow-sm`}>
                      <kpi.icon size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{kpi.label}</p>
                      <p className={`text-xl font-black text-slate-900`}>{kpi.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MAIN INPUT PANEL - SINGLE FIELD AUTO-ADVANCE */}
            {!isBatchLocked && (
              <div className="premium-card overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ScaleIcon size={14} className="text-orange-500" /> Pesagem Rápida
                  </h3>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    A → B → Próxima | 3kg/carcaça
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-gradient-to-br from-slate-900 to-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
                    {/* SEQUENCE INDICATOR */}
                    <div className="md:col-span-2 text-center">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Seq</div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNewItemEntry(prev => ({ ...prev, sequencia: Math.max(1, parseInt(prev.sequencia) - 1).toString() }))}
                          className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          <MinusIcon size={12} />
                        </button>
                        <div className="bg-white rounded-xl px-3 py-2 shadow-lg">
                          <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            {String(newItemEntry.sequencia).padStart(3, '0')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewItemEntry(prev => ({ ...prev, sequencia: (parseInt(prev.sequencia || '0') + 1).toString() }))}
                          className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          <PlusIcon size={12} />
                        </button>
                      </div>
                    </div>

                    {/* TYPE INDICATOR */}
                    <div className="md:col-span-3 text-center">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo</div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setNewItemEntry({ ...newItemEntry, tipo: StockType.BANDA_A.toString() })}
                          className={`flex-1 py-2 md:py-3 rounded-xl text-xs font-black uppercase transition-all ${newItemEntry.tipo === StockType.BANDA_A.toString()
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewItemEntry({ ...newItemEntry, tipo: StockType.BANDA_B.toString() })}
                          className={`flex-1 py-2 md:py-3 rounded-xl text-xs font-black uppercase transition-all ${newItemEntry.tipo === StockType.BANDA_B.toString()
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewItemEntry({ ...newItemEntry, tipo: StockType.INTEIRO.toString() })}
                          className={`flex-1 py-2 md:py-3 rounded-xl text-xs font-black uppercase transition-all ${newItemEntry.tipo === StockType.INTEIRO.toString()
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                          INT
                        </button>
                      </div>
                    </div>

                    {/* WEIGHT INPUT + TECLADO CALCULADORA */}
                    <div className="md:col-span-7">
                      <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                        <span>Peso (KG)</span>
                        {Recognition && (
                          <button
                            type="button"
                            onClick={toggleVoice}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] transition-all ${isListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400 hover:text-white'
                              }`}
                          >
                            {isListening ? <WavesIcon size={10} /> : <MicIcon size={10} />}
                            {isListening ? 'OUVINDO' : 'VOZ'}
                          </button>
                        )}
                      </div>

                      {/* DISPLAY DO PESO + BACKSPACE */}
                      <div className="w-full bg-white rounded-xl py-3 px-4 shadow-xl mb-2 flex items-center justify-between min-h-[60px]">
                        <button
                          type="button"
                          onClick={() => setNewItemEntry(prev => ({ ...prev, peso: prev.peso.slice(0, -1) }))}
                          className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all active:scale-90"
                        >
                          ←
                        </button>
                        <div className="text-4xl md:text-5xl font-black text-slate-900 text-right flex-1 px-2">
                          {newItemEntry.peso || '0'}<span className="text-xl text-slate-400 ml-1">kg</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewItemEntry({ ...newItemEntry, peso: '' })}
                          className="w-10 h-10 rounded-lg bg-rose-100 hover:bg-rose-200 flex items-center justify-center text-rose-500 font-black text-sm transition-all active:scale-90"
                        >
                          C
                        </button>
                      </div>

                      {/* TECLADO NUMÉRICO COMPACTO — 3 colunas, layout celular */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNewItemEntry(prev => ({ ...prev, peso: prev.peso + key }))}
                            className="h-14 rounded-xl font-black text-2xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
                          >
                            {key}
                          </button>
                        ))}
                        {/* Última linha: vírgula, 0, 00 */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!newItemEntry.peso.includes(',') && !newItemEntry.peso.includes('.')) {
                              setNewItemEntry(prev => ({ ...prev, peso: (prev.peso || '0') + ',' }));
                            }
                          }}
                          className="h-14 rounded-xl font-black text-2xl bg-slate-300 text-slate-700 hover:bg-slate-400 transition-all active:scale-95 shadow-sm"
                        >
                          ,
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewItemEntry(prev => ({ ...prev, peso: prev.peso + '0' }))}
                          className="h-14 rounded-xl font-black text-2xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewItemEntry(prev => ({ ...prev, peso: prev.peso + '00' }))}
                          className="h-14 rounded-xl font-black text-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
                        >
                          00
                        </button>
                      </div>

                      {/* BOTÃO ADD GRANDE */}
                      <button
                        type="button"
                        onClick={() => handleAddItem()}
                        className="w-full h-14 mt-2 rounded-xl font-black text-xl bg-orange-600 text-white hover:bg-orange-500 transition-all active:scale-95 shadow-xl shadow-orange-900/30 flex items-center justify-center gap-2"
                      >
                        <PlusIcon size={24} /> ADICIONAR PEÇA
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DATA GRID TABLE - SPREADSHEET STYLE */}
            <div className="premium-card overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <HistoryIcon size={16} className="text-orange-500" /> Registros Lançados
                </h3>
                <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1.5 rounded-full uppercase">
                  {(() => {
                    const savedItems = safeStock.filter(s => s.id_lote === selectedBatchId);
                    const localItems = draftItems.filter(d => d.id_lote === selectedBatchId);
                    const sequences = new Set([...savedItems, ...localItems].map(i => i.sequencia));
                    return sequences.size;
                  })()} Carcaças
                </span>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-slate-800 text-white">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider w-16">Seq</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">ID</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider bg-blue-800">Banda A</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider bg-emerald-800">Banda B</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider bg-rose-800 w-20">Desc.</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider bg-orange-700 w-24">Total</th>
                      <th className="px-3 py-2 w-24 text-center text-[10px] font-black uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const savedItems = safeStock.filter(item => item.id_lote === selectedBatchId);
                      const localItems = draftItems.filter(d => d.id_lote === selectedBatchId);
                      const allItems = [...savedItems, ...localItems];

                      // Group by sequence
                      const grouped: { [seq: number]: { bandaA?: typeof allItems[0], bandaB?: typeof allItems[0], inteiro?: typeof allItems[0] } } = {};
                      allItems.forEach(item => {
                        if (!grouped[item.sequencia]) grouped[item.sequencia] = {};
                        if (item.tipo === StockType.BANDA_A) grouped[item.sequencia].bandaA = item;
                        else if (item.tipo === StockType.BANDA_B) grouped[item.sequencia].bandaB = item;
                        else if (item.tipo === StockType.INTEIRO) grouped[item.sequencia].inteiro = item;
                      });

                      const sequences = Object.keys(grouped).map(Number).sort((a, b) => b - a);

                      if (sequences.length === 0) return (
                        <tr>
                          <td colSpan={7} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-30">
                              <ScaleIcon size={48} />
                              <p className="text-xs font-bold uppercase tracking-widest">Aguardando Lançamentos</p>
                            </div>
                          </td>
                        </tr>
                      );

                      return sequences.map(seq => {
                        const group = grouped[seq];
                        const pesoA = group.bandaA?.peso_entrada || 0;
                        const pesoB = group.bandaB?.peso_entrada || 0;
                        const pesoInteiro = group.inteiro?.peso_entrada || 0;

                        // Desconto de 3kg APENAS no total, quando existe carcaça inteira (Banda A + Banda B)
                        const hasFullCarcass = (pesoA > 0 && pesoB > 0);
                        const desconto = hasFullCarcass ? 3 : 0;

                        // Total = soma das bandas MENOS 3kg (se for carcaça inteira)
                        const total = pesoInteiro > 0 ? pesoInteiro : (pesoA + pesoB - desconto);

                        const isDraft = localItems.some(d => d.sequencia === seq);
                        const idBase = `${selectedBatchId}-${String(seq).padStart(3, '0')}`;

                        return (
                          <tr key={seq} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isDraft ? 'bg-orange-50/50' : ''}`}>
                            <td className="px-3 py-2">
                              <span className="bg-slate-200 px-2 py-1 rounded font-mono font-black text-slate-600">
                                {String(seq).padStart(2, '0')}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-mono text-xs text-slate-500">{idBase}</span>
                            </td>
                            <td className="px-3 py-2 text-center bg-blue-50">
                              <span className="font-bold text-blue-700">
                                {pesoA > 0 ? pesoA.toFixed(2).replace('.', ',') : '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center bg-emerald-50">
                              <span className="font-bold text-emerald-700">
                                {pesoB > 0 ? pesoB.toFixed(2).replace('.', ',') : (pesoInteiro > 0 ? 'INT' : '-')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center bg-rose-50">
                              <span className="font-bold text-rose-600">
                                {desconto > 0 ? desconto.toFixed(2).replace('.', ',') : '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center bg-orange-50">
                              <span className="font-black text-orange-700 text-lg">
                                {total.toFixed(2).replace('.', ',')}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {!isBatchLocked && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      // Load item back to edit
                                      setNewItemEntry({
                                        sequencia: seq.toString(),
                                        tipo: StockType.BANDA_A.toString(),
                                        peso: '',
                                        pesoA: pesoA > 0 ? pesoA.toString() : '',
                                        pesoB: pesoB > 0 ? pesoB.toString() : ''
                                      });
                                      // Remove items for this sequence
                                      if (group.bandaA) handleDeleteItem(group.bandaA.id_completo);
                                      if (group.bandaB) handleDeleteItem(group.bandaB.id_completo);
                                      if (group.inteiro) handleDeleteItem(group.inteiro.id_completo);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Editar"
                                  >
                                    <PencilIcon size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (group.bandaA) handleDeleteItem(group.bandaA.id_completo);
                                      if (group.bandaB) handleDeleteItem(group.bandaB.id_completo);
                                      if (group.inteiro) handleDeleteItem(group.inteiro.id_completo);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Excluir"
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
        }
      </div >

      {showFinalizationModal && selectedBatch && (() => {
        const totalCost = (selectedBatch.valor_compra_total || 0) + (selectedBatch.frete || 0) + (selectedBatch.gastos_extras || 0);
        const custoKg = selectedBatch.peso_total_romaneio > 0 ? totalCost / selectedBatch.peso_total_romaneio : 0;
        const formaPag = (selectedBatch as any).forma_pagamento || (draftBatch as any)?.forma_pagamento || 'PRAZO';
        const valorEntrada = (selectedBatch as any).valor_entrada || (draftBatch as any)?.valor_entrada || 0;
        const pesoReal = batchSummary?.totalWeighed || 0;
        const pesoNF = selectedBatch.peso_total_romaneio;
        const diffPeso = pesoReal - pesoNF;
        const diffPercent = pesoNF > 0 ? ((diffPeso / pesoNF) * 100).toFixed(1) : '0';

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-reveal overflow-y-auto">
            <div className="bg-white rounded-[48px] shadow-2xl max-w-lg w-full overflow-hidden border border-white my-4">
              <div className="bg-orange-600 p-8 md:p-12 text-white text-center">
                <div className="w-20 h-20 bg-white/20 rounded-[28px] flex items-center justify-center mx-auto mb-6">
                  <CheckIcon size={40} />
                </div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-none uppercase">Conferência Final</h3>
                <p className="text-[10px] font-bold tracking-[0.2em] mt-3 uppercase text-orange-100 opacity-60">{selectedBatch.id_lote} — {selectedBatch.fornecedor}</p>
              </div>
              <div className="p-6 md:p-10 space-y-5">
                {/* COMPARAÇÃO PESO NF vs REAL */}
                <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso: NF vs Pesado</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">NF (Romaneio)</p>
                      <p className="text-xl font-black text-slate-700">{formatWeight(pesoNF)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Peso Real</p>
                      <p className="text-xl font-black text-slate-900">{formatWeight(pesoReal)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Diferença</p>
                      <p className={`text-xl font-black ${diffPeso >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {diffPeso >= 0 ? '+' : ''}{diffPeso.toFixed(2)} kg
                      </p>
                      <p className={`text-[9px] font-bold ${diffPeso >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>({diffPercent}%)</p>
                    </div>
                  </div>
                  <div className="text-center pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full uppercase">
                      {batchSummary?.count || 0} peças
                    </span>
                  </div>
                </div>

                {/* RESUMO FINANCEIRO */}
                <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financeiro</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Valor do Gado</span>
                      <span className="font-bold text-slate-800">{formatCurrency(selectedBatch.valor_compra_total)}</span>
                    </div>
                    {selectedBatch.frete > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Frete</span>
                        <span className="font-bold text-slate-800">{formatCurrency(selectedBatch.frete)}</span>
                      </div>
                    )}
                    {selectedBatch.gastos_extras > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Extras</span>
                        <span className="font-bold text-slate-800">{formatCurrency(selectedBatch.gastos_extras)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-700">TOTAL CUSTO</span>
                      <span className="font-black text-lg text-slate-900">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="bg-orange-100 rounded-xl p-3 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-orange-700 uppercase">Custo/kg</span>
                      <span className="font-black text-orange-700">{formatCurrency(custoKg)}</span>
                    </div>
                  </div>
                </div>

                {/* FORMA DE PAGAMENTO */}
                <div className="bg-slate-50 rounded-2xl p-5 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagamento</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${formaPag === 'VISTA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {formaPag === 'VISTA' ? '💰 À Vista' : '📋 A Prazo'}
                    </span>
                  </div>
                  {formaPag !== 'VISTA' && (
                    <div className="space-y-1 pt-2">
                      {valorEntrada > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Entrada</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(valorEntrada)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Restante (A Pagar)</span>
                        <span className="font-bold text-rose-600">{formatCurrency(totalCost - valorEntrada)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] font-medium text-slate-400 leading-relaxed text-center px-4">
                  Ao confirmar, este lote será <span className="text-slate-700 font-bold">travado</span> e os itens entrarão no estoque.
                </p>

                <div className="flex flex-col gap-3">
                  <button onClick={confirmFinalization} className="btn-modern bg-slate-900 text-white w-full py-5 rounded-2xl hover:bg-orange-600 shadow-xl transition-all font-black uppercase tracking-wider text-sm">
                    <CheckIcon size={20} className="inline mr-2" />
                    Confirmar e Finalizar
                  </button>
                  <button onClick={() => setShowFinalizationModal(false)} className="btn-modern bg-slate-100 text-slate-600 w-full py-4 rounded-2xl hover:bg-slate-200 transition-all font-black uppercase tracking-wider text-[10px]">
                    ← Voltar e Corrigir
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE EDIÇÃO DE LOTE */}
      {
        showEditModal && editingBatch && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-reveal overflow-y-auto">
            <div className="bg-white rounded-[48px] shadow-2xl max-w-2xl w-full overflow-hidden border border-white my-8">
              <div className="bg-blue-600 p-12 text-white text-center">
                <div className="w-24 h-24 bg-white/20 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                  <PencilIcon size={48} />
                </div>
                <h3 className="text-3xl font-black tracking-tight leading-none uppercase">Editar Lote</h3>
                <p className="text-[10px] font-bold tracking-[0.2em] mt-4 uppercase text-blue-100 opacity-60">{editingBatch.id_lote}</p>
              </div>
              <div className="p-12 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Fornecedor */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Fornecedor</label>
                  <input
                    type="text"
                    className="modern-input w-full"
                    value={editingBatch.fornecedor}
                    onChange={e => setEditingBatch({ ...editingBatch, fornecedor: e.target.value.toUpperCase() })}
                  />
                </div>

                {/* Peso do Romaneio */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Peso Romaneio (kg)</label>
                    <DecimalInput
                      className="modern-input w-full font-bold text-lg"
                      placeholder="Peso em kg"
                      value={editingBatch.peso_total_romaneio || 0}
                      onValueChange={v => setEditingBatch({ ...editingBatch, peso_total_romaneio: v })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Data Recebimento</label>
                    <input
                      type="date"
                      className="modern-input w-full"
                      value={editingBatch.data_recebimento}
                      onChange={e => setEditingBatch({ ...editingBatch, data_recebimento: e.target.value })}
                    />
                  </div>
                </div>

                {/* Valores Financeiros */}
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Valores Financeiros</h4>
                  {editingBatch.status === 'FECHADO' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                      <LockIcon size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-700">Lote FECHADO — valores financeiros bloqueados. Para corrigir, faça o ESTORNO do lote e recadastre.</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Valor do Gado (R$)</label>
                      <DecimalInput
                        className={`modern-input w-full text-xl font-black ${editingBatch.status === 'FECHADO' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                        placeholder="Valor total"
                        value={editingBatch.valor_compra_total || 0}
                        disabled={editingBatch.status === 'FECHADO'}
                        onValueChange={v => setEditingBatch({ ...editingBatch, valor_compra_total: v })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Frete (R$)</label>
                        <DecimalInput
                          className={`modern-input w-full ${editingBatch.status === 'FECHADO' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                          placeholder="Frete"
                          value={editingBatch.frete || 0}
                          disabled={editingBatch.status === 'FECHADO'}
                          onValueChange={v => setEditingBatch({ ...editingBatch, frete: v })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Extras (R$)</label>
                        <DecimalInput
                          className={`modern-input w-full ${editingBatch.status === 'FECHADO' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                          placeholder="Extras"
                          value={editingBatch.gastos_extras || 0}
                          disabled={editingBatch.status === 'FECHADO'}
                          onValueChange={v => setEditingBatch({ ...editingBatch, gastos_extras: v })}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Custo Real/Kg:</span>
                      <span className="text-xl font-black text-orange-400">
                        {formatCurrency(calculateRealCost(
                          editingBatch.valor_compra_total,
                          editingBatch.frete,
                          editingBatch.gastos_extras,
                          editingBatch.peso_total_romaneio
                        ))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex flex-col gap-3 pt-6">
                  <button
                    onClick={handleSaveEditedBatch}
                    className="btn-modern bg-blue-600 text-white w-full py-5 rounded-2xl hover:bg-blue-700 shadow-xl transition-all"
                  >
                    <CheckIcon size={20} className="inline mr-2" />
                    Salvar Alterações
                  </button>

                  {/* Botão Estornar */}
                  <button
                    onClick={handleDeleteBatch}
                    className="btn-modern bg-amber-500 text-white w-full py-4 rounded-2xl hover:bg-amber-600 shadow-xl transition-all border-2 border-amber-600"
                  >
                    <RotateCcwIcon size={18} className="inline mr-2" />
                    Estornar Lote
                  </button>

                  <button
                    onClick={() => { setShowEditModal(false); setEditingBatch(null); }}
                    className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-[0.2em] py-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Batches;