# 🚀 Deploy no Render

## Pré-requisitos

- Conta gratuita em [render.com](https://render.com)
- Chave da API Google Gemini → [aistudio.google.com](https://aistudio.google.com/app/apikey)

## Passo a passo

### 1. Conectar o repositório

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New" → "Blueprint"**
3. Conecte sua conta GitHub (se ainda não conectou)
4. Selecione o repositório **`gabriellucasknp/Cashly`**
5. Render detecta automaticamente o `render.yaml` ✅

### 2. Configurar variáveis secretas

O Render vai pedir o valor de duas variáveis que você precisa preencher manualmente:

| Variável | Onde obter |
|----------|-----------|
| `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| `AI_AGENT_URL` | URL gerada pelo Render após deploy do `cashly-ai-agent` (ex: `https://cashly-ai-agent.onrender.com`) |

> **Dica:** Faça o deploy primeiro, copie a URL do `cashly-ai-agent`, depois atualize a variável `AI_AGENT_URL` no serviço `cashly-app`.

### 3. Deploy

1. Clique em **"Apply"** — o Render vai criar:
   - 🗄️ Banco PostgreSQL `cashly-db`
   - 🤖 Serviço `cashly-ai-agent` (FastAPI)
   - ☕ Serviço `cashly-app` (Spring Boot)

2. Aguarde o build (pode levar 5-10 minutos na primeira vez)

3. Acesse a URL gerada, ex:
   - App: `https://cashly-app.onrender.com`
   - AI Agent: `https://cashly-ai-agent.onrender.com/docs`

### 4. Atualizar `AI_AGENT_URL`

Após o primeiro deploy:

1. Copie a URL do serviço `cashly-ai-agent` (ex: `https://cashly-ai-agent.onrender.com`)
2. No dashboard do Render, acesse **cashly-app → Environment**
3. Atualize `AI_AGENT_URL` para `https://cashly-ai-agent.onrender.com`
4. Clique em **"Save Changes"** — o Render vai fazer redeploy automaticamente

## ⚠️ Limitações do plano gratuito

- Serviços ficam **em sleep após 15 minutos** sem acesso (primeiro acesso demora ~30s)
- Banco de dados gratuito expira após **90 dias**
- Para produção real, considere o plano pago

## Adicionar link no repositório GitHub

Após o deploy, adicione a URL no repositório:

1. Acesse [github.com/gabriellucasknp/Cashly](https://github.com/gabriellucasknp/Cashly)
2. Clique na ⚙️ engrenagem ao lado de **"About"**
3. Cole a URL do Render no campo **"Website"**
4. Salve — a URL ficará visível para todos! 🎉
