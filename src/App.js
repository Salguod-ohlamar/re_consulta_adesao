import React, { useState, useEffect } from 'react';
import { HashRouter  as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Importa os seus componentes reais a partir da pasta /components
import ConsultaAdesoes from './components/ConsultaAdesoes'; 
import Configuracoes from './components/Configuracoes';
import UserManagementPage from './components/UserManagementPage';
import CsvImportPage from './components/CsvImportPage';
import Conferencia from './components/Conferencia';

// ==================================================================
// ========= COMPONENTE DE LOGIN ====================================
// ==================================================================
function Login({ onLoginSuccess }) {
    const [login_usuario, setLoginUsuario] = useState('');
    const [password, setPassword] = useState(''); 
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    // Define a URL base da API usando a variável de ambiente
    // Garante que a URL base termine com uma barra se não for vazia
    const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, ''); // Remove barra final se houver

    const handleLogin = async (event) => {
        event.preventDefault();
        setMessage('');
        setMessageType('');

        try {
            // Constrói a URL da API de forma robusta
            const loginUrl = `${API_BASE_URL}/api/login`; // Adicione o prefixo /api/
            
            const response = await fetch(loginUrl, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login_usuario, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Login bem-sucedido!');
                setMessageType('success');
                onLoginSuccess(data.user, data.token); 
            } else {
                setMessage(data.error || data.message || 'Erro desconhecido no login.');
                setMessageType('error');
            }
        } catch (error) {
            console.error('Erro durante o login:', error);
            setMessage('Erro de rede. Por favor, tente novamente.');
            setMessageType('error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Acesso ao Sistema</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="login_usuario" className="block text-sm font-medium text-gray-700">Utilizador:</label>
                        <input type="text" id="login_usuario" value={login_usuario} onChange={(e) => setLoginUsuario(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Palavra-passe:</label>
                        <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
                    </div>
                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Entrar
                    </button>
                </form>
                {message && (<p className={`mt-4 text-center ${messageType === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message}</p>)}
            </div>
        </div>
    );
}


// ==================================================================
// ========= CONTEÚDO PRINCIPAL DA APLICAÇÃO ========================
// ==================================================================
function MainAppContent() { 
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [currentUser, setCurrentUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    
    const navigate = useNavigate();
    const location = useLocation();

    // Define a URL base da API para o logout também
    const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, '');

    useEffect(() => {
        if (currentUser && location.pathname === '/') {
            let targetPath = '/configuracoes/consulta'; // Rota padrão
            if (currentUser.nivel_acesso === 'admin') {
                targetPath = '/configuracoes';
            } else if (currentUser.nivel_acesso === 'backoffice') {
                targetPath = '/configuracoes/conferencia';
            }
            navigate(targetPath);
        } else if (!currentUser && location.pathname !== '/') {
            navigate('/');
        }
    }, [currentUser, location.pathname, navigate]);


    const handleLoginSuccess = (userObj, newToken) => {
        setToken(newToken);
        setCurrentUser(userObj);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userObj));
    };

    const handleLogout = async (callApi = true) => {
        if (callApi && token) {
            try {
                // Constrói a URL de logout de forma robusta
                await fetch(`${API_BASE_URL}/api/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
            } catch (error) {
                console.error('Erro ao registar logout no backend:', error);
            }
        }
        setToken(null);
        setCurrentUser(null);
        localStorage.clear();
        navigate('/');
    };

    const ProtectedRoute = ({ children, allowedRoles }) => {
        if (!token || !currentUser) {
            return <Navigate to="/" replace />;
        }
        const hasAccess = allowedRoles && allowedRoles.includes(currentUser.nivel_acesso);
        if (hasAccess) {
            return React.cloneElement(children, { token, loggedInUser: currentUser, onLogout: handleLogout, user: currentUser });
        } else {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-100 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
                        <h1 className="text-3xl font-extrabold text-red-700 mb-4">Acesso Negado!</h1>
                        <p className="text-lg text-gray-700">Não tem permissão para aceder a esta página.</p>
                        <button onClick={() => navigate(-1)} className="mt-6 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">
                            Voltar
                        </button>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {currentUser && location.pathname !== '/' && (
                <div className="bg-blue-600 p-4 text-center shadow-md">
                    <h1 className="text-3xl font-extrabold text-white mb-2">Sistema de gestão de dados</h1>
                    <p className="text-white text-lg">Bem-vindo, {currentUser.nome || currentUser.login_usuario}!</p> 
                </div>
            )}

            <Routes>
                <Route path="/" element={<Login onLoginSuccess={handleLoginSuccess} />} />
                
                <Route path="/configuracoes/consulta" element={<ProtectedRoute allowedRoles={['admin', 'backoffice', 'user']}><ConsultaAdesoes /></ProtectedRoute>} />
                <Route path="/configuracoes/conferencia" element={<ProtectedRoute allowedRoles={['admin', 'backoffice']}><Conferencia /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['admin']}><Configuracoes /></ProtectedRoute>} />
                <Route path="/configuracoes/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><UserManagementPage /></ProtectedRoute>} />
                <Route path="/configuracoes/importar-csv" element={<ProtectedRoute allowedRoles={['admin']}><CsvImportPage /></ProtectedRoute>} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}

function AppWrapper() {
    return (
        <Router>
            <MainAppContent />
        </Router>
    );
}

export default AppWrapper;
