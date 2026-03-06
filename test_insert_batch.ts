import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    // 1. Autenticar usando as credenciais da usuária (Padrão para testar admin@sistema.com)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@sistema.com',
        password: 'admin' // Se for outra, não conseguiremos testar, mas vamos tentar
    });

    if (authError) {
        console.error('Falha na autenticação (Precisamos de uma sessão do app real para o teste RLS):', authError.message);
        return;
    }

    console.log('Autenticado com sucesso!');

    const mockBatch = {
        id_lote: 'LOTE-TESTE-' + Date.now(),
        fornecedor: 'Fazenda Teste',
        data_recebimento: '2026-03-06',
        peso_total_romaneio: 1000,
        valor_compra_total: 10000,
        frete: 0,
        gastos_extras: 0,
        forma_pagamento: 'PRAZO',
        valor_entrada: 0,
        prazo_dias: 30,
        status: 'ABERTO',
        raca: '',
        qtd_cabecas: 10,
        peso_vivo_medio: 100,
        peso_gancho: 0,
        toalete_kg: 0,
        preco_arroba: 0,
        qtd_mortos: 0,
        custo_real_kg: 10,
        traceability_hash: 'HASH123',
        vision_audit_status: 'PENDENTE',
        esg_score: 85
    };

    const { data, error } = await supabase.from('batches').upsert(mockBatch).select();

    if (error) {
        console.error('❌ ERRO NO SUPABASE AO INSERIR LOTE:');
        console.error(error);
    } else {
        console.log('✅ SUCESSO AO INSERIR LOTE:', data);

        // Clean up
        await supabase.from('batches').delete().eq('id_lote', mockBatch.id_lote);
    }
}

testInsert();
