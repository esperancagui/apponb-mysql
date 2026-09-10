<div align="center">

# onb.

**Plataforma inteligente de briefing para profissionais**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.133-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python)](https://www.python.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)

Crie formulários de briefing profissionais, personalize a aparência para cada cliente e receba respostas organizadas em uma inbox inteligente — tudo com uma experiência visual premium.

> **Esta é a versão de testes com MySQL.** Mesmo produto, mesma UI, mesmos contratos de API — mas Firebase (Auth, Firestore, Cloud Storage) foi substituído por MySQL, JWT local e MinIO, então o stack inteiro sobe offline com `docker compose up`, sem projeto externo pra configurar.

</div>

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Planos](#-planos)
- [Stack Tecnológica](#-stack-tecnológica)
- [Como Rodar](#-como-rodar)
- [Testes](#-testes)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Arquitetura](#-arquitetura)
- [Conformidade LGPD](#-conformidade-lgpd)
- [Deploy](#-deploy)

---

## 🎯 Visão Geral

O **onb.** foi criado para profissionais de design, marketing e comunicação que precisam coletar briefings de clientes de forma organizada e visualmente atraente. A plataforma permite criar formulários customizados com aparência de marca própria, compartilhá-los via link público e gerenciar as respostas em uma inbox centralizada com triagem inteligente.

---

## ✨ Funcionalidades

### 🏠 Dashboard — Inbox Inteligente

- **Visão unificada** de respostas e formulários com abas segmentadas (Respostas / Meus Formulários)
- **Busca universal** que filtra tanto respostas quanto formulários na aba ativa
- **Métricas clicáveis** (Todas, Novas, Em revisão, Risco) para filtragem rápida
- **Ordenação inteligente** por recência, risco, anexos pendentes ou mais antigos
- **Painel lateral (Sheet)** para pré-visualizar respostas sem sair da inbox
- **Ações rápidas**: copiar link, publicar/despublicar, duplicar e deletar formulários
- **Atalhos de formulários** com suporte a pins para acesso rápido

### 📝 Editor de Formulários

- **Builder visual drag-and-drop** com preview de arrastar customizado
- **Seções agrupáveis** com título editável, duplicação e reordenação
- **7 tipos de campo**: Texto, Textarea, Select, E-mail, Telefone, Upload de Arquivo e Escala
- **Campos condicionais** com dependências (`dependsOn` / `dependsOnValue`)
- **Máscaras de input**: CPF, CNPJ, Telefone, CEP, Moeda e Data
- **Validação de arquivos**: tipos permitidos, tamanho máximo, dimensões mínimas
- **Indicadores de drop** animados com efeito de glow azul durante a reorganização
- **Inspector lateral** para edição detalhada de cada campo

### 🎨 Editor de Aparência (Branding)

- **6 presets de tema** prontos para usar (Minimal, Luxo, Tech, Suave, Forte, Escuro)
- **Design padrão do workspace** — salve e aplique em novos formulários automaticamente
- **Modo claro / escuro / automático** para os formulários públicos
- **Upload de logo** com controle de tamanho (P → XG), posição e formato (livre, quadrado, círculo)
- **Imagem de capa** com opções de preenchimento, contenção e posicionamento
- **14 famílias de fontes** do Google Fonts (Inter, Poppins, Space Grotesk, Playfair Display, etc.)
- **Controle granular**: cor primária, cor de fundo (sólido, gradiente ou pattern), arredondamento global, estilo de botão (Sólido, Suave, Outline, Gradiente) e estilo de campo (Bordado, Preenchido, Linha)
- **Efeitos visuais**: animações (Off, Sutil, Expressivo), glassmorphism, microinterações, grain de fundo
- **Cores avançadas**: título do hero, subtítulo, cor da dica, cor de borda da logo, fundo da logo
- **SEO & Meta Tags**: título, descrição, imagem OG personalizáveis
- **Integração social**: vídeo de boas-vindas, WhatsApp, Instagram, website na tela de agradecimento

### 🗂️ Templates

- **Templates pré-construídos** para Identidade Visual, Website e Social Media
- **Criação de templates personalizados** com nome, descrição, categoria e ícone
- **Edição de perguntas e aparência** de cada template
- **Deleção de templates** com diálogo de confirmação
- **Acesso rápido** via Command Palette (⌘K → "Novo template")

### 📱 Formulário Público

- **Link compartilhável** (`/f/[slug]`) com aparência totalmente personalizada
- **Renderização responsiva** que se adapta a mobile, tablet e desktop
- **Tela de boas-vindas** com logo, título e mensagem customizada
- **Upload de arquivos** com preview visual, enviados via API para o MinIO
- **Tela de agradecimento** com links sociais (WhatsApp, Instagram, Website)
- **Badge premium "onb."** com animação glassmorphism

### 🧠 Inteligência Artificial

- **Resumo Executivo Automático:** A IA lê a submissão e cria um parágrafo resumindo as dores do cliente
- **Avaliação de Risco (Risk Assessment):** Indicadores visuais do nível de alinhamento com o cliente (Alto, Médio, Baixo)
- **Extração de Perfil:** AI traça o perfil do cliente e extrai "Red Flags" (alertas vermelhos)
- **Plano de Ação:** Geração de perguntas recomendadas para a reunião de kickoff
- **Validação Inteligente de Assets:** Verificação de qualidade dos arquivos e logos enviados
- **Relatório em PDF:** Exportação do insight completo via WeasyPrint

### 🏢 Workspaces & Multi-tenant

- **Isolamento de Dados:** Cada usuário pode ter múltiplos espaços de trabalho
- **Gestão de Membros:** Convite de membros com papéis (Proprietário, Admin, Membro, Visualizador)
- **Sistema de Convites:** Links com código + convites por e-mail via Resend
- **Alternância de Contexto:** Troca rápida de Workspace com dados atualizados em tempo real
- **Identidade Visual:** Logo, nome e cor de marca personalizáveis por workspace
- **Pastas:** Organização de formulários em pastas dentro de cada workspace

### 💳 Billing & Planos

- **Checkout local (stub):** Nesta versão de testes não há Stripe — `POST /api/billing/checkout` atualiza o plano diretamente no banco
- **Limites por plano:** Controle de formulários ativos, respostas mensais, membros e armazenamento aplicados automaticamente no servidor (`plan_limits.py`)
- **Trial de 15 dias:** Acesso completo sem cartão de crédito, com countdown visível
- **Upgrade Banner:** Banner contextual exibido quando o usuário atinge limites do plano

### 🔔 Notificações em Tempo Real

- **Socket.IO:** Conexão persistente autenticada com o token JWT local
- **Rooms por contexto:** Cada usuário entra nos rooms `user:{uid}` e `workspace:{id}` de todos os seus workspaces
- **Central de Notificações:** Painel lateral com agrupamento por período (Hoje, Ontem, Anteriores)
- **Tipos de notificação:** Nova resposta, análise de IA concluída, alto risco, status atualizado, convite recebido, limite de plano atingido
- **Ações inline:** Aceitar/recusar convites diretamente na notificação
- **Filtros:** Todas / Não lidas com contadores em tempo real

### 👤 Perfil & Conta

- **Edição de perfil:** Nome de exibição e foto com crop circular
- **Segurança:** Alteração de senha (e-mail/senha) ou indicador de login Google
- **Preferências:** Notificações por e-mail, idioma da interface (PT-BR, EN, ES)
- **Gestão de conta:** Pausar ou excluir conta com confirmação por e-mail
- **Exportação de dados (LGPD):** Solicitação por e-mail com JSON completo + CSV de respostas

### 🔒 Segurança e Anti-abuso

- **Autenticação:** JWT próprio (E-mail/Senha) emitido e validado pelo backend — login com Google não está disponível nesta versão
- **Blacklist de tokens:** JTI blacklistado no MySQL após logout para impedir reutilização
- **Fingerprint de dispositivo:** `@fingerprintjs/fingerprintjs` detecta reutilização do mesmo navegador para novo trial
- **Validação de domínio de e-mail:** Blocklist de ~400 provedores descartáveis + verificação de MX/A via DNS (timeout 5s)
- **Soft delete:** Conta deletada mantém e-mail no MySQL para bloquear novo trial com o mesmo e-mail
- **Aceite de termos:** Obrigatório na tela de cadastro antes de qualquer ação (e-mail ou Google)
- **Cookie Banner:** Aviso de consentimento de cookies em conformidade com LGPD
- **Permissões por workspace:** Roles (owner, admin, member, viewer) com controle granular

### 🖼️ Upload & Crop de Imagens

- **Modal de crop reutilizável** para foto de perfil e logo de workspace
- **Crop circular** com pan e zoom via mouse/touch
- **Preview em tempo real** antes do upload para o storage (MinIO)

### ⌨️ Command Palette (⌘K)

- **Busca global** de formulários por nome
- **Ações rápidas**: Novo formulário, Novo template, Ajustes
- **Atalho de teclado** `Ctrl+K` / `⌘K`

---

## 💰 Planos

| Recurso                  | Teste Grátis (15 dias) | Pro (R$ 59,90/mês) | Agency (R$ 149,90/mês) |
| ------------------------ | ---------------------- | ------------------- | ---------------------- |
| Workspaces               | 3                      | 3                   | Ilimitados             |
| Formulários ativos       | Ilimitados             | Ilimitados          | Ilimitados             |
| Respostas/mês            | 2.000                  | 2.000               | Ilimitadas             |
| Membros na equipe        | 10                     | 10                  | Ilimitados             |
| Armazenamento            | 10 GB                  | 10 GB               | 100 GB                 |
| Templates                | Todos                  | Todos               | Todos                  |
| Análise de IA            | ✅ Completa              | ✅ Completa          | ✅ Completa             |
| Branding personalizado   | ✅                      | ✅                   | ✅                      |
| White-label completo     | —                      | —                   | ✅                      |
| Suporte prioritário 24/7 | —                      | —                   | ✅                      |

---

## 🛠️ Stack Tecnológica

### Frontend (`client/`)

| Camada              | Tecnologia                       |
| ------------------- | -------------------------------- |
| **Framework**       | Next.js 16 (App Router)          |
| **UI Library**      | React 19                         |
| **Linguagem**       | TypeScript 5                     |
| **Estilização**     | Tailwind CSS 4                   |
| **Componentes**     | Radix UI + shadcn/ui             |
| **Ícones**          | Lucide React                     |
| **Animações**       | Framer Motion                    |
| **Command Palette** | cmdk                             |
| **Toasts**          | Sonner                           |
| **Datas**           | date-fns (pt-BR)                 |
| **Auth**            | JWT próprio (`authClient.ts`)    |
| **Real-time**       | socket.io-client                 |
| **Fingerprint**     | @fingerprintjs/fingerprintjs     |

### Backend (`server/`)

| Camada             | Tecnologia                       |
| ------------------ | -------------------------------- |
| **Framework**      | FastAPI (Python 3.13)            |
| **Banco de Dados** | MySQL 8.4 (aiomysql)              |
| **Autenticação**   | JWT próprio + scrypt             |
| **Storage**        | MinIO (S3-compatível)            |
| **IA**             | DeepSeek / Gemini (API compatível OpenAI) |
| **E-mail**         | Resend                           |
| **PDF**            | WeasyPrint                       |
| **Real-time**      | Socket.IO (python-socketio)      |
| **Validação**      | Pydantic v2                      |
| **Billing**        | Stub local (sem Stripe)          |
| **DNS**            | dnspython (validação de MX)      |
| **Gerenciador**    | uv                               |

### Infraestrutura

| Camada            | Tecnologia              |
| ----------------- | ----------------------- |
| **Containers**    | Docker + Docker Compose |
| **Auth Provider** | JWT próprio             |
| **Database**      | MySQL                   |
| **File Storage**  | MinIO                   |

---

## 🚀 Como Rodar

### Pré-requisitos

- **Docker** e **Docker Compose** (único pré-requisito real — MySQL, Redis e MinIO sobem nos containers)
- **Node.js** 18.17+ (só para dev local do client, fora do Docker)
- **Python** 3.13+ e **uv** (só para dev local do server, fora do Docker)

Nenhum projeto externo é necessário — nem Firebase, nem conta AWS. `DEEPSEEK_API_KEY`/`GEMINI_API_KEY`
e `RESEND_API_KEY` são opcionais: sem eles, a análise de IA e o envio de e-mails simplesmente não
disparam, o resto da aplicação funciona normalmente.

### Com Docker Compose (recomendado)

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd apponb-mysql

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Gere JWT_SECRET e INTERNAL_SECRET (ex: `openssl rand -hex 32`) e escolha uma MYSQL_PASSWORD.
# DEEPSEEK_API_KEY/GEMINI_API_KEY/RESEND_API_KEY são opcionais.

# 3. Inicie os serviços (client, server, worker, mysql, redis, minio)
docker compose -f docker-compose.dev.yml up --build
```

O schema do MySQL é carregado uma única vez de `server/schema.sql` na primeira subida do container
`mysql`. O console do MinIO fica em **[http://localhost:9001](http://localhost:9001)** (login padrão
`minioadmin` / `minioadmin`).

O client estará em **[http://localhost:3000](http://localhost:3000)** e o server em **[http://localhost:8000](http://localhost:8000)**.

### Sem Docker (dev local)

```bash
# Client
cd client
npm install
npm run dev

# Server (em outro terminal)
cd server
uv sync
uv run uvicorn main:socket_app --reload --port 8000
```

> O entrypoint do server é `main:socket_app` (não `main:app`) porque o Socket.IO envolve o app FastAPI como ASGI middleware.

### Scripts Disponíveis (Client)

| Comando         | Descrição                                           |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Inicia o servidor de desenvolvimento com hot reload |
| `npm run build` | Gera o build de produção otimizado                  |
| `npm run start` | Inicia o servidor de produção (requer build)        |
| `npm run lint`  | Executa o ESLint para verificação de código         |

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (usado pelo Docker Compose e pelo server) — veja
`.env.example` para a lista completa e comentada:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000

# ── MySQL ────────────────────────────────────────────────────────────────────
MYSQL_PASSWORD=

# ── Auth (JWT) ─────────────────────────────────────────────────────────────────
JWT_SECRET=

# ── MinIO (storage S3-compatível) ───────────────────────────────────────────
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_PUBLIC_URL=http://localhost:9000

# ── Serviços externos (opcionais) ─────────────────────────────────────────────
DEEPSEEK_API_KEY=         # análise de IA (plano Pro)
GEMINI_API_KEY=           # análise de IA multimodal (plano Agency)
RESEND_API_KEY=
RESEND_FROM_EMAIL=        # ex: "onb. <noreply@seudominio.com>"

# ── Worker ↔ API (Socket.IO) ──────────────────────────────────────────────────
INTERNAL_SECRET=
```

---

## 🧪 Testes

O servidor possui testes com `pytest-asyncio`. Todos os testes usam três fixtures compartilhadas: `async_client`, `override_auth` e `mock_firestore`.

```bash
cd server

# Rodar todos os testes
uv run pytest

# Rodar um arquivo específico
uv run pytest tests/routes/test_form.py

# Rodar um teste específico por nome
uv run pytest -k "test_create_form"
```

Estrutura dos testes:

```
server/tests/
├── conftest.py          # Fixtures: async_client, override_auth, mock_firestore
└── routes/
    └── test_form.py     # Testes de CRUD de formulários
```

---

## 📁 Estrutura do Projeto

```
apponb/
├── client/                          # Frontend (Next.js)
│   └── app/
│       ├── api/                       # Rotas de API Next.js (meta tags OG)
│       ├── components/
│       │   ├── CookieBanner.tsx       # Banner de consentimento de cookies (LGPD)
│       │   ├── dashboard/
│       │   │   ├── BrandingEditor.tsx    # Editor visual de aparência
│       │   │   ├── DashboardSidebar.tsx  # Sidebar com navegação
│       │   │   ├── FormFieldsEditor.tsx  # Builder drag-and-drop de campos
│       │   │   ├── FormPreview.tsx       # Preview em tempo real do form
│       │   │   └── PublishPanel.tsx      # Painel de publicação e compartilhamento
│       │   ├── form/
│       │   │   └── FormRenderer.tsx      # Renderizador do formulário público
│       │   ├── notifications/
│       │   │   ├── NotificationBell.tsx  # Sino de notificações na topbar
│       │   │   └── NotificationCenter.tsx # Central de notificações (sidebar)
│       │   └── ui/
│       │       ├── ImageCropModal.tsx    # Modal reutilizável de crop de imagem
│       │       └── UpgradeBanner.tsx     # Banner de upgrade de plano
│       ├── contexts/
│       │   ├── AuthContext.tsx           # Autenticação JWT local + registro com fingerprint
│       │   ├── WorkspaceContext.tsx      # Workspace ativo e alternância
│       │   ├── NotificationContext.tsx   # Notificações via Socket.IO
│       │   └── UpgradeModalContext.tsx   # Modal de upgrade de plano
│       ├── dashboard/
│       │   ├── layout.tsx               # Layout com sidebar, topbar e command palette
│       │   ├── page.tsx                 # Inbox (respostas + formulários)
│       │   ├── forms/[id]/page.tsx      # Editor de formulário individual
│       │   ├── responses/[id]/page.tsx  # Visualização detalhada de resposta + IA
│       │   ├── templates/               # Galeria e editor de templates
│       │   ├── settings/page.tsx        # Configurações do workspace
│       │   ├── profile/page.tsx         # Perfil, preferências e exportação LGPD
│       │   └── plans/page.tsx           # Tela de planos e preços
│       ├── f/[slug]/                    # Formulário público (link compartilhável)
│       ├── invite/                      # Página de aceitação de convite
│       ├── login/                       # Página de login
│       ├── register/                    # Página de registro (com aceite de termos)
│       ├── forgot-password/             # Recuperação de senha
│       └── lib/
│           ├── types.ts                 # Tipos TypeScript do domínio
│           ├── api.ts                   # HTTP client (anexa token JWT local)
│           └── services/
│               ├── formService.ts         # Formulários
│               ├── templateService.ts     # Templates
│               ├── submissionService.ts   # Submissões
│               ├── insightService.ts      # Insights de IA
│               ├── workspaceService.ts    # Workspaces e membros
│               ├── folderService.ts       # Pastas
│               ├── inviteService.ts       # Convites
│               ├── userService.ts         # Perfil, preferências e exportação de dados
│               ├── billingService.ts      # Assinatura (stub local, sem Stripe)
│               ├── storageService.ts      # Upload de imagens (Cloud Storage)
│               └── fingerprintService.ts  # Fingerprint de dispositivo (anti-abuso)
│
├── server/                          # Backend (FastAPI)
│   ├── main.py                        # Entrypoint: socket_app (Socket.IO + FastAPI)
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth.py                  # Dependência get_current_user (verifica JWT)
│   │   │   ├── security.py              # JWT (emissão/verificação) + hashing de senha
│   │   │   ├── permissions.py           # require_form_owner, require_workspace_owner
│   │   │   ├── plan_limits.py           # Limites por plano e helpers de verificação
│   │   │   └── disposable_domains.py    # Blocklist + validação DNS de domínios de e-mail
│   │   ├── routes/
│   │   │   ├── auth.py                  # Registro, login, logout, perfil, exportação LGPD
│   │   │   ├── form.py                  # CRUD de formulários
│   │   │   ├── template.py              # CRUD de templates
│   │   │   ├── submission.py            # Submissões e análise de IA
│   │   │   ├── inbox.py                 # Inbox / respostas e stats do dashboard
│   │   │   ├── insight.py               # Insights de IA e geração de PDF
│   │   │   ├── workspace.py             # Workspaces e membros
│   │   │   ├── invite.py                # Sistema de convites + e-mail
│   │   │   ├── folder.py                # Pastas
│   │   │   ├── billing.py               # Checkout stub (sem Stripe)
│   │   ├── services/
│   │   │   ├── firestore_db.py          # Todas as operações Firestore (async)
│   │   │   ├── auth_service.py          # CRUD de usuário, fingerprint, blacklist de token
│   │   │   ├── ai_service.py            # Análise de briefing via IA
│   │   │   ├── email_service.py         # Convites e exportação de dados por e-mail (Resend)
│   │   │   └── pdf_service.py           # Geração de PDFs (WeasyPrint)
│   │   ├── schemas/                   # Modelos Pydantic v2 (In/Out por domínio)
│   │   ├── sockets/
│   │   │   ├── events.py                # Handlers connect/disconnect (JWT local)
│   │   │   └── broadcaster.py           # Helpers para emitir eventos por room
│   │   └── templates/                 # Templates Jinja2 (relatório PDF)
│   ├── tests/
│   │   ├── conftest.py                  # Fixtures compartilhadas
│   │   └── routes/
│   │       └── test_form.py
│   ├── pyproject.toml
│   └── Dockerfile.dev
│
├── docker-compose.dev.yml           # Docker Compose para desenvolvimento
├── storage.rules                    # Regras de segurança do Cloud Storage
├── .env.example                     # Variáveis de ambiente de exemplo
└── README.md
```

---

## 🏗️ Arquitetura

### Visão Geral

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Next.js (3000) │──────▶│  FastAPI (8000)   │──────▶│      MySQL       │
│   React / UI     │  REST │  Python Backend   │       │      MinIO       │
│   JWT local      │◀──────│  JWT Validation   │       └──────────────────┘
│   Socket.IO CLI  │◀─────▶│  Socket.IO Server │
└──────────────────┘  WS   └──────┬───────────┘
                                  │
                     ┌────────────┼────────────┐
                     │            │            │
                ┌────▼─────┐ ┌───▼────┐ ┌─────▼──────┐
                │ DeepSeek/ │ │ Resend │ │    ARQ     │
                │  Gemini   │ │ E-mail │ │  (Redis)   │
                └──────────┘ └────────┘ └────────────┘
```

### Camada de Dados

```
Componentes React → Services (HTTP/WS) → FastAPI Routes → Firestore / Cloud Storage
```

- Todas as rotas protegidas usam `Depends(get_current_user)` que retorna um dict com `id` (UUID) e `firebase_uid` (nome mantido da época do Firebase — hoje é só um id opaco gerado localmente)
- Verificações de ownership estão centralizadas em `app/core/permissions.py`
- `app/services/db.py` (MySQL) e `auth_service.py` são ambos async
- Uma background task em `main.py` limpa drafts inativos e tokens expirados a cada 6 horas

### Padrão de Navegação

```
/                          → Landing page
/login                     → Autenticação (E-mail/Senha + Google)
/register                  → Registro de nova conta (com aceite de termos)
/forgot-password           → Recuperação de senha
/dashboard                 → Inbox (respostas + formulários)
/dashboard/forms/[id]      → Editor de formulário
/dashboard/templates        → Galeria de templates
/dashboard/templates/[id]  → Editor de template
/dashboard/responses/[id]  → Detalhes da resposta + análise de IA
/dashboard/settings        → Configurações do workspace
/dashboard/profile         → Perfil do usuário e exportação de dados
/dashboard/plans           → Planos e preços
/invite/[code]             → Aceitação de convite
/f/[slug]                  → Formulário público (compartilhável, sem auth)
```

---

## 🔐 Conformidade LGPD

O **onb.** implementa os seguintes recursos para conformidade com a Lei Geral de Proteção de Dados:

| Requisito | Implementação |
|---|---|
| **Art. 7 — Consentimento** | Aceite obrigatório de Termos e Política de Privacidade na tela de cadastro |
| **Art. 8 — Cookies** | Cookie Banner com aviso de consentimento no layout raiz |
| **Art. 18, II — Acesso** | Exportação de todos os dados pessoais via `POST /api/v1/auth/request-export` |
| **Art. 18, V — Portabilidade** | Exportação em JSON (completo) e CSV (respostas), enviados por e-mail |
| **Art. 18, VI — Exclusão** | Exclusão de conta com remoção de dados pessoais do MySQL |
| **Anti-abuso pós-exclusão** | Soft delete mantém e-mail com flag `deleted: True` para bloquear novo trial |

### Fluxo de Exportação de Dados

```
Usuário clica "Solicitar" (profile/conta)
         ↓
POST /api/v1/auth/request-export  →  202 Accepted (imediato)
         ↓ background task
  1. Coleta: perfil, workspaces (owner + membro), formulários, respostas, templates
  2. Gera: dados-onb-YYYYMMDD.json + respostas-onb-YYYYMMDD.csv
  3. Envia por e-mail via Resend com ambos os arquivos anexados
```

---

## 🌐 Deploy

### Docker Compose (Recomendado)

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Vercel + Server separado

O frontend pode ser deployado na [Vercel](https://vercel.com/new):

```bash
cd client
npx vercel
```

O backend pode ser deployado em qualquer plataforma que suporte Python (Railway, Render, Fly.io, etc.):

```bash
cd server
docker build -f Dockerfile.dev -t onb-server .
docker run -p 8000:8000 --env-file .env onb-server
```

> Esta versão de testes não usa Stripe — não há webhook para configurar. Lembre-se apenas de apontar `DATABASE_URL`, `JWT_SECRET` e as variáveis do MinIO/S3 para instâncias reais em produção.
