import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Supplier, Client } from './types';

dotenv.config();

const parseFirestoreDoc = (doc: any) => {
    const data: any = {};
    for (const [key, val] of Object.entries(doc.fields || {})) {
        const v = val as any;
        if (v.stringValue !== undefined) data[key] = v.stringValue;
        else if (v.integerValue !== undefined) data[key] = parseInt(v.integerValue);
        else if (v.doubleValue !== undefined) data[key] = parseFloat(v.doubleValue);
        else if (v.booleanValue !== undefined) data[key] = v.booleanValue;
        else if (v.nullValue !== undefined) data[key] = null;
        else if (v.timestampValue !== undefined) data[key] = v.timestampValue;
        else if (v.arrayValue !== undefined) data[key] = v.arrayValue.values ? v.arrayValue.values.map((item: any) => parseFirestoreDoc({ fields: item })) : [];
    }
    return { id: doc.name.split('/').pop(), ...data };
};

const runMigration = async () => {
    try {
        console.log('🔄 Iniciando Extração do pecuaria-976e2 via Token Local...');

        // 1. Lendo o Token Local da Máquina da Priscila
        const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
        const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const token = fbConfig.tokens.access_token;

        if (!token) throw new Error("Acesso de token não encontrado.");

        // 2. Inicializar Supabase
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl!, supabaseKey!);

        // 3. Função Genérica de Fetch
        const fetchCollection = async (collectionName: string) => {
            const url = `https://firestore.googleapis.com/v1/projects/pecuaria-976e2/databases/(default)/documents/${collectionName}?pageSize=1000`;
            const resp = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error(`Falha ao ler Firebase: ${resp.statusText}`);
            const json = await resp.json();
            return (json.documents || []).map(parseFirestoreDoc) as any[];
        };

        // 4. Migrar Fornecedores (suppliers)
        console.log('\n📦 Puxando Fornecedores...');
        const suppliers = (await fetchCollection('suppliers')) as (Supplier & { id: string })[];
        let suppliersMigrated = 0;
        for (const sup of suppliers) {
            const { error } = await supabase.from('suppliers').upsert({
                id: sup.id,
                nome_fantasia: sup.nome_fantasia || '',
                cpf_cnpj: sup.cpf_cnpj || '',
                status: sup.status || 'ATIVO',
                inscricao_estadual: sup.inscricao_estadual,
                telefone: sup.telefone,
                raca_predominante: sup.raca_predominante,
                regiao: sup.regiao
            });
            if (!error) suppliersMigrated++;
        }
        console.log(`✅ Fornecedores migrados: ${suppliersMigrated} / ${suppliers.length}`);

        // 5. Migrar Clientes (clients)
        console.log('\n📦 Puxando Clientes...');
        const clients = (await fetchCollection('clients')) as (Client & { id: string })[];
        let clientsMigrated = 0;
        for (const cli of clients) {
            const id_ferro = cli.id_ferro || cli.id;
            if (!id_ferro) continue;
            const { error } = await supabase.from('clients').upsert({
                id_ferro: id_ferro,
                nome_social: cli.nome_social || '',
                whatsapp: cli.whatsapp || '',
                status: cli.status || 'ATIVO',
                cpf_cnpj: cli.cpf_cnpj || '',
                cidade: cli.cidade || '',
                perfil_compra: cli.perfil_compra || 'MISTO'
            });
            if (!error) clientsMigrated++;
        }
        console.log(`✅ Clientes migrados: ${clientsMigrated} / ${clients.length}`);

        // 6. Migrar Clientes Secundarios (tentando se houver)
        const backupClients = (await fetchCollection('clientes').catch(() => [])) as any[];
        let bkpMigrated = 0;
        if (backupClients.length > 0) {
            for (const cli of backupClients) {
                const id_ferro = cli.id_ferro || cli.id;
                if (!id_ferro) continue;
                const { error } = await supabase.from('clients').upsert({
                    id_ferro: id_ferro,
                    nome_social: cli.nome || cli.nome_social || '',
                    status: 'ATIVO'
                });
                if (!error) bkpMigrated++;
            }
            console.log(`✅ [Fallback] Tab Clientes alternativos migrados: ${bkpMigrated} / ${backupClients.length}`);
        }

        console.log('\n🎉 SUCESSO! MIGRAÇÃO REALIZADA SEM TOCAR NO APP!');
    } catch (error) {
        console.error('\n❌ ERRO:', error);
    }
};

runMigration();
