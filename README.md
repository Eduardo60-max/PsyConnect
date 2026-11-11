# PsyConnect — demonstração

## Rodar no computador

1. Instale o [Bun](https://bun.sh/).
2. Abra o PowerShell na pasta do projeto:

   ```powershell
   cd C:\Users\eduar\Desktop\Psy\PsyConnect
   ```

3. Instale as dependências e inicie o app:

   ```powershell
   bun install
   bun run dev
   ```

4. No navegador, acesse [http://localhost:3000](http://localhost:3000). Deixe o PowerShell aberto.

## Entrar e testar

1. Digite um nome, por exemplo `Marina Demo`.
2. Digite um e-mail, por exemplo `marina@example.com`.
3. Marque o consentimento e toque em **Entrar**.
4. Explore **Início**, **Especialistas**, **Agendamento**, **Grupos** e **Mensagens**.

**Não há senha nem conta real:** qualquer nome e e-mail válidos permitem entrar. Use somente dados de exemplo.

## Abrir no celular pela mesma rede Wi-Fi

1. Descubra o IPv4 do computador com `ipconfig`.
2. No celular conectado à mesma rede Wi-Fi, acesse `http://IP-DO-COMPUTADOR:3000` (por exemplo, `http://192.168.0.84:3000`).
3. Se não abrir, permita o acesso do Bun no Firewall do Windows para redes privadas.

Para encerrar o servidor, volte ao PowerShell e pressione **Ctrl+C**.

> O app Android instalado também exige uma API publicada em HTTPS para carregar grupos e mensagens.
