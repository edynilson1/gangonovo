# XP Arena Games

Crie um aplicativo web mobile-first de jogos chamado provisoriamente "XP Arena", pensado para futuramente virar PWA/app mobile. O objetivo é uma plataforma de minijogos com conta de utilizador, XP e ranking online.

REQUISITOS PRINCIPAIS
1. AUTENTICAÇÃO E PERFIL
- Primeiro acesso: permitir cadastro/login por Google, e-mail e palavra-passe e número de telefone com autenticação básica.
- Depois do cadastro, obrigar o utilizador a configurar perfil: foto/avatar, nome de utilizador único e nome de exibição.
- Não permitir jogar até o perfil mínimo estar configurado.
- Criar sessão persistente e logout.
- Preparar a arquitetura para Supabase Auth e PostgreSQL.

2. HOME
- Interface moderna, divertida e limpa, adequada para jovens e adultos.
- Mostrar avatar, username, XP total, posição no ranking e botões dos jogos.
- Cards para: Jogo da Memória, Damas e Quiz.
- Seção "Top 25" com ranking global.
- Mostrar XP ganho recentemente.

3. JOGO DA MEMÓRIA
- Pares de cartas com categorias selecionáveis: Frutas, Animais e futuramente outras.
- Embaralhar cartas a cada partida.
- Temporizador.
- Contar tentativas, pares encontrados e tempo.
- Ao terminar, calcular XP com fórmula equilibrando desempenho: XP base + bônus por pares/precisão + bônus de velocidade + pequena variação aleatória controlada.
- Evitar que aleatoriedade domine o desempenho.
- Mostrar tela de resultado com XP ganho, tempo, tentativas e botão jogar novamente.

4. DAMAS
- Implementar uma versão jogável de Damas no navegador, com tabuleiro e regras básicas corretas.
- Começar com modo contra computador simples.
- Estruturar para futuramente multiplayer online.
- Dar XP ao terminar a partida, considerando resultado e desempenho, sem permitir XP infinito por partidas instantâneas.
- Ter opção de dificuldade.

5. QUIZ
- Perguntas de múltipla escolha.
- Categorias iniciais: Conhecimentos Gerais, Matemática, Ciência e Tecnologia.
- 10 perguntas por partida.
- Temporizador por pergunta.
- Pontuação por resposta correta, rapidez e sequência de acertos.
- XP final com limite por partida.
- Estruturar perguntas em dados fáceis de ampliar posteriormente.

6. XP E RANKING
- XP é uma pontuação persistente por utilizador.
- Ranking global ordenado por XP total.
- Mostrar Top 25.
- Mostrar posição do próprio utilizador mesmo se estiver fora do Top 25.
- Em caso de empate, usar desempate por maior número de vitórias e depois data de alcance do XP.
- Preparar proteção contra fraude: XP deve ser calculado e validado no backend quando houver backend disponível; nunca confiar apenas no valor enviado pelo cliente.
- Criar histórico de partidas/ganhos de XP para auditoria.
- Limitar recompensas abusivas e impedir duplicação de resultados.

7. DADOS/BACKEND
- Usar Supabase/PostgreSQL para autenticação e persistência quando possível.
- Estruturar tabelas: profiles, game_sessions, xp_transactions, leaderboard/materialized view se necessário, quiz_questions.
- Perfis: id, username único, display_name, avatar_url, total_xp, wins, created_at.
- game_sessions: user_id, game_type, score, xp_earned, duration, metadata, created_at.
- xp_transactions: user_id, amount, source, game_session_id, created_at.
- quiz_questions: category, question, options, correct_answer, difficulty, active.
- Aplicar regras de segurança/RLS adequadas.
- Não colocar segredos no frontend.

8. UX
- Navegação inferior mobile: Início, Jogos, Ranking, Perfil.
- Tela de login/cadastro bonita.
- Feedback visual ao ganhar XP.
- Animações leves, sem exagero.
- Estados de loading, erro e vazio.
- Design responsivo.
- Acessibilidade básica.
- Preparar suporte a tema claro/escuro.

9. MVP
Entregar uma primeira versão funcional, não apenas mockup. Se uma integração externa exigir configuração manual, deixe a estrutura pronta e explique claramente o que falta configurar.
Priorize: autenticação, perfil, memória totalmente jogável, quiz totalmente jogável, ranking/XP persistente e estrutura inicial de damas.
Use TypeScript, React, Tailwind e componentes consistentes.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gangooplay.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0ab171f9-b4c6-49db-88f3-6317091006d0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
