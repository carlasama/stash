# Stash — controle financeiro

App web pessoal de finanças: lançamentos, contas bancárias, cartões de crédito (faturas e parcelas),
contas fixas, metas/reserva, orçamento por categoria e relatórios. Dados salvos na nuvem (Supabase).

## Rodar no computador

```
npm.cmd install
npm.cmd run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

Sem o Supabase configurado, o app roda em **modo local** (dados só no navegador).

## Conectar ao Supabase (salvar na nuvem) — uma vez só

1. Crie uma conta gratuita em https://supabase.com e clique em **New project**
   (escolha uma senha para o banco e a região *South America (São Paulo)*).
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
   - Instalação nova: só o `schema.sql` basta (ele já inclui tudo).
   - Banco criado com uma versão antiga: rode também, em ordem, os arquivos `supabase/002_...sql` até o último número
     (todos podem ser rodados mais de uma vez sem problema).
3. Abra **Project Settings → API** e copie:
   - **Project URL**
   - **anon public** key
4. Na pasta do projeto, copie `.env.example` para `.env.local` e cole os dois valores.
5. Reinicie o `npm.cmd run dev`. Vai aparecer a tela de login → **Criar conta**.
   - Por padrão o Supabase pede confirmação por e-mail. Para pular isso:
     **Authentication → Sign In / Providers → Email → desligue "Confirm email"**.
6. Depois de criar sua conta, por segurança desligue novos cadastros:
   **Authentication → Sign In / Providers → desligue "Allow new users to sign up"**.

Cada usuário só enxerga os próprios dados (Row Level Security).

Se você usou o modo local antes: em **Configurações → Exportar backup** antes de conectar,
e depois **Importar backup** já logado.

## Usar no celular (publicar)

O jeito mais simples é a Vercel (grátis):

1. Suba esta pasta para um repositório no GitHub (privado).
2. Em https://vercel.com → **Add New → Project** → importe o repositório.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Abra o link no celular e use "Adicionar à tela de início".

## Como o app calcula

- **Saldo previsto do mês** = receitas do mês − (contas fixas + outras despesas + faturas de cartão que vencem no mês).
- **Cartão**: compras feitas no dia do fechamento ou depois vão para a fatura seguinte. Parceladas geram uma
  parcela em cada fatura. A fatura conta no mês do **vencimento**.
- **Contas fixas** aparecem como "previstas" em cada mês. Ao marcar como paga (ou editar), vira um lançamento real
  daquele mês; mudar o valor da conta fixa afeta só os meses ainda não lançados.
- **Saldo das contas** = saldo inicial + receitas recebidas − despesas pagas − pagamentos de fatura ± transferências.
