/**
 * Script para limpar TODOS os dados do Firebase (exceto clientes e fornecedores)
 * Execute com: node cleanFirebase.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { config } from 'dotenv';

// Carrega variáveis do .env
config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('🔧 Configuração Firebase:');
console.log('  Project ID:', firebaseConfig.projectId);

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ ERRO: Variáveis de ambiente do Firebase não encontradas!');
    console.log('  Verifique se o arquivo .env está configurado corretamente.');
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Coleções a serem limpas (NÃO inclui 'clients' e 'suppliers')
const collectionsToClean = [
    'batches',
    'sales',
    'stock_items',
    'transactions',
    'scheduled_orders',
    'daily_reports',
    'payables'
];

async function cleanCollection(collectionName) {
    console.log(`\n🗑️  Limpando: ${collectionName.toUpperCase()}...`);

    try {
        const snapshot = await getDocs(collection(db, collectionName));

        if (snapshot.empty) {
            console.log(`   ✅ ${collectionName} já está vazio`);
            return 0;
        }

        // Firebase limita writeBatch a 500 operações
        const batchSize = 450;
        let deleted = 0;
        let batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snapshot.docs) {
            batch.delete(doc(db, collectionName, docSnap.id));
            count++;
            deleted++;

            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        console.log(`   ✅ ${deleted} documentos deletados de ${collectionName}`);
        return deleted;
    } catch (error) {
        console.error(`   ❌ Erro ao limpar ${collectionName}:`, error.message);
        return 0;
    }
}

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('🧹 LIMPEZA COMPLETA DO FIREBASE - FRIGOGEST');
    console.log('═'.repeat(60));
    console.log('\n⚠️  Esta operação irá DELETAR todos os dados de operação!');
    console.log('✅ PRESERVADOS: Clientes e Fornecedores\n');

    let totalDeleted = 0;

    for (const collectionName of collectionsToClean) {
        const count = await cleanCollection(collectionName);
        totalDeleted += count;
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ LIMPEZA COMPLETA!`);
    console.log(`📊 Total de ${totalDeleted} documentos removidos`);
    console.log('📋 Clientes e Fornecedores foram PRESERVADOS');
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
}

main().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
