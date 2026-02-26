import { CURRENT_DATE } from '../constants';
import { Client, Sale } from '../types';

export const calculateDaysInStock = (entryDate: string): number => {
  const start = new Date(entryDate);
  const current = new Date(); // Always use live date, not static CURRENT_DATE
  const diffTime = Math.abs(current.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getMaturationStatus = (days: number) => {
  if (days <= 1) return { label: 'Resfriamento', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100', status: 'fresh' };
  if (days <= 4) return { label: 'Pronto (Ápice)', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', status: 'prime' };
  if (days <= 7) return { label: 'Alerta Venda', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', status: 'warning' };
  return { label: 'Risco Quebra', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', status: 'critical' };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatWeight = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' kg';
};

// Logic required by prompt for Cost Calculation
export const calculateRealCost = (
  purchaseTotal: number,
  freight: number,
  extras: number,
  totalWeight: number
): number => {
  if (totalWeight === 0) return 0;
  return (purchaseTotal + freight + extras) / totalWeight;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;

  const separator = ';'; // Using semicolon for better Excel compatibility in Brazil/Europe
  const keys = Object.keys(data[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    data.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = cell instanceof Date
          ? cell.toLocaleString()
          : cell.toString().replace(/"/g, '""'); // Escape double quotes

        // Wrap in quotes if contains separator, newline or quotes
        if (cell.search(new RegExp(`("|${separator}|\n)`)) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');

  // Add BOM for UTF-8 compatibility in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const calculateCreditScore = (client: Client, sales: Sale[], today: string) => {
  const clientSales = sales.filter(s => s.id_cliente === client.id_ferro);
  const pendingSales = clientSales.filter(s => s.status_pagamento === 'PENDENTE');
  const overdueSales = pendingSales.filter(s => s.data_vencimento < today);

  const totalVolume = clientSales.reduce((acc, s) => acc + (s.peso_real_saida * s.preco_venda_kg), 0);
  const limitUsage = client.limite_credito > 0 ? (client.saldo_devedor / client.limite_credito) : 0;

  let score = 5; // 5 stars base
  let tier: 'AAA' | 'A' | 'B' | 'C' | 'F' = 'AAA';
  let reason = 'Cliente Exemplar';

  if (overdueSales.length > 0) {
    score -= 2;
    tier = 'C';
    reason = 'Faturas em Atraso';
  }

  if (limitUsage > 0.8) {
    score -= 1;
    if (tier === 'AAA') tier = 'A';
    reason = 'Limite Próximo ao Fim';
  }

  if (client.saldo_devedor > client.limite_credito && client.limite_credito > 0) {
    score -= 2;
    tier = 'C';
    reason = 'Limite Excedido';
  }

  const daysOverdue = overdueSales.reduce((max, s) => {
    const diff = Math.ceil((new Date(today).getTime() - new Date(s.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(max, diff);
  }, 0);

  if (daysOverdue > 10) {
    score = 1;
    tier = 'F';
    reason = 'Risco Iminente (Fumo)';
  }

  if (totalVolume > 100000 && overdueSales.length === 0 && limitUsage < 0.6) {
    tier = 'AAA';
    score = 5;
    reason = 'Parceiro Estratégico (Ouro)';
  }

  return {
    stars: Math.max(1, Math.min(5, score)),
    tier,
    reason,
    color: tier === 'AAA' ? 'text-emerald-500' : tier === 'A' ? 'text-blue-500' : tier === 'C' ? 'text-orange-600' : tier === 'F' ? 'text-rose-600' : 'text-slate-600',
    border: tier === 'F' ? 'border-rose-100' : 'border-slate-100',
    bg: tier === 'F' ? 'bg-rose-50' : 'bg-slate-50'
  };
};