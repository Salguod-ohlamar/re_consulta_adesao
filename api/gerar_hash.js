// backend/scripts/gerar_hash.js
// Script para gerar o hash de uma senha usando bcryptjs.
// Este script é uma ferramenta auxiliar e NÃO faz parte do fluxo de execução normal da aplicação.
// Use-o para gerar hashes de senhas para atualização manual no banco de dados, se necessário.

const bcrypt = require('bcryptjs');

async function generateHash(password) {
    // O 'saltRounds' (10 neste caso) define a complexidade do hash.
    // Valores mais altos são mais seguros, mas levam mais tempo para processar.
    const saltRounds = 10; 
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log(`Senha original fornecida: "${password}"`);
        console.log(`Senha hasheada (COPIE ESTA PARA O BANCO DE DADOS): "${hashedPassword}"`);
    } catch (error) {
        console.error("Erro ao gerar o hash da senha:", error);
    }
}

// --- INSTRUÇÃO IMPORTANTE: ALtere 'SUA_NOVA_SENHA_AQUI' para a senha em texto puro que você quer hashear ---
// Exemplo: generateHash('minhasenhaforte123');
generateHash('admin123'); 
// --- FIM DA INSTRUÇÃO ---

// Para executar este script:
// 1. Abra o terminal na pasta 'backend'.
// 2. Execute: node scripts/gerar_hash.js
// 3. Copie a "Senha hasheada" do output.
