# 🥩 FrigoGest - FG-PRO v2.7.0

## ⚠️ ESTA É A VERSÃO OFICIAL DE PRODUÇÃO

- **Deploy:** Firebase Hosting
- **Versão:** FG-PRO_v2.7.0
- **Última atualização:** 24/02/2026
- **Versão centralizada em:** `constants.ts` → `APP_VERSION`

> **NÃO USE a pasta `frigogest-producao-ANTIGO-NAO-USAR`!**
> Ela é uma versão antiga e está arquivada.

## Controle de Versão

A versão do sistema é controlada centralmente em `constants.ts`:
- `APP_VERSION` — número da versão (ex: `2.7.0`)
- `APP_BUILD_DATE` — data do build (ex: `2026-02-24`)
- `APP_VERSION_LABEL` — label completo (ex: `FG-PRO_v2.7.0`)

Essa versão aparece automaticamente em:
- ✅ Tela de Login
- ✅ Menu Principal (Sidebar)
- ✅ Barra de Status (rodapé)

## Como fazer deploy

```bash
npm run build
firebase deploy --only hosting
```

## Changelog v2.7.0
- ✅ Input decimal corrigido (vírgula/ponto)
- ✅ Componente `DecimalInput` criado
- ✅ Versão centralizada em `constants.ts`
- ✅ Data do build visível no app
