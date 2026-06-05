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

## Como executar no macOS (Ignorando Certificados)

Como o aplicativo é compilado sem uma licença de desenvolvedor paga da Apple (assinatura ad-hoc), o macOS irá bloquear a sua execução ao ser baixado da internet (por exemplo, do GitHub Releases), exibindo a mensagem:

> **"Finanças.app” está danificado e não pode ser aberto. Você deve movê-lo para o Lixo."**

Para corrigir isso e permitir a execução do programa, siga um dos métodos abaixo:

### Método 1: Usando o Script Automatizado

1. Certifique-se de ter o arquivo `liberar-app.command` (presente na raiz deste repositório) em seu Mac.
2. Mova o arquivo `Finanças.app` que você baixou para a pasta **Aplicativos** (`/Applications`).
3. Dê dois cliques no arquivo `liberar-app.command`.
4. Uma janela do Terminal será aberta e removerá as restrições de quarentena do aplicativo automaticamente.
5. Pronto! Agora você pode abrir o `Finanças.app` normalmente de sua pasta de Aplicativos.

### Método 2: Via Terminal (Manual)

Se preferir rodar o comando manualmente, abra o **Terminal** do seu Mac e execute o seguinte comando:

```bash
xattr -cr /Applications/Finanças.app
```

_(Caso tenha colocado o aplicativo em outra pasta, altere `/Applications/Finanças.app` para o caminho correspondente.)_
