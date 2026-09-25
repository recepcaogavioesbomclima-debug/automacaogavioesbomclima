# Concluir o envio automático real

## Resultado esperado
Ao criar um lead, a automação ativa inicia uma única execução, envia a primeira mensagem pelo mesmo caminho do envio manual e grava a espera de 10 segundos no banco.

## Implementação
- Cadastrar `TESTE — LEAD FOLLOW-UP` ativa com cinco etapas.
- Impedir execuções duplicadas por automação e lead.
- Registrar a busca, criação, passo, telefone, mensagem e confirmação do provedor.
- Processar passos imediatos em sequência até encontrar o WAIT persistente.
- Mostrar claramente quando nenhuma automação ativa for encontrada.

## Validação
- Testar a etapa SEND_MESSAGE com o número real já validado.
- Criar um lead real e comprovar execução, mensagem SENT com ID e WAITING por 10 segundos.
- Confirmar com o usuário a chegada no aparelho antes de declarar o fluxo concluído.
