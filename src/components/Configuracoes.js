// frontend/src/components/Configuracoes.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

function Configuracoes({ onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Menu de Configurações</h2>
        <div className="p-4 mb-8 text-center rounded-lg border border-black bg-gray-100 text-black">
          Selecione uma opção de configuração abaixo:
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/configuracoes/usuarios')}
            className="flex flex-col items-center justify-center p-6 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition duration-200 ease-in-out transform hover:scale-105"
          >
            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span className="text-xl font-semibold">Gerenciar Usuários</span>
            <span className="text-sm text-gray-200 mt-1">Adicionar, editar e remover contas de usuário.</span>
          </button>

          <button
            onClick={() => navigate('/configuracoes/importar-csv')}
            className="flex flex-col items-center justify-center p-6 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-200 ease-in-out transform hover:scale-105"
          >
            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 10.5V13h-2v4.5H7v-4.5H5v4.5c0 .83.67 1.5 1.5 1.5h6c.83 0 1.5-.67 1.5-1.5z" />
            </svg>
            <span className="text-xl font-semibold">Importar CSV</span>
            <span className="text-sm text-gray-200 mt-1">Carregar dados de adesão via arquivo CSV.</span>
          </button>

          {/* ===== CORREÇÃO APLICADA AQUI ===== */}
          {/* O caminho de navegação foi corrigido de '/configuracoes/conferencia' para '/conferencia'. */}
          <button
            onClick={() => navigate('/configuracoes/conferencia')}
            className="flex flex-col items-center justify-center p-6 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-200 ease-in-out transform hover:scale-105"
          >
            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span className="text-xl font-semibold">Conferência</span>
            <span className="text-sm text-gray-200 mt-1">Aceder a ferramentas de conferência de dados.</span>
          </button>

          <button
            onClick={() => navigate('/configuracoes/consulta')}
            className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105"
          >
            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <span className="text-xl font-semibold">Consultas</span>
            <span className="text-sm text-gray-200 mt-1">Voltar para a tela de consulta de adesões.</span>
          </button>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={onLogout}
            className="w-full md:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export default Configuracoes;
