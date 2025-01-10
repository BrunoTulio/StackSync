require("dotenv").config();
const puppeteer = require('puppeteer');
const winston = require('winston');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

// Configurações
const config = {
  url: process.env.PORTAINER_URL || 'http://localhost:9000',
  username: process.env.PORTAINER_USERNAME,
  password: process.env.PORTAINER_PASSWORD,
  stacksNames: process.env.PORTAINER_STACKS.split(','),
  environment: process.env.PORTAINER_ENVIRONMENT,
  isProd: process.env.APP_ENV === 'prod',
  timeout: parseInt(process.env.OPERATION_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '5000')
};

// Validação de configurações
function validateConfig() {
  const requiredFields = ['username', 'password', 'stacksNames', 'environment'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
  }
  
  if (config.stacksNames.length <= 0) {
    throw new Error('At least one stack name must be provided in PORTAINER_STACKS');
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Função para retry
async function withRetry(operation, name) {
  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      logger.info(`Attempting ${name} - Attempt ${attempt}/${config.retryAttempts}`);
      return await operation();
    } catch (error) {
      logger.error(`Error in ${name} - Attempt ${attempt}/${config.retryAttempts}:`, error);
      
      if (attempt === config.retryAttempts) {
        throw error;
      }
      
      await delay(config.retryDelay);
    }
  }
}
async function updateStack(page, stack) {
  logger.info(`Starting update for stack: ${stack.name}`);
  
  await withRetry(async () => {
    // Navega para a página da stack
    logger.info(`Navigating to stack page: ${stack.link}`);
    await page.goto(stack.link, { 
      timeout: config.timeout * 2,
      waitUntil: 'domcontentloaded'
    });
    
    // Espera a página carregar completamente
    await page.waitForSelector('ul.nav-tabs', { 
      visible: true, 
      timeout: config.timeout 
    });
    
    // Clica na aba Editor
    logger.info('Clicking Editor tab');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('ul.nav-tabs li a'));
      const editorTab = tabs.find(tab => tab.textContent.includes('Editor'));
      if (editorTab) {
        editorTab.click();
        return true;
      }
      throw new Error('Editor tab not found');
    });

    // Aguarda a aba Editor carregar
    await delay(2000);
    
    // Procura e clica no botão de update inicial
    logger.info('Looking for initial update button');
    const updateButtonSelector = 'div[authorization="PortainerStackUpdate"] button';
    await page.waitForSelector(updateButtonSelector, { 
      visible: true, 
      timeout: config.timeout 
    });

    logger.info('Clicking initial update button');
    await page.click(updateButtonSelector);
    
    // Aguarda o modal aparecer
    logger.info('Waiting for modal');
    const modalSelector = '.app-react-components-modals-Modal-Modal-module__modal-content';
    await page.waitForSelector(modalSelector, { 
      visible: true, 
      timeout: config.timeout 
    });

    // Aguarda um momento para garantir que o modal está completamente carregado
    await delay(1000);
    
    // Ativa opção de repull
    logger.info('Activating repull option');
    const repullActivated = await page.evaluate(() => {
      try {
        // Encontra a label do switch pelo texto exato
        const switchLabel = Array.from(document.querySelectorAll('label.space-right')).find(
          label => label.textContent.trim() === 'Re-pull image and redeploy'
        );
        
        if (!switchLabel) {
          console.error('Re-pull switch label not found');
          return false;
        }
        
        // Encontra o switch container associado
        const switchContainer = switchLabel.nextElementSibling;
        if (!switchContainer || !switchContainer.classList.contains('switch')) {
          console.error('Switch container not found');
          return false;
        }

        // Encontra e clica no checkbox
        const checkbox = switchContainer.querySelector('input[type="checkbox"]');
        if (!checkbox) {
          console.error('Checkbox not found');
          return false;
        }
        
        checkbox.click();
        return true;
      } catch (error) {
        console.error('Error activating repull:', error);
        return false;
      }
    });

    if (!repullActivated) {
      throw new Error('Failed to activate repull option');
    }

    logger.info('Repull option activated successfully');
    await delay(1000);
    
    // Confirma atualização
    logger.info('Looking for update button in modal');
    let updateConfirmed = false;

    try {
      // Tenta encontrar e clicar no botão de update
      updateConfirmed = await page.evaluate(() => {
        try {
          // Procura o botão de Update dentro do modal
          const modalContent = document.querySelector('.app-react-components-modals-Modal-Modal-module__modal-content');
          if (!modalContent) {
            console.error('Modal content not found');
            return false;
          }

          // Procura o botão específico com o texto "Update"
          const buttons = modalContent.querySelectorAll('button.btn.btn-primary');
          const updateButton = Array.from(buttons).find(
            button => button.textContent.trim() === 'Update'
          );

          if (!updateButton) {
            console.error('Update button not found');
            return false;
          }

          if (updateButton.disabled) {
            console.error('Update button is disabled');
            return false;
          }

          updateButton.click();
          return true;
        } catch (error) {
          console.error('Error in modal update:', error);
          return false;
        }
      });

      if (!updateConfirmed) {
        throw new Error('Failed to click update button in modal');
      }

      logger.info('Update button clicked successfully');
    } catch (error) {
      logger.error('Error during update confirmation:', error);
      throw error;
    }

    // Aguarda o sucesso da atualização
    logger.info('Waiting for update completion');
    
    try {
      // Primeiro verifica se há erro (com timeout curto)
      const errorToast = await page.waitForSelector('.toast-error, .Toastify__toast--error', {
        timeout: 3000 // Reduzido para 3 segundos
      }).catch(() => null);

      if (errorToast) {
        const errorText = await page.evaluate(el => el.textContent, errorToast);
        throw new Error(`Update failed - Error: ${errorText}`);
      }

      // Se não há erro, verifica o estado da stack
      const stackStatus = await page.evaluate(() => {
        // Verifica se voltou para a página principal
        const backToMain = document.querySelector('div[authorization="PortainerStackUpdate"]');
        if (backToMain) return 'success';

        // Verifica toast de sucesso
        const successToast = document.querySelector('.toast-success, .Toastify__toast--success');
        if (successToast) return 'success';

        // Verifica se ainda está no modal
        const modal = document.querySelector('.app-react-components-modals-Modal-Modal-module__modal-content');
        if (modal) return 'updating';

        return 'unknown';
      });

      if (stackStatus === 'success') {
        logger.info('Stack update confirmed successfully');
        return;
      }

      if (stackStatus === 'updating') {
        logger.info('Stack update still in progress, but no errors detected');
        return;
      }

      logger.warn('Stack update status unknown, but no errors detected');
    } catch (error) {
      logger.error('Error during stack update:', error.message);
      throw error;
    }
    
    logger.info(`Successfully updated stack: ${stack.name}`);
  }, `update stack ${stack.name}`);

  // Aguarda um momento antes de prosseguir para a próxima stack
  await delay(3000);
}
// Função principal
async function main() {
  let browser;
  try {
    validateConfig();
    
    logger.info('Starting Portainer stack update process');
    
    browser = await puppeteer.launch({
      headless: config.isProd,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(config.timeout);

    await page.context().clearCookies();
    await page.setCacheEnabled(false);  

    await withRetry(async () => {
      await page.goto(config.url);
    },  'acesso a pagina')

    // Login
    await withRetry(async () => {
      await page.type('#username', config.username);
      await page.type('#password', config.password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('div.blocklist', { visible: true });
    }, 'login');
    
    // Encontra o ambiente
    const environments = await withRetry(async () => {
      return await page.$$eval('.blocklist .relative', (elements) => {
        return elements.map(el => ({
          name: el.querySelector(".items-start .items-center span")?.innerText?.trim() || '',
          link: {
            dashboard: el.querySelector('a')?.href || '',
            stacks: el.querySelector('a')?.href?.replace('dashboard', 'stacks') || ''
          }
        }));
      });
    }, 'fetch environments');
    
    const targetEnv = environments.find(i => i.name === config.environment);
    if (!targetEnv) {
      throw new Error(`Environment ${config.environment} not found`);
    }
    
    // Navega para stacks
    await page.goto(targetEnv.link.stacks);
    await page.waitForSelector('table', { visible: true });
    
    // Obtém lista de stacks
    const stacks = await withRetry(async () => {
      return await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('table tbody tr td a'));
        return links.map(link => ({
          name: link.innerText.trim(),
          link: link.href
        }));
      });
    }, 'fetch stacks');
    
    // Valida se todas as stacks existem
    const missingStacks = config.stacksNames.filter(name => !stacks.find(s => s.name === name));
    if (missingStacks.length > 0) {
      throw new Error(`Stacks not found: ${missingStacks.join(', ')}`);
    }
    
    // Atualiza cada stack
    for (const name of config.stacksNames) {
      const stack = stacks.find(s => s.name === name);
      await updateStack(page, stack);
    }
    
    logger.info('All stacks updated successfully');
    
  } catch (error) {
    logger.error('Fatal error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executa o programa
main()
  .then(() => {
    logger.info('Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Process failed:', error);
    process.exit(1);
  });
