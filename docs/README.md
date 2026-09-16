# Documentação da EIXU

Guias reconciliados em 13/09/2026 sobre `main` `f9d5918` (PR #60), acrescidos
pelas alterações deste checkout. Descrevem
os contratos do código; a confirmação de um release exige o deployment do mesmo
SHA e as verificações do fluxo afetado. Comece pelo [README](../README.md) para
produto, ambiente e comandos.

## Guias vigentes

| Assunto                                                  | Documento                                     |
| -------------------------------------------------------- | --------------------------------------------- |
| Visão completa das funcionalidades, fluxos e limites     | [Manual do gerador](manual-gerador-sites.md)  |
| Cadastro, geração, prévia, imagens, publicação e tráfego | [Manual do operador](admin.md)                |
| Rotas, dados, autenticação, fontes e snapshots           | [Arquitetura e limites](architecture.md)      |
| Vibes, referências, blocos, identidade e responsividade  | [Design](design.md)                           |
| Alterações pontuais pelo chat e recibos                  | [Edição pelo chat](chat-edits.md)             |
| Linguagem simples e voz de cada vibe                     | [Escrita dos sites](copy.md)                  |
| Modelos, ferramentas, contexto e geração em etapas       | [Harness](harness.md)                         |
| Checks locais e publicação Git/Vercel                    | [Verificação](verification.md)                |
| Spec, desenvolvimento e revisão pelo Kanban              | [Fluxo AI Native](ai-native-development.md)   |
| Conversão e operação de projetos Premium                 | [Projetos Premium](plano-projetos-premium.md) |
| Comparação de saídas e avaliação humana                  | [Rubrica](eval-rubric.md)                     |
| Identidade e critérios dos agentes                       | [SOUL.md](../SOUL.md)                         |
| Invariantes e orientação para trabalhar no repositório   | [AGENTS.md](../AGENTS.md)                     |

O produto tem quatro vibes multipágina e Landing Page. Perfis v2–v4 preservam
contratos anteriores; v5 escolhe uma estrutura da vibe, v6 usa a referência
verificada para escolher entre as doze estruturas, e v7 atende à página única.
História do cliente, leitura do Site atual, upload de fotos, estúdio de logo e
edição direta na prévia já fazem parte da implementação.

A geração termina na composição e entrega a prévia para revisão humana. Na
publicação solicitada, avaliações editoriais classificadas viram recomendações;
erros técnicos preservam o snapshot anterior. Publicar código na Vercel e
publicar rascunhos de clientes são operações distintas.

## Evoluções propostas

[Evolução das vibes](plano-vibes-unicas.md) reúne as propostas que ainda precisam
de desenho e validação. Funcionalidades já entregues foram retiradas da lista de
pendências. Propostas não são garantias do produto nem autorização para gerar,
migrar, excluir dados ou publicar.

## Histórico

| Registro                                                                    | Contexto                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Verificações até 13/09](archive/verification-2026-09-13.md)                | Ensaios, limitações e releases anteriores, preservados como evidência datada.                       |
| [Revisão do admin](archive/admin-review-2026-09-10.md)                      | Diagnóstico inicial; não representa a lista atual de problemas.                                     |
| [Otimização do admin](archive/admin-optimization-2026-09-11.md)             | Plano e medições anteriores às entregas posteriores.                                                |
| [Evolução criativa](archive/creative-upgrade-2026-09-10.md)                 | Proposta original de melhoria do gerador.                                                           |
| [Vibes próprias](archive/vibes-plan-2026-09-12.md)                          | Diagnóstico e fases originais, antes dos contratos v5–v7.                                           |
| [Edição na prévia](archive/inline-edit-plan-2026-09-12.md)                  | Proposta que antecedeu a edição por campo hoje disponível.                                          |
| [Landing Page](archive/landing-plan-2026-09-12.md)                          | Proposta da quinta vibe, implementada no perfil v7.                                                 |
| [História e referência](archive/client-story-plan-2026-09-12.md)            | Proposta original; contrato entregue e ampliado com Site atual.                                     |
| [Upload de imagens](archive/image-upload-plan-2026-09-12.md)                | Alternativas originais; o upload entregue tem limites documentados no manual.                       |
| [Vibe comercial](archive/commercial-vibe-plan-2026-09-13.md)                | Diagnóstico e plano executado para lavagem, palavras inteiras e home proporcional.                  |
| [Primitivos interativos](archive/primitivos-interativos-plan-2026-09-13.md) | Plano executado do carrossel progressivo em heroes e galeria, com contrato de edição e verificação. |
| [Degradê com técnica](archive/gradient-technique-plan-2026-09-13.md)        | Estudo da referência e plano executado do brilho radial e do contraste do `cover`.                  |
| [Edição visual pelo chat](plano-edicao-visual-chat.md)                      | Incidente, causa raiz e plano executado para superfície local, recibo e medição.                    |
| [Conversa e conhecimento do Eixu](plano-chat-eixu.md)                       | Diagnóstico, arquitetura, etapas e validação do manual, soul e compositor refinado.                 |
| [Edição completa pelo chat](plano-edicao-completa-chat.md)                  | Plano reconciliado e execução do alinhamento fiel e do desfazer independente do foco.               |

Os registros preservam o estado da época, inclusive hipóteses e resultados
superados. Arquivos em `outputs/` podem existir apenas no ambiente do ensaio.
Não execute chamadas pagas para recriar um artefato citado. Ao atualizar um
fluxo, altere seu guia vigente; acrescente medições ao histórico com commit,
ambiente, escopo e limitações, sem tratar um resultado antigo como validação nova.
