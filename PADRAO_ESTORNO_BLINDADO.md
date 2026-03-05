# Padrão: Estorno Blindado (Atomicity)

Este documento guarda a referência de como os estornos e operações críticas devem ser feitos para garantir a integridade do estoque e do fluxo de caixa: Tudo de uma vez, ou nada.

```javascript
// Exemplo fornecido pelo dev responsavel - Estorno Blindado com Transaction
const estornoTotal = async (vendaId, loteId, valor, peso) => {
  const sfDocRef = db.collection('financeiro').doc('caixa_geral');
  const loteRef = db.collection('lotes').doc(loteId);

  try {
    await db.runTransaction(async (transaction) => {
      // 1. Tira o dinheiro do Caixa (Saída)
      transaction.update(sfDocRef, { 
        saldo: admin.firestore.FieldValue.increment(-valor) 
      });

      // 2. Devolve o peso exato para o Lote de Origem
      transaction.update(loteRef, { 
        estoque_kg: admin.firestore.FieldValue.increment(peso) 
      });

      // 3. Cria o registro do estorno para o histórico
      const logRef = db.collection('historico_estornos').doc();
      transaction.set(logRef, {
        venda_id: vendaId,
        valor_estornado: valor,
        peso_devolvido: peso,
        data: new Date()
      });
    });
    console.log("Sucesso! Dinheiro saiu e carne voltou.");
  } catch (e) {
    console.error("Erro! Nada foi alterado para não quebrar o caixa.", e);
  }
};
```

**Regras no React com Modular SDK (`firebase/firestore`):**
Use `writeBatch(db)` para empacotar as operações!
1. `const batch = writeBatch(db);`
2. `batch.update(docRef, { status: 'ESTORNADO' })`
3. `batch.set(txRef, newTransaction)`
4. `await batch.commit();`
