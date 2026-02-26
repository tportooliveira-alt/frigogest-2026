import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function analyze() {
    console.log("Fetching data...");
    const [batchesSnap, transactionsSnap, payablesSnap, salesSnap] = await Promise.all([
        getDocs(collection(db, 'batches')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'payables')),
        getDocs(collection(db, 'sales'))
    ]);

    const batches = batchesSnap.docs.map(d => d.data());
    const transactions = transactionsSnap.docs.map(d => d.data());
    const payables = payablesSnap.docs.map(d => d.data());
    const sales = salesSnap.docs.map(d => d.data());

    console.log(`Loaded ${transactions.length} transactions, ${batches.length} batches, ${payables.length} payables, ${sales.length} sales.`);

    // Logic from Financial.tsx
    const closedBatches = batches.filter(b => b.status === 'FECHADO');
    const validLoteIds = new Set(closedBatches.map(b => b.id_lote));
    const hasValidBatches = closedBatches.length > 0;

    const validTransactions = transactions.filter(t => {
        if (!t.referencia_id) return true;
        if (validLoteIds.has(t.referencia_id)) return true;
        if (t.id?.startsWith('TR-REC-') || t.id?.startsWith('TR-PAY-') || t.categoria === 'VENDA') return true;
        if (t.id?.startsWith('TR-ESTORNO-') || t.categoria === 'ESTORNO') return true;
        if (t.id?.startsWith('TR-DESC-') || t.categoria === 'DESCONTO') return true;
        if (!t.referencia_id.includes('-')) return true;
        if (hasValidBatches) return false;
        return true;
    });

    console.log(`Valid transactions: ${validTransactions.length}`);

    const totalEntradas = validTransactions.filter(t => t.tipo === 'ENTRADA').reduce((a, t) => a + t.valor, 0);
    const totalSaidas = validTransactions.filter(t => t.tipo === 'SAIDA').reduce((a, t) => a + t.valor, 0);

    console.log(`\n--- FLUXO DE CAIXA (Financial.tsx) ---`);
    console.log(`ENTRADAS: R$ ${totalEntradas.toFixed(2)}`);
    console.log(`SAIDAS:   R$ ${totalSaidas.toFixed(2)}`);
    console.log(`SALDO:    R$ ${(totalEntradas - totalSaidas).toFixed(2)}`);

    console.log(`\n--- ALL TRANSACTIONS (RAW) ---`);
    const rawEntradas = transactions.filter(t => t.tipo === 'ENTRADA').reduce((a, t) => a + t.valor, 0);
    const rawSaidas = transactions.filter(t => t.tipo === 'SAIDA').reduce((a, t) => a + t.valor, 0);
    console.log(`ENTRADAS: R$ ${rawEntradas.toFixed(2)}`);
    console.log(`SAIDAS:   R$ ${rawSaidas.toFixed(2)}`);

    console.log(`\n--- PAYABLES ---`);
    const validPayables = payables.filter(p => {
        if (p.status === 'ESTORNADO' || p.status === 'CANCELADO') return false;
        if (p.id_lote) return validLoteIds.has(p.id_lote);
        if (p.categoria === 'COMPRA_GADO' && p.descricao) {
            const match = p.descricao.match(/Lote ([A-Z0-9]+-\d{4}-\d+)/);
            if (match) return validLoteIds.has(match[1]);
            return false;
        }
        return true;
    });

    const totalPayable = validPayables.reduce((acc, p) => acc + (Number(p.valor) - (Number(p.valor_pago) || 0)), 0);
    console.log(`Total a Pagar: R$ ${totalPayable.toFixed(2)}`);

    console.log(`\n--- SAIDAS DETAILS (VALID TRANSACTIONS) ---`);
    validTransactions.filter(t => t.tipo === 'SAIDA').forEach(t => {
        console.log(`- [${t.data}] ${t.categoria}: ${t.descricao} (R$ ${t.valor.toFixed(2)})`);
    });

    process.exit(0);
}

analyze().catch(console.error);
