# BetMind PRO

Gestão de banca com análise IA e validação automática diária das previsões.

## ⚡ Resolver o erro 500 que tens agora

O 500 em `/.netlify/functions/ai-analyze` aparece porque, em `netlify dev`, faltavam
variáveis de ambiente e havia um conflito ESM/CommonJS nas functions (já corrigido com
`netlify/functions/package.json`). Para correr localmente:

1. O ficheiro `.env` já vem preenchido com a tua config Firebase.
2. Falta só preencher **duas** variáveis para a Análise IA funcionar:
   - `ANTHROPIC_API_KEY` → a tua chave de https://console.anthropic.com
   - `FIREBASE_SERVICE_ACCOUNT` → ver passo abaixo (só necessária para guardar/validar previsões)
3. Corre:
   ```bash
   npm install
   netlify dev
   ```

> Os outros erros da consola são **inofensivos**: `favicon 404` (cosmético),
> `Cross-Origin-Opener-Policy` (vem do popup do login Google) e os
> `React Router Future Flag Warning` (já silenciados nesta versão).

## Service Account (para validação automática)

Firebase Console → Definições do projeto → Contas de serviço → **Gerar nova chave privada**.
Cola o JSON inteiro (numa linha) em `FIREBASE_SERVICE_ACCOUNT`. Também precisas do teu
**User UID** (Authentication → Users) em `ALLOWED_UID`.

## Deploy no Netlify

Em **Site settings → Environment variables**, adiciona todas as variáveis do `.env`
(incluindo `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `ALLOWED_UID`) e muda
`ALLOWED_ORIGIN` para o teu domínio (ex. `https://betmind-pro.netlify.app`).

Em **Firestore → Rules**, publica o conteúdo de `firestore.rules`.

## Como funciona a validação

```
Análise do Dia → guarda previsões em predictions/{data}
   (meia-noite, Europe/Lisbon)
validate-predictions → resultados reais via IA → predictionResults/{data}
   → visível na tab "IA"
```

A validação assume 1 unidade por mercado. O "acerto por confiança" mostra se as
previsões de alta confiança (≥70%) acertam mais — o teste à calibração do modelo.

## Novidades desta versão

- **Redesign completo**: design system novo (esmeralda + cinza-azulado), cartões com
  profundidade, header glassmorphism, nav inferior com 6 secções, animações de entrada.
- **Segurança**: functions autenticadas com Firebase ID token, rules validadas
  server-side, CORS restrito, headers de segurança, chave Anthropic só no servidor.
- **Nova tab IA**: taxa de acerto global, lucro em unidades, acerto por confiança e
  por modalidade, histórico dia-a-dia.
