# Painel PCA-E

Painel público para consulta da planilha Acompanhamento PCA-E. A versão preserva as telas e os filtros existentes e coloca o painel na página inicial.

## Funcionamento

- O navegador consulta `/api/pcae` ao abrir o painel e a cada cinco minutos enquanto a página está visível. O botão Atualizar dados também faz essa consulta.
- A API da Vercel lê, sem credenciais de visitantes, somente as abas Base de dados e Atas de Registro de Preço. Não consulta SIGEO nem listas.
- A API aceita apenas GET. POST e outras tentativas de escrita recebem 405; nenhum dado é enviado para alterar a planilha.
- A consulta pública depende de leitura anônima da planilha. No Google Sheets, a opção Qualquer pessoa com o link deve ser Leitor. Adicione os responsáveis por alterações como Editores por seus e-mails. Não publique a planilha como Editor para qualquer pessoa com o link.
- A data mostrada é a data da consulta aos dados, no horário de Brasília, e não a data da última edição da planilha.
- Se houver falha, o painel mantém a última cópia disponível e exibe um aviso. A cópia incorporada é somente uma referência salva; o painel não a apresenta como uma consulta recente.
- As datas e os valores são interpretados no formato brasileiro. A consulta pode refletir alterações com atraso de alguns minutos, incluindo o cache do Google e até um minuto no servidor.

## Publicar no projeto existente

1. No repositório `ubiali1009/PAINEL-PCA-E`, substitua `index.html` e `index-novo.html` e acrescente `api/pcae.js` e `vercel.json` na branch `main`. Preserve a estrutura de pastas; `api/pcae.js` precisa estar dentro de `api`.
2. A Vercel deve usar o mesmo repositório, a branch `main`, Framework Preset Other, Root Directory na raiz e sem Build Command ou Output Directory personalizados. O projeto não precisa de npm nem de framework.
3. Aguarde a publicação ficar Ready. Acesse `https://painel-pca-e.vercel.app/` e confira a data da consulta.
4. Acesse `/api/pcae` para conferir a resposta JSON. Se retornar 503, confira a leitura pública da planilha; a conexão do Google Drive no ChatGPT não é transferida para a Vercel.
5. Confira as opções de proteção de produção da Vercel para que o endereço público não peça login.

O código preparado usa a exportação CSV pública da planilha confirmada. Não foram alterados o compartilhamento da planilha nem os acessos dos seus editores. Para manter a planilha inteiramente privada, será necessário configurar uma identidade de serviço com acesso de leitura no servidor; essa versão não utiliza credenciais privadas.

## Verificação local

Execute `node verificar-api.cjs` e `node verificar-painel.cjs`. A verificação cobre leitura CSV com campos multiline, bloqueio de escrita, indisponibilidade da origem, atualização inicial/periódica, valores monetários e quantidades no formato brasileiro, datas e conservação da última cópia. As respostas da rede são simuladas. A leitura real da origem, o desenho em um navegador e a publicação precisam ser conferidos após a instalação.
