import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let socket;

// Funções de formatação
// REMOVIDAS pois não estavam sendo usadas. Se forem usadas no futuro, devem ser reintroduzidas.
// const formatLabel = (key, labels) => {
//     return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
// };
// const formatStreetName = (name) => {
//     if (!name) return '';
//     return name.normalize("NFD").replace(/[\u00c0-\u017f]/g, "").toUpperCase();
// };

const formatClientName = (name) => {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};
const formatDateToDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data Inválida';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    } catch (e) { return 'Data Inválida'; }
};

const validateCPF = (cpf) => {
    cpf = String(cpf).replace(/[^\d]/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    return true;
};

// Componente de Mapa Leaflet
const LeafletMap = ({ adhesion }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const [coords, setCoords] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const findLocation = async () => {
            setIsLoading(true);
            setError('');
            if (adhesion.latitude && adhesion.longitude) {
                const lat = parseFloat(adhesion.latitude);
                const lon = parseFloat(adhesion.longitude);
                if (!isNaN(lat) && !isNaN(lon)) {
                    setCoords([lat, lon]);
                    setIsLoading(false);
                    return;
                }
            }
            if (!adhesion.endereco) {
                setError('Endereço não fornecido.');
                setIsLoading(false);
                return;
            }
            const fullAddress = `${adhesion.endereco}, ${adhesion.comunidade || ''}, Guarujá, SP, Brasil`;
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data && data.length > 0) {
                    setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
                } else {
                    setError('Endereço não encontrado.');
                }
            } catch (err) {
                setError('Falha ao obter coordenadas.');
            } finally {
                setIsLoading(false);
            }
        };
        findLocation();
    }, [adhesion]); // Dependência 'adhesion' já estava correta aqui.

    useEffect(() => {
        if (mapContainerRef.current && coords && !mapRef.current) {
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            });
            mapRef.current = L.map(mapContainerRef.current).setView(coords, 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
            L.marker(coords).addTo(mapRef.current)
                .bindPopup(`<b>${adhesion.nome_cliente || 'Localização'}</b><br>${adhesion.endereco}`)
                .openPopup();
        }
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [coords, adhesion]);

    return (
        <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Localização no Mapa</h4>
            <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-300">
                {isLoading && <div className="flex items-center justify-center h-full">A carregar mapa...</div>}
                {error && <div className="flex items-center justify-center h-full text-red-600">{error}</div>}
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
        </div>
    );
};


