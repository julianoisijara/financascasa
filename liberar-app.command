#!/bin/bash
# Navega para o diretório onde o script está localizado
cd "$(dirname "$0")"

echo "=============================================="
echo "   Liberador do Aplicativo Finanças (macOS)   "
echo "=============================================="
echo ""
echo "Este script remove os atributos de quarentena do macOS"
echo "que impedem a execução de aplicativos sem assinatura digital."
echo ""

APP_PATH=""

# Procura o aplicativo nos locais comuns
if [ -d "/Applications/Finanças.app" ]; then
    APP_PATH="/Applications/Finanças.app"
elif [ -d "./Finanças.app" ]; then
    APP_PATH="./Finanças.app"
elif [ -d "./dist/mac/Finanças.app" ]; then
    APP_PATH="./dist/mac/Finanças.app"
elif [ -d "./dist/mac-arm64/Finanças.app" ]; then
    APP_PATH="./dist/mac-arm64/Finanças.app"
fi

if [ -n "$APP_PATH" ]; then
    echo "Encontrado em: $APP_PATH"
    echo "Removendo atributos de quarentena..."
    xattr -cr "$APP_PATH"
    echo "Sucesso! O aplicativo foi liberado e já pode ser aberto."
else
    echo "ERRO: Não encontrei o 'Finanças.app' em nenhum dos locais padrão:"
    echo " - /Applications/Finanças.app (Pasta de Aplicativos)"
    echo " - Pasta atual: $(pwd)"
    echo ""
    echo "Por favor, certifique-se de que o Finanças.app foi arrastado"
    echo "para a pasta Aplicativos (Applications) antes de rodar este script,"
    echo "ou insira o caminho completo do aplicativo abaixo."
    echo ""
    read -p "Caminho do Finanças.app (ou arraste o arquivo aqui): " USER_PATH
    # Remove aspas se o usuário arrastar e soltar o arquivo no terminal
    USER_PATH=$(echo "$USER_PATH" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    if [ -d "$USER_PATH" ]; then
        echo "Liberando $USER_PATH..."
        xattr -cr "$USER_PATH"
        echo "Sucesso! O aplicativo foi liberado e já pode ser aberto."
    else
        echo "Caminho inválido ou pasta não encontrada. Nenhuma alteração foi feita."
    fi
fi

echo ""
echo "Pressione qualquer tecla para fechar esta janela..."
read -n 1 -s
