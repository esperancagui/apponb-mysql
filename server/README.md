<div align="center">

# onb.

**Plataforma inteligente de briefing para profissionais criativos**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

Crie formulários de briefing profissionais, personalize a aparência para cada cliente e receba respostas organizadas em uma inbox inteligente — tudo com uma experiência visual premium.

</div>

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Como Rodar](#-como-rodar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Arquitetura](#-arquitetura)
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
- **Upload de arquivos** com preview visual e validação em tempo real
- **Tela de agradecimento** com links sociais (WhatsApp, Instagram, Website)
- **Badge "onb."** com animação glassmorphism

### ⌨️ Command Palette (⌘K)

- **Busca global** de formulários por nome
- **Ações rápidas**: Novo formulário, Novo template, Ajustes
- **Atalho de teclado** `Ctrl+K` / `⌘K`

### 🔒 Confirmação de Exclusão

- **Diálogo ** para todas as operações de deleção na plataforma
- **Variantes danger/warning** com ícone centralizado e botões empilhados (iOS-style)
- **Suporte a loading** com spinner durante a operação

### 📊 Visualização de Respostas

- **Página de resposta detalhada** com dados do formulário preenchido
- **Avaliação de risco AI** com indicadores visuais (Alto, Médio, Baixo)
- **Insights de AI**: resumo executivo, perfil do cliente, red flags, plano de ação
- **Validação de assets**: verificação de dimensões e qualidade de arquivos enviados

---

## 🛠️ Stack Tecnológica

| Camada              | Tecnologia                                    |
| ------------------- | --------------------------------------------- |
| **Framework**       | Next.js 16 (App Router)                       |
| **UI Library**      | React 19                                      |
| **Linguagem**       | TypeScript 5                                  |
| **Estilização**     | Tailwind CSS 4                                |
| **Componentes**     | Radix UI + shadcn/ui                          |
| **Ícones**          | Lucide React                                  |
| **Animações**       | Framer Motion                                 |
| **Command Palette** | cmdk                                          |
| **Toasts**          | Sonner                                        |
| **Datas**           | date-fns                                      |
| **IDs**             | uuid                                          |
| **Armazenamento**   | localStorage (preparado para backend via API) |

---

## 🚀 Como Rodar

### Pré-requisitos

- **Node.js** 18.17 ou superior
- **npm**, **yarn**, **pnpm** ou **bun**

### Instalação

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd apponb

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

O app estará disponível em **[http://localhost:3000](http://localhost:3000)**.

### Scripts Disponíveis

| Comando         | Descrição                                           |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Inicia o servidor de desenvolvimento com hot reload |
| `npm run build` | Gera o build de produção otimizado                  |
| `npm run start` | Inicia o servidor de produção (requer build)        |
| `npm run lint`  | Executa o ESLint para verificação de código         |

---

## 📁 Estrutura do Projeto

```
apponb/
├── app/
│   ├── api/                      # Rotas de API (meta tags)
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── BrandingEditor.tsx    # Editor visual de aparência
│   │   │   ├── DashboardSidebar.tsx  # Sidebar com navegação
│   │   │   ├── FormFieldsEditor.tsx  # Builder drag-and-drop de campos
│   │   │   ├── FormPreview.tsx       # Preview em tempo real do form
│   │   │   └── PublishPanel.tsx      # Painel de publicação e compartilhamento
│   │   ├── form/
│   │   │   └── FormRenderer.tsx      # Renderizador do formulário público
│   │   └── Logo.tsx
│   ├── dashboard/
│   │   ├── layout.tsx               # Layout com sidebar, topbar e command palette
│   │   ├── page.tsx                 # Inbox (respostas + formulários)
│   │   ├── forms/[id]/page.tsx      # Editor de formulário individual
│   │   ├── responses/[id]/page.tsx  # Visualização detalhada de resposta
│   │   └── templates/
│   │       ├── page.tsx             # Galeria de templates
│   │       └── [id]/page.tsx        # Editor de template individual
│   ├── f/[slug]/                    # Formulário público (link compartilhável)
│   ├── lib/
│   │   ├── types.ts                 # Tipos TypeScript do domínio
│   │   ├── store.ts                 # Armazenamento local (localStorage)
│   │   ├── api.ts                   # Cliente HTTP (preparado para backend)
│   │   ├── designSystem.ts          # Sistema de design (cores, espaçamentos)
│   │   ├── templates.ts             # Templates pré-construídos
│   │   ├── mocks/                   # Dados mock para desenvolvimento
│   │   └── services/                # Camada de serviços (CRUD)
│   │       ├── formService.ts         # Formulários
│   │       ├── templateService.ts     # Templates
│   │       ├── submissionService.ts   # Submissões
│   │       ├── insightService.ts      # Insights de AI
│   │       └── workspaceService.ts    # Configurações do workspace
│   └── login/                       # Página de login
├── components/ui/                   # Componentes base (shadcn/ui)
│   ├── confirm-delete-dialog.tsx      # Diálogo de confirmação
│   ├── dialog.tsx, button.tsx, ...    # Primitivos de UI
└── package.json
```

---

## 🏗️ Arquitetura

### Camada de Dados

O projeto utiliza um padrão de **service layer** que abstrai o armazenamento. Atualmente opera com `localStorage`, mas foi projetado para migrar facilmente para um backend REST:

```
Componentes React → Services (formService, templateService, ...) → localStorage / API HTTP
```

Para ativar o modo backend, basta definir a variável de ambiente `NEXT_PUBLIC_API_URL`. Sem ela, o app funciona inteiramente offline com dados locais.

### Padrão de Navegação

```
/                          → Landing page
/login                     → Autenticação
/dashboard                 → Inbox (respostas + formulários)
/dashboard/forms/[id]      → Editor de formulário
/dashboard/templates        → Galeria de templates
/dashboard/templates/[id]  → Editor de template
/dashboard/responses/[id]  → Detalhes da resposta
/f/[slug]                  → Formulário público (compartilhável)
```

---

## 🌐 Deploy

### Vercel (Recomendado)

A forma mais simples de fazer deploy é pela [Vercel](https://vercel.com/new):

```bash
# Via CLI
npx vercel
```

Ou conecte o repositório diretamente no painel da Vercel para deploys automáticos a cada push.

### Docker

```bash
# Build
docker build -t onb .

# Run
docker run -p 3000:3000 onb
```
