// backend/utils.js

// Função para formatar datas para o formato YYYY-MM-DD (PostgreSQL)
function formatDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        // Tenta parsear formatos comuns como DD/MM/YYYY
        const parts = dateString.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (parts) {
            const d = new Date(parts[3], parts[2] - 1, parts[1]);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        }
        console.warn(`Data inválida: "${dateString}". Retornando NULL.`);
        return null;
    }
    return date.toISOString().split('T')[0];
}

// Função para parsear valores booleanos (ex: 'Sim', 'true', '1' para true)
function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowerCaseValue = value.toLowerCase().trim();
        if (lowerCaseValue === 'sim' || lowerCaseValue === 'true' || lowerCaseValue === '1') {
            return true;
        }
        if (lowerCaseValue === 'não' || lowerCaseValue === 'false' || lowerCaseValue === '0') {
            return false;
        }
    }
    return null; // Ou false, dependendo da sua regra de negócio para valores desconhecidos
}

// Função para parsear valores inteiros
function parseInteger(value) {
    if (typeof value === 'number') return parseInt(value, 10);
    if (typeof value === 'string') {
        const parsed = parseInt(value.trim(), 10);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

// Função para parsear valores de ponto flutuante
function parseFloatValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Substitui vírgula por ponto para parsear corretamente números decimais
        const cleanedValue = value.replace(',', '.').trim();
        const parsed = parseFloat(cleanedValue);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

module.exports = {
    formatDate,
    parseBoolean,
    parseInteger,
    parseFloatValue,
};