// Componente Modal de Edição (ATUALIZADO)
const EditAdhesionModal = ({ adhesion, onClose, onSave, loading, error }) => {
    const [editedAdhesion, setEditedAdhesion] = useState({ ...adhesion });

    useEffect(() => {
        const allFields = {
            // Campos de Adesão
            matricula: '', endereco: '', comunidade: '', status_adesao: '', data_adesao: '', 
            nome_cliente: '', telefone: '', rg: '', orgao_expedidor: '', cpf: '', 
            email: '', data_nasc: '', obs_atividade: '',
            // Campos de Conferência
            equipe_conf: '', dt_conf: '', status_final: '', entrega_cliente: '', 
            alteracao_pendente: false, obs_programacao: '', dt_alteracao: '', 
            titularidade: '', cpf_status: '',
            ...adhesion
        };
        setEditedAdhesion(allFields);
    }, [adhesion]);

    useEffect(() => {
        if (editedAdhesion.cpf) {
            const isValid = validateCPF(editedAdhesion.cpf);
            setEditedAdhesion(prev => ({ ...prev, cpf_status: isValid ? 'Válido' : 'Inválido' }));
        } else {
            setEditedAdhesion(prev => ({ ...prev, cpf_status: '' }));
        }
    }, [editedAdhesion.cpf]); // Dependência 'editedAdhesion.cpf' já estava correta aqui.

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setEditedAdhesion(prev => ({ ...prev, [name]: val }));
    };

    const handleSave = () => onSave(editedAdhesion);

    if (!adhesion) return null;

    const fieldLabels = {
        matricula: 'Matrícula', dt_envio: 'Data de Envio', endereco: 'Endereço',
        comunidade: 'Comunidade', status_adesao: 'Status da Adesão', data_adesao: 'Data da Adesão',
        nome_cliente: 'Nome do Cliente', telefone: 'Telefone', rg: 'RG',
        orgao_expedidor: 'Órgão Expedidor', cpf: 'CPF', email: 'E-mail',
        data_nasc: 'Data de Nascimento', obs_atividade: 'Obs. da Atividade',
        equipe_conf: 'Equipe de Conferência', dt_conf: 'Data da Conferência', status_final: 'Status Final',
        entrega_cliente: 'Entrega ao Cliente', alteracao_pendente: 'Alteração Pendente',
        obs_programacao: 'Obs. da Programação', dt_alteracao: 'Data da Alteração',
        titularidade: 'Titularidade', cpf_status: 'Status do CPF'
    };
    
    const adesoesFieldsOrder = ['matricula', 'nome_cliente', 'status_adesao', 'telefone', 'email', 'cpf', 'rg', 'orgao_expedidor', 'data_nasc', 'endereco', 'comunidade', 'data_adesao', 'obs_atividade'];
    const conferenciaFieldsOrder = ['equipe_conf', 'dt_conf', 'status_final', 'cpf_status', 'entrega_cliente', 'alteracao_pendente', 'obs_programacao', 'dt_alteracao', 'titularidade'];

    const readOnlyFields = ['matricula', 'cpf_status'];

    const renderInputField = (key) => {
        const isReadOnly = readOnlyFields.includes(key);
        let inputValue = editedAdhesion[key];

        if (['data_adesao', 'data_nasc', 'dt_conf', 'entrega_cliente', 'dt_alteracao'].includes(key)) {
            return <input type="date" name={key} value={(inputValue || '').split('T')[0]} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={isReadOnly} />;
        }
        if (key === 'alteracao_pendente') {
            return (
                <div className="flex items-center h-full">
                    <input type="checkbox" name={key} checked={!!inputValue} onChange={handleChange} className="h-5 w-5 text-blue-600 border-gray-300 rounded" />
                </div>
            );
        }
        if (['obs_atividade', 'obs_programacao'].includes(key)) {
            return <textarea name={key} value={inputValue || ''} onChange={handleChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-md" />;
        }
        return <input type="text" name={key} value={inputValue || ''} onChange={handleChange} className={`w-full px-3 py-2 border border-gray-300 rounded-md ${isReadOnly ? 'bg-gray-100' : ''}`} disabled={isReadOnly} />;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative">
                <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Editar Adesão e Conferência: {adhesion.matricula}</h3>
                {/* ===== Botão "X" de fechar adicionado ===== */}
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
                
                {loading && <div className="text-center p-4">Salvando...</div>}
                {error && <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4"><b>Erro:</b> {error}</div>}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        {/* Secção de Dados da Adesão */}
                        <h4 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Dados da Adesão</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {adesoesFieldsOrder.map((key) => (
                                <div key={key} className={key === 'obs_atividade' ? 'md:col-span-2' : ''}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{fieldLabels[key] || key}:</label>
                                    {renderInputField(key)}
                                </div>
                            ))}
                        </div>

                        {/* Secção de Dados da Conferência */}
                        <h4 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Dados da Conferência</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {conferenciaFieldsOrder.map((key) => (
                                <div key={key} className={key === 'obs_programacao' ? 'md:col-span-2' : ''}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{fieldLabels[key] || key}:</label>
                                    {renderInputField(key)}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <LeafletMap adhesion={adhesion} />
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
};


// Componente principal da página
function Conferencia({ token, user, onLogout }) {
    const navigate = useNavigate();
    // === ATUALIZAR URLs para apontar para o seu backend na Vercel ===
    // Use a URL base do seu deploy na Vercel para todas as chamadas API
    // Se seu backend está na raiz do domínio Vercel (ex: re-consulta-adesao.vercel.app),
    // você pode usar '/api/adhesions' para que a Vercel roteie corretamente.
    // SE SEU VERSELC.JSON ESTIVER CONFIGURADO PARA ISSO!
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3001"; // Usar variável de ambiente
    const API_ADESOES_URL = `${API_BASE_URL}/api/adhesions`;
    const API_CONFERENCIA_URL = `${API_BASE_URL}/api/conferencia`; 
    const SOCKET_SERVER_URL = API_BASE_URL; // O servidor de socket é o mesmo da API

    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const [filters, setFilters] = useState({
        matricula: '',
        endereco: '',
        comunidade: '',
        nomeCliente: ''
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdhesionForModal, setSelectedAdhesionForModal] = useState(null);
    const [loadingSave, setLoadingSave] = useState(false);
    const [errorSave, setErrorSave] = useState(null);

   // Dentro da função Conferencia()
useEffect(() => {
    if (token && user?.id) {
        socket = io(SOCKET_SERVER_URL, { auth: { token: token } });
        return () => { if (socket) socket.disconnect(); };
    }
}, [token, user?.id, SOCKET_SERVER_URL]); // <-- CORRIGIDO: Adicionado SOCKET_SERVER_URL

    const fetchCombinedData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (filters.matricula) params.append('matricula', filters.matricula);
        if (filters.endereco) params.append('endereco', filters.endereco);
        if (filters.comunidade) params.append('comunidade', filters.comunidade);
        if (filters.nomeCliente) params.append('nomeCliente', filters.nomeCliente);

        const url = `${API_CONFERENCIA_URL}?${params.toString()}`;

        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error((await response.json()).message || 'Erro ao buscar dados');
            const data = await response.json();
            setTableData(data);
        } catch (err) {
            setError(err.message);
            setTableData([]);
        } finally {
            setLoading(false);
        }
    }, [token, filters, API_CONFERENCIA_URL]); // Adicionadas dependências das URLs da API

    useEffect(() => {
        fetchCombinedData();
    }, [fetchCombinedData]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchClick = () => {
        fetchCombinedData();
    };
    
    const handleEditClick = async (matricula) => {
        if (!matricula) return;
        try {
            // Busca os dados combinados para ter todas as informações no modal
            const response = await fetch(`${API_CONFERENCIA_URL}?matricula=${matricula}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Não foi possível carregar os dados para edição.');
            const data = await response.json();
            if (data && data.length > 0) {
                setSelectedAdhesionForModal(data[0]);
                setIsModalOpen(true);
            } else {
                alert('Dados não encontrados.');
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const handleCloseModal = () => setIsModalOpen(false);

    // Função de salvar atualizada
    const handleSaveEdit = async (editedAdhesion) => {
        setLoadingSave(true);
        setErrorSave(null);

        const adesoesFields = ['matricula', 'endereco', 'comunidade', 'status_adesao', 'data_adesao', 'nome_cliente', 'telefone', 'rg', 'cpf', 'email', 'data_nasc', 'obs_atividade', 'orgao_expedidor'];
        const conferenciaFields = ['matricula', 'equipe_conf', 'dt_conf', 'status_final', 'entrega_cliente', 'alteracao_pendente', 'obs_programacao', 'dt_alteracao', 'titularidade', 'cpf_status'];

        const adesoesPayload = {};
        const conferenciaPayload = {};

        for (const key in editedAdhesion) {
            if (adesoesFields.includes(key)) {
                adesoesPayload[key] = editedAdhesion[key];
            }
            if (conferenciaFields.includes(key)) {
                conferenciaPayload[key] = editedAdhesion[key];
            }
        }

        try {
            // Promise.all para executar as duas chamadas em paralelo
            await Promise.all([
                fetch(`${API_CONFERENCIA_URL}/${editedAdhesion.matricula}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(conferenciaPayload),
                }),
                fetch(`${API_ADESOES_URL}/${editedAdhesion.matricula}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(adesoesPayload),
                })
            ]);
            
            // Atualiza a tabela principal após o sucesso
            fetchCombinedData(); 
        } catch (err) {
            setErrorSave(err.message);
        } finally {
            setLoadingSave(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8 font-sans">
            <div className="w-full mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-4xl font-extrabold text-gray-900">Painel de Conferência</h2>
                        <div className="flex space-x-4">
                            <button onClick={() => navigate('/configuracoes')} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Configurações</button>
                            <button onClick={onLogout} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Sair</button>
                        </div>
                    </div>
                    
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold text-gray-800 mb-4">Buscar Dados</h3>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                                 <div>
                                     <label htmlFor="matricula" className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                                     <input id="matricula" name="matricula" value={filters.matricula} onChange={handleFilterChange} placeholder="Buscar por Matrícula" className="w-full px-4 py-2 border rounded-md" />
                                 </div>
                                 <div>
                                     <label htmlFor="endereco" className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                                     <input id="endereco" name="endereco" value={filters.endereco} onChange={handleFilterChange} placeholder="Buscar por Endereço" className="w-full px-4 py-2 border rounded-md" />
                                 </div>
                                 <div>
                                     <label htmlFor="comunidade" className="block text-sm font-medium text-gray-700 mb-1">Comunidade</label>
                                     <input id="comunidade" name="comunidade" value={filters.comunidade} onChange={handleFilterChange} placeholder="Buscar por Comunidade" className="w-full px-4 py-2 border rounded-md" />
                                 </div>
                                 <div>
                                     <label htmlFor="nomeCliente" className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                                     <input id="nomeCliente" name="nomeCliente" value={filters.nomeCliente} onChange={handleFilterChange} placeholder="Buscar por Nome" className="w-full px-4 py-2 border rounded-md" />
                                 </div>
                                 <button onClick={handleSearchClick} className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 h-10">Buscar</button>
                             </div>
                        </div>
                    </div>

                    <div>
                        {loading && <div className="text-center">A carregar dados...</div>}
                        {error && <div className="bg-red-100 text-red-700 p-4 rounded-md"><b>Erro:</b> {error}</div>}
                        {!loading && !error && (
                            <div className="overflow-x-auto rounded-lg shadow-md">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matrícula</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome do Cliente</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Órgão Expedidor</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipe Conf.</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Conf.</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Final</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {tableData.length > 0 ? tableData.map((row, index) => (
                                            <tr key={row.matricula || index}>
                                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.matricula}</td>
                                                <td className="px-6 py-4 text-sm">{formatClientName(row.nome_cliente)}</td>
                                                <td className="px-6 py-4 text-sm">{row.orgao_expedidor || 'N/A'}</td>
                                                <td className="px-6 py-4 text-sm">{row.equipe_conf || 'N/A'}</td>
                                                <td className="px-6 py-4 text-sm">{formatDateToDisplay(row.dt_conf)}</td>
                                                <td className="px-6 py-4 text-sm">{row.status_final || 'N/A'}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <button onClick={() => handleEditClick(row.matricula)} className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md">Editar</button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="7" className="text-center p-4">Nenhum dado encontrado.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <EditAdhesionModal adhesion={selectedAdhesionForModal} onClose={handleCloseModal} onSave={handleSaveEdit} loading={loadingSave} error={errorSave} />
            )}
        </div>
    );
}

export default Conferencia;