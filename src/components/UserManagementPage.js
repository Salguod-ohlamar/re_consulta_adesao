import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

let socket;

// Componente do Modal de Usuário (sem alterações)
const UserModal = ({ user, onClose, onSave, loading, error, isNewUser }) => {
  const [editedUser, setEditedUser] = useState(() => {
    const defaultUser = {
      login_usuario: "",
      nome: "",
      password: "",
      nivel_acesso: "user",
      adhesion_field_permissions: {
        matricula: true,
        comunidade: true,
        endereco: true,
        nome_cliente: true,
        status_adesao: true,
        telefone: true,
        cpf: true,
        data_adesao: true,
      },
    };
    if (isNewUser) {
      return defaultUser;
    } else {
      const existingPermissions = user.adhesion_field_permissions || {};
      const mergedPermissions = { ...defaultUser.adhesion_field_permissions, ...existingPermissions };
      return {
        ...user,
        password: "",
        adhesion_field_permissions: mergedPermissions,
      };
    }
  });

  const fieldLabels = {
    matricula: "Matrícula",
    comunidade: "Comunidade",
    endereco: "Endereço",
    nome_cliente: "Nome Cliente",
    status_adesao: "Status Adesão",
    telefone: "Telefone",
    cpf: "CPF",
    data_adesao: "Data de Adesão",
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedUser((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setEditedUser((prev) => ({
      ...prev,
      adhesion_field_permissions: {
        ...prev.adhesion_field_permissions,
        [name]: checked,
      },
    }));
  };

  const handleSave = () => {
    onSave(editedUser);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {isNewUser ? "Criar Novo Usuário" : `Editar Usuário: ${user.login_usuario}`}
        </h3>
        {loading && <div className="flex items-center justify-center p-4 text-blue-600">Salvando...</div>}
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4" role="alert"><p className="font-bold">Erro:</p><p>{error}</p></div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="login_usuario" className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário (Login):</label>
            <input type="text" id="login_usuario" name="login_usuario" value={editedUser.login_usuario || ""} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required disabled={!isNewUser} />
          </div>
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">Nome Completo:</label>
            <input type="text" id="nome" name="nome" value={editedUser.nome || ""} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">{isNewUser ? "Senha:" : "Nova Senha (deixe em branco para não alterar):"}</label>
            <input type="password" id="password" name="password" value={editedUser.password || ""} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" {...(isNewUser && { required: true })} />
          </div>
          <div>
            <label htmlFor="nivel_acesso" className="block text-sm font-medium text-gray-700 mb-1">Nível de Usuário:</label>
            <select id="nivel_acesso" name="nivel_acesso" value={editedUser.nivel_acesso || ""} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="admin">Administrador</option>
              <option value="backoffice">Backoffice</option>
              <option value="user">Comum</option>
            </select>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-700 mb-3">Permissões de Campo da Adesão:</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(editedUser.adhesion_field_permissions).map((fieldKey) => (
                <div key={fieldKey} className="flex items-center">
                  <input type="checkbox" id={`permission-${fieldKey}`} name={fieldKey} checked={!!editedUser.adhesion_field_permissions[fieldKey]} onChange={handlePermissionChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                  <label htmlFor={`permission-${fieldKey}`} className="ml-2 block text-sm text-gray-900">{fieldLabels[fieldKey] || fieldKey}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-4 mt-8">
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 transition duration-200">{isNewUser ? "Criar Usuário" : "Salvar Alterações"}</button>
        </div>
      </div>
    </div>
  );
};


function UserManagementPage({ token, onLogout, user }) {
  const navigate = useNavigate();
  const API_USERS_URL = "http://localhost:3001/users";
  const SOCKET_SERVER_URL = "http://localhost:3001";

  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [errorSave, setErrorSave] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');

  useEffect(() => {
    if (token && user?.id) {
      console.log(`[WebSocket] Tentando conectar como: ${user.login_usuario} (ID: ${user.id})`);
      socket = io(SOCKET_SERVER_URL, { auth: { token: token } });
      socket.on("connect", () => {
        console.log(`[WebSocket] Conectado com sucesso! Socket ID: ${socket.id}`);
      });
      socket.on("update_online_users", (onlineUserIds) => {
        console.log("[WebSocket] Recebida atualização de usuários online:", onlineUserIds);
        setOnlineUsers(new Set(onlineUserIds));
      });
      return () => { 
        if (socket) {
          console.log(`[WebSocket] Desconectando usuário: ${user.login_usuario}`);
          socket.disconnect(); 
        }
      };
    }
  // OTIMIZAÇÃO: A dependência agora é o ID do usuário, que é um valor primitivo e estável.
  // Isso evita que a conexão seja refeita a cada nova renderização do componente pai.
  }, [token, user?.id]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_USERS_URL, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(`Erro ao buscar usuários: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateClick = () => {
    setIsNewUser(true);
    setSelectedUser(null);
    setIsModalOpen(true);
    setErrorSave(null);
  };

  const handleEditClick = (userToEdit) => {
    setIsNewUser(false);
    setSelectedUser(userToEdit);
    setIsModalOpen(true);
    setErrorSave(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setIsNewUser(false);
    setErrorSave(null);
  };

  const handleSaveUser = async (userToSave) => {
    setLoadingSave(true);
    setErrorSave(null);
    try {
      if (!token) throw new Error("Token de autenticação ausente.");
      const method = isNewUser ? "POST" : "PUT";
      const url = isNewUser ? API_USERS_URL : `${API_USERS_URL}/${userToSave.id}`;
      const body = isNewUser ?
        {
          login_usuario: userToSave.login_usuario,
          password: userToSave.password,
          nome: userToSave.nome,
          nivel_acesso: userToSave.nivel_acesso,
          adhesion_field_permissions: userToSave.adhesion_field_permissions,
        } :
        {
          nome: userToSave.nome,
          nivel_acesso: userToSave.nivel_acesso,
          password: userToSave.password || undefined,
          adhesion_field_permissions: userToSave.adhesion_field_permissions,
        };

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      
      const successMsg = isNewUser ? "Usuário criado com sucesso!" : "Usuário atualizado com sucesso!";
      setShowSuccessMessage(successMsg);
      setTimeout(() => setShowSuccessMessage(''), 3000);
      
      handleCloseModal();
      await fetchUsers();
    } catch (err) {
      setErrorSave(`Erro ao salvar usuário: ${err.message}`);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleDeleteClick = async (userIdToDelete) => {
    if (!window.confirm("Tem certeza que deseja deletar este usuário?")) return;
    setLoading(true);
    setError(null);
    try {
      if (!token) throw new Error("Token de autenticação ausente.");
      const response = await fetch(`${API_USERS_URL}/${userIdToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      setShowSuccessMessage("Usuário deletado com sucesso!");
      setTimeout(() => setShowSuccessMessage(''), 3000);
      await fetchUsers();
    } catch (err) {
      setError(`Erro ao deletar usuário: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVoltar = () => navigate("/configuracoes");
  const handleSair = () => {
    if (socket) socket.disconnect();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Gerenciamento de Usuários</h2>
          <div className="flex space-x-4">
            <button onClick={handleVoltar} className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md shadow-md hover:bg-gray-300 transition">Voltar</button>
            <button onClick={handleSair} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 transition">Sair</button>
          </div>
        </div>
        <p className="text-gray-700 text-center mb-6">Gerencie os usuários do sistema, seus níveis de acesso e permissões de campo.</p>
        <button onClick={handleCreateClick} className="mb-6 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:bg-indigo-700 transition">Adicionar Novo Usuário</button>
        {loading && <div className="flex items-center justify-center p-4 text-blue-600">Carregando usuários...</div>}
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4" role="alert"><p className="font-bold">Erro:</p><p>{error}</p></div>}
        {showSuccessMessage && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-4" role="alert"><p className="font-bold">Sucesso!</p><p>{showSuccessMessage}</p></div>}
        {!loading && !error && (
          users.length === 0 ? (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md mt-8" role="alert">
              <p className="font-bold">Nenhum usuário encontrado.</p>
              <p>Clique em "Adicionar Novo Usuário" para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-md mt-8">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Completo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nível</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userRow) => (
                    <tr key={userRow.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{userRow.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userRow.login_usuario}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userRow.nome}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{userRow.nivel_acesso === "admin" ? "Administrador" : userRow.nivel_acesso === "backoffice" ? "Backoffice" : "Comum"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center">
                          {onlineUsers.has(userRow.id) ? (
                            <><span className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></span>Online</>
                          ) : (
                            <><span className="h-2.5 w-2.5 rounded-full bg-red-500 mr-2"></span>Offline</>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditClick(userRow)} className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md mr-2">Editar</button>
                        <button onClick={() => handleDeleteClick(userRow.id)} className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md">Deletar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
      {isModalOpen && (
        <UserModal user={selectedUser} onClose={handleCloseModal} onSave={handleSaveUser} loading={loadingSave} error={errorSave} isNewUser={isNewUser} />
      )}
    </div>
  );
}

export default UserManagementPage;
