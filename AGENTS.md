<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- O envio manual e o SEND_MESSAGE da automação devem compartilhar `sendMessageIdempotent`; isso garante o mesmo provedor, validação e confirmação real.
- O worker processa etapas vencidas em sequência até encontrar uma espera persistente; isso agenda o WAIT imediatamente após um envio confirmado.
