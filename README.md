# .

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Salvar no Google Drive

O app pode guardar o `finance-data.json` **neste computador** (padrão) ou **no Google Drive** da sua conta, via API oficial. A escolha fica em **Configurações → Onde salvar os dados**.

- No Drive, o arquivo fica por padrão em `Meu Drive/FinancasCasa/finance-data.json`. Em **Configurações → Conta Google Drive → Escolher pasta ou arquivo** você navega por **Meu Drive** e por **Compartilhados comigo**, cria pastas e escolhe onde guardar. Ao trocar de pasta o arquivo é movido (ou copiado, se não puder ser movido); se a pasta escolhida já tiver um `finance-data.json`, ele passa a ser usado. Também dá para marcar diretamente um arquivo `.json` compartilhado por outra pessoa: assim duas contas Google usam o mesmo arquivo, desde que o dono conceda permissão de edição.
- O app pede o escopo completo do Drive (`auth/drive`), necessário para listar e usar pastas que ele não criou. Como o app fica em modo "teste" no Google Cloud, a tela de consentimento mostra um aviso de app não verificado; clique em _Avançado → Acessar_.
- A sessão (refresh token) fica criptografada no seu computador (Keychain/DPAPI via `safeStorage`).
- Ao ativar o Drive, os dados locais atuais são enviados. Se já houver um arquivo na nuvem, ele passa a ser usado.
- Sem internet, o app abre a última cópia sincronizada em modo somente leitura.

### 1. Criar as credenciais no Google Cloud (uma vez)

1. Acesse <https://console.cloud.google.com/> e crie um projeto (ex.: "Financas").
2. Em **APIs e serviços → Biblioteca**, ative a **Google Drive API**.
3. Em **APIs e serviços → Tela de permissão OAuth**, configure o app como **Externo**, preencha nome e e-mail e adicione o seu e-mail (e o de quem mais usar) em **Usuários de teste**. Não é preciso publicar/verificar o app para uso pessoal.
4. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, escolha o tipo **Aplicativo para computador**.
5. Copie o **ID do cliente** e o **Segredo do cliente**.

### 2. Informar as credenciais ao app

Escolha uma das opções:

- **Dentro do app**: em **Configurações → Conta Google Drive**, cole o Client ID (e o Secret) e clique em _Salvar credenciais_.
- **No build** (para distribuir o app já configurado): crie um arquivo `.env` na raiz a partir do `.env.example`:

```bash
cp .env.example .env
```

```
MAIN_VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
MAIN_VITE_GOOGLE_CLIENT_SECRET=GOCSPX-...
```

O `.env` é ignorado pelo git e os valores são embutidos no processo principal durante `npm run dev` / `npm run build:*`.

### 3. Conectar e ativar

1. Em **Configurações → Conta Google Drive**, clique em **Conectar conta Google**. O navegador abre para você autorizar (o retorno é feito por `http://127.0.0.1:<porta>`; nenhum dado sai do seu computador além do login no Google).
2. Depois de conectado, selecione **Google Drive** em **Onde salvar os dados**.
3. Para voltar ao modo local, selecione **Neste computador** ou clique em **Desconectar**.

## Como executar no macOS (Ignorando Certificados)

Como o aplicativo é compilado sem uma licença de desenvolvedor paga da Apple (assinatura ad-hoc), o macOS irá bloquear a sua execução ao ser baixado da internet (por exemplo, do GitHub Releases), exibindo a mensagem:

> **"Financas.app” está danificado e não pode ser aberto. Você deve movê-lo para o Lixo."**

Para corrigir isso e permitir a execução do programa, siga um dos métodos abaixo:

### Método 1: Usando o Script Automatizado

1. Certifique-se de ter o arquivo `liberar-app.command` (presente na raiz deste repositório) em seu Mac.
2. Mova o arquivo `Financas.app` que você baixou para a pasta **Aplicativos** (`/Applications`).
3. Dê dois cliques no arquivo `liberar-app.command`.
4. Uma janela do Terminal será aberta e removerá as restrições de quarentena do aplicativo automaticamente.
5. Pronto! Agora você pode abrir o `Financas.app` normalmente de sua pasta de Aplicativos.

### Método 2: Via Terminal (Manual)

Se preferir rodar o comando manualmente, abra o **Terminal** do seu Mac e execute o seguinte comando:

```bash
xattr -cr /Applications/Financas.app
```

_(Caso tenha colocado o aplicativo em outra pasta, altere `/Applications/Financas.app` para o caminho correspondente.)_
