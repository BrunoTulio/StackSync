# 🔄 StackSync

StackSync é uma ferramenta automatizada para atualizar stacks no Portainer através do Web Editor. Diferente de outras soluções que dependem de alterações no docker-compose ou git, o StackSync automatiza o processo de atualização diretamente pela interface web do Portainer, simulando as ações que um usuário faria manualmente.

## 🎯 Objetivo Principal

O foco principal do StackSync é automatizar a atualização de imagens Docker através do Web Editor do Portainer, oferecendo:
- 🎯 Atualização sem modificar arquivos docker-compose
- 🖥️ Interação direta com a interface web do Portainer
- 🔄 Re-pull automático de imagens
- ✅ Verificação visual de sucesso/erro
- 📝 Logs detalhados do processo

## 🚀 Funcionalidades

- ✨ Atualização automática de múltiplas stacks no Portainer
- 🔄 Re-pull automático de imagens Docker
- 🛡️ Verificação de sucesso/erro em cada atualização
- 📝 Logging detalhado do processo
- 🔐 Suporte a autenticação segura
- ⚡ Execução em paralelo (configurável)

## 📋 Pré-requisitos

- Docker instalado
- Acesso a uma instância do Portainer
- Credenciais de acesso ao Portainer

## 🛠️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
PORTAINER_URL=http://localhost:9000
PORTAINER_USERNAME=seu_usuario
PORTAINER_PASSWORD=sua_senha
PORTAINER_STACKS=stack1,stack2,stack3
PORTAINER_ENVIRONMENT=nome_do_ambiente
APP_ENV=prod
OPERATION_TIMEOUT=30000
RETRY_ATTEMPTS=3
RETRY_DELAY=5000
```

### Descrição das Variáveis

- `PORTAINER_URL`: URL do seu servidor Portainer
- `PORTAINER_USERNAME`: Seu usuário do Portainer
- `PORTAINER_PASSWORD`: Sua senha do Portainer
- `PORTAINER_STACKS`: Lista de stacks para atualizar (separadas por vírgula)
- `PORTAINER_ENVIRONMENT`: Nome do ambiente no Portainer
- `OPERATION_TIMEOUT`: Timeout para operações (em ms)
- `RETRY_ATTEMPTS`: Número de tentativas em caso de falha
- `RETRY_DELAY`: Delay entre tentativas (em ms)

## 🚀 Uso

### Usando Docker

```bash
# Pull da imagem
docker pull dockerengcomp/stacksync

# Executando com arquivo .env
docker run -it --rm \
  --name stacksync \
  --network host \
  --security-opt seccomp=unconfined \
  --env-file .env \
  dockerengcomp/stacksync

# Ou executando com variáveis de ambiente
docker run -it --rm \
  --name stacksync \
  --network host \
  --security-opt seccomp=unconfined \
  -e PORTAINER_URL=http://localhost:9000 \
  -e PORTAINER_USERNAME=seu_usuario \
  -e PORTAINER_PASSWORD=sua_senha \
  -e PORTAINER_STACKS=stack1,stack2,stack3 \
  dockerengcomp/stacksync
```

### Build Local

```bash
# Clone o repositório
git clone https://github.com/BrunoTulio/stacksync.git
cd stacksync

# Build da imagem
docker build -t stacksync .

# Executar
docker run -it --rm --env-file .env stacksync
```

## 📝 Logs

O StackSync fornece logs detalhados de cada operação, incluindo:
- Início e fim de cada atualização
- Status de cada tentativa
- Erros encontrados
- Confirmação de sucesso

## ⚠️ Considerações de Segurança

- Nunca compartilhe seu arquivo .env
- Use variáveis de ambiente em ambientes de produção
- Considere usar secrets do Docker em produção
- O container roda com usuário não-root para maior segurança

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, siga estes passos:

1. Fork o projeto
2. Crie sua branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- Equipe do Portainer pelo excelente produto
- Comunidade Docker
- Contribuidores do projeto Puppeteer

## 📞 Suporte

Se você encontrar algum problema ou tiver sugestões, por favor:
1. Verifique se já não existe uma issue similar
2. Abra uma nova issue com uma descrição detalhada do problema
