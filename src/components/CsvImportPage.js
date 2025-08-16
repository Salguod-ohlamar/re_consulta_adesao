import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CsvImportPage({ onLogout }) {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [importType, setImportType] = useState('adesoes');

  const expectedCsvColumnsAdesoes = [
    "matricula", "dt_envio", "endereco", "comunidade", "tentativa_1", "tentativa_2",
    "status_adesao", "data_adesao", "alt_serv", "dt_atualiz_cad", "dt_troca_tit",
    "dt_inclusao_cad", "servico_alterado", "validacao", "pendencia", "status_obra",
    "data_obra", "status_termo", "data_termo", "nome_cliente", "telefone", "rg",
    "cpf", "email", "data_nasc", "econ_res", "econ_com", "possui_cx_dagua",
    "relacao_imovel", "alugado", "tempo_moradia", "n_adultos", "n_criancas",
    "tipo_comercio", "forma_esgotamento", "obs_atividade", "deseja_receb_info",
    "latitude", "longitude"
  ];

  const expectedCsvColumnsNovaLigacao = [
   "matricula", "codigo", "bairro", "latitude", "longitude", "fotos"
  ];

  const currentExpectedColumns = importType === 'adesoes'
    ? expectedCsvColumnsAdesoes
    : expectedCsvColumnsNovaLigacao;

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadMessage(`Arquivo selecionado: ${file.name}`);
    } else {
      setSelectedFile(null);
      setUploadMessage('');
    }
  };

  const handleUploadCsv = async () => {
    if (!selectedFile) {
      setUploadMessage('Por favor, selecione um arquivo CSV primeiro.');
      return;
    }

    setIsUploading(true);
    setUploadMessage('Enviando arquivo... Por favor, aguarde.');

    const formData = new FormData();
    formData.append('csvFile', selectedFile);
    // CORREÇÃO: Adiciona o 'importType' ao corpo do formulário
    formData.append('importType', importType);

    // CORREÇÃO: A URL de upload é sempre a mesma rota unificada
    const uploadUrl = 'http://localhost:3001/api/upload';

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUploadMessage('Erro: Token de autenticação ausente. Faça login novamente.');
        setIsUploading(false);
        return;
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadMessage(data.message || 'Arquivo CSV enviado e processado com sucesso!');
        setSelectedFile(null);
      } else {
        // Usa a mensagem de erro vinda do backend, se disponível
        setUploadMessage(`Erro: ${data.message || 'Erro ao processar o arquivo CSV.'}`);
      }
    } catch (error) {
      console.error('Erro durante o upload do CSV:', error);
      setUploadMessage('Erro de rede. Não foi possível conectar ao servidor.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-4xl mx-auto flex flex-col items-center justify-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Importação CSV</h2>
        <p className="text-gray-700 text-center mb-8">
          Utilize esta seção para importar dados para o sistema através de um arquivo CSV.
        </p>

        <div className="w-full max-w-md mb-6">
          <label htmlFor="importType" className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Importação:
          </label>
          <select
            id="importType"
            value={importType}
            onChange={(e) => {
              setImportType(e.target.value);
              setSelectedFile(null);
              setUploadMessage('');
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm"
          >
            <option value="adesoes">Adesões</option>
            <option value="nova_ligacao">Nova Ligação</option>
          </select>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-lg shadow-md text-center w-full max-w-md mb-8">
          <p className="text-gray-600 mb-4">
            Selecione o arquivo CSV para <span className="font-semibold text-blue-800">{importType === 'adesoes' ? 'Adesões' : 'Nova Ligação'}</span>:
          </p>
          
          <label htmlFor="csvFileInput" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md cursor-pointer inline-block">
            {isUploading ? 'Buscando...' : 'Escolher Arquivo CSV'}
            <input
              type="file"
              id="csvFileInput"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
          </label>

          {selectedFile && (
            <p className="text-sm text-gray-600 mt-3">
              Arquivo selecionado: <span className="font-semibold">{selectedFile.name}</span>
            </p>
          )}

          {uploadMessage && (
            <p className={`text-sm mt-3 ${
              uploadMessage.includes('Erro') ? 'text-red-600' : 
              uploadMessage.includes('Enviando') ? 'text-blue-600' : 
              'text-green-600'
            }`}>
              {uploadMessage}
            </p>
          )}

          <button
            onClick={handleUploadCsv}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md"
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg shadow-inner w-full max-w-md">
          <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Cabeçalho Esperado do CSV ({importType === 'adesoes' ? 'Adesões' : 'Nova Ligação'})</h3>
          <p className="text-gray-700 text-sm mb-4">
            Seu arquivo CSV deve conter as seguintes colunas (os nomes devem ser exatos):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-left">
            {currentExpectedColumns.map((column, index) => (
              <span key={index} className="bg-gray-200 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {column}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
            <button
                onClick={() => navigate('/configuracoes')}
                className="w-full md:w-auto px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-md shadow-md"
            >
                Voltar para Configurações
            </button>
        </div>
      </div>
    </div>
  );
}

export default CsvImportPage;
