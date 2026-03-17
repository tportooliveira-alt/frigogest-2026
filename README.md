# 🥩 FrigoGest — Sistema de Gestão de Frigorífico

**FG-PRO v3.0.0** · React + TypeScript + Supabase

Sistema completo de gestão para frigoríficos, com controle de lotes, estoque, vendas, financeiro e agentes de IA integrados.

---

## 🚀 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Estilo | Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) |
| IA | Google Gemini (@google/genai) |
| Gráficos | Recharts |
| Deploy | GitHub Pages / Firebase Hosting |

---

## 📦 Módulos

- **Lotes** — Entrada de gado, GTA, custo real por kg
- - **Estoque** — Controle de bandas/carcaças por animal
  - - **Vendas** — Expedição com cálculo de peso real e lucro
    - - **Financeiro** — Fluxo de caixa, DRE, contas a pagar/receber, estornos atômicos
      - - **Clientes & Fornecedores** — Cadastro com histórico
        - - **IA** — Agentes especializados (financeiro, comercial, jurídico), Chat, Sala de Guerra, AIOS
          - - **Mercado** — Motor de precificação V4, análise Monte Carlo, alertas de cotação
            - - **Relatórios** — Auditoria completa, relatório diário colaboradores
             
              - ---

              ## ⚙️ Instalação

              ```bash
              npm install
              npm run dev
              ```

              ### Variáveis de ambiente (`.env`)

              ```env
              VITE_SUPABASE_URL=your_supabase_url
              VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
              VITE_GEMINI_API_KEY=your_gemini_api_key
              VITE_OFFLINE_MODE=false
              ```

              ---

              ## 🗄️ Banco de dados

              Os scripts SQL de setup estão na pasta `/db`:

              - `db/supabase_setup.sql` — Estrutura principal das tabelas
              - - `db/supabase_fase1_migration.sql` — Migração fase 1
                - - `db/supabase_market_alerts.sql` — Tabela de alertas de mercado
                 
                  - ---

                  ## 🏗️ Deploy

                  ```bash
                  npm run build
                  firebase deploy --only hosting
                  ```

                  ---

                  ## 📋 Controle de versão

                  A versão é centralizada em `constants.ts`:

                  - `APP_VERSION` — número da versão
                  - - `APP_BUILD_DATE` — data do build
                    - - `APP_VERSION_LABEL` — label completo (ex: `FG-PRO_v3.0.0`)
                     
                      - ---

                      ## 📄 Licença

                      Projeto privado. Todos os direitos reservados.
