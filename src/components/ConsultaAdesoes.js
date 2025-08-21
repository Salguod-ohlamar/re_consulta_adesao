import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Funções de formatação (sem alterações)
const formatLabel = (key) => {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
};
const formatStreetName = (name) => {
    if (!name) return '';
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
};
const formatClientName = (name) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
const formatDateToDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Data Inválida';
        }
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch (e) {
        return 'Data Inválida';
    }
};
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return 'N/A';
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    const match2 = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
    if (match) {
        return `+55 (${match[1]}) ${match[2]}-${match[3]}`;
    } else if (match2) {
        return `+55 (${match2[1]}) ${match2[2]}-${match2[3]}`;
    }
    return phoneNumber;
};

// ==================================================================
// ========= NOVO COMPONENTE PARA EXIBIR A FOTO DA LIGAÇÃO ==========
// ==================================================================
const LigacaoPhoto = ({ matricula, token }) => {
    const [photoUrl, setPhotoUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPhoto = async () => {
            if (!matricula || !token) {
                setError('Matrícula ou token inválido.');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError('');

            try {
                // Assumindo que você criará esta rota no backend
                const response = await fetch(`http://localhost:3001/api/nova_ligacao/${matricula}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });

                if (response.status === 404) {
                    setError('Nenhuma foto de ligação encontrada.');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Falha ao buscar a foto.');
                }
                const data = await response.json();
                if (data && data.fotos) {
                    setPhotoUrl(data.fotos);
                } else {
                    setError('Nenhuma foto de ligação encontrada.');
                }
            } catch (err) {
                setError('Erro ao carregar a foto.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPhoto();
    }, [matricula, token]);

    return (
        <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Foto da Ligação</h4>
            <div className="w-full h-96 rounded-lg border border-gray-300 flex items-center justify-center bg-gray-50">
                {isLoading && <div>A carregar foto...</div>}
                {error && <div className="text-center text-red-600 p-4">{error}</div>}
                {photoUrl && !isLoading && !error && (
                    <a href={photoUrl} target="_blank" rel="noopener noreferrer" title="Clique para abrir em nova aba">
                        <img 
                            src={photoUrl} 
                            alt={`Ligação da matrícula ${matricula}`} 
                            className="max-w-full max-h-full object-contain rounded-lg"
                            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/600x400/EEE/31343C?text=Imagem+Indisponível'; }}
                        />
                    </a>
                )}
            </div>
        </div>
    );
};

// ==================================================================
// ========= COMPONENTE DE MAPA COM LEAFLET (SEM ALTERAÇÕES) ========
// ==================================================================
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
    }, [adhesion]);

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

// ==================================================================
// ========= MODAL DE DETALHES (ATUALIZADO COM FOTO) ================
// ==================================================================
const AdhesionDetailsModal = ({ adhesion, onClose, token }) => { // Recebe o token como prop
    if (!adhesion) return null;

    const fieldsToShow = [
        'matricula', 'endereco', 'comunidade', 'nome_cliente', 
        'status_adesao', 'data_adesao', 'telefone', 'obs_atividade'
    ];

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto relative">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Detalhes da Adesão</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Coluna de Informações */}
                    <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-gray-700">
                        {fieldsToShow.map((key) => {
                            const value = adhesion[key];
                            let displayValue = value;
                            
                            if (key === 'data_adesao') displayValue = formatDateToDisplay(value);
                            else if (key === 'nome_cliente') displayValue = formatClientName(value);
                            else if (key === 'endereco') displayValue = formatStreetName(value);
                            else if (key === 'telefone') displayValue = formatPhoneNumber(value);

                            return (
                                <div key={key} className="bg-gray-50 p-3 rounded-md border border-gray-200 sm:col-span-2">
                                    <p className="font-semibold text-sm text-gray-600 mb-1">{formatLabel(key)}:</p>
                                    <p className="text-base font-medium text-gray-800 break-words">{displayValue || 'N/A'}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Coluna de Mapa e Foto */}
                    <div className="lg:col-span-2 grid grid-cols-1 gap-6">
                        <LigacaoPhoto matricula={adhesion.matricula} token={token} />
                        <LeafletMap adhesion={adhesion} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==================================================================
// ========= COMPONENTE PRINCIPAL (ATUALIZADO) ======================
// ==================================================================
function ConsultaAdesao({ token, onLogout }) {
    const navigate = useNavigate();
    const API_ADESOES_URL = 'http://localhost:3001/api/adhesions';

    // Estados dos campos de busca
    const [matricula, setMatricula] = useState('');
    const [comunidade, setComunidade] = useState('');
    const [endereco, setEndereco] = useState('');
    const [nomeCliente, setNomeCliente] = useState('');
    const [statusAdesao, setStatusAdesao] = useState('');
    const [cpf, setCpf] = useState('');

    // Estados da página
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(0);
    const [limit] = useState(20);
    const [hasMore, setHasMore] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedAdhesion, setSelectedAdhesion] = useState(null);

    const fetchAdhesions = useCallback(async (reset = false) => {
        if (!token) return;
        setLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : page * limit;
        const params = new URLSearchParams({ limit, offset: currentOffset });

        if (matricula) params.append('matricula', matricula);
        if (comunidade) params.append('comunidade', comunidade);
        if (endereco) params.append('endereco', endereco);
        if (nomeCliente) params.append('nome_cliente', nomeCliente);
        if (statusAdesao) params.append('status_adesao', statusAdesao);
        if (cpf) params.append('cpf', cpf.replace(/\D/g, ''));

        try {
            const response = await fetch(`${API_ADESOES_URL}?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Erro no servidor');
            const data = await response.json();
            setSearchResults(prev => (reset ? data.rows : [...prev, ...data.rows]));
            setHasMore(data.hasMore);
            if (reset) setPage(0);
            setHasSearched(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, matricula, comunidade, endereco, nomeCliente, statusAdesao, cpf, page, limit]);

    useEffect(() => {
        if (token) {
            fetchAdhesions(true);
        }
    }, [token, fetchAdhesions]);

    const handleSearchClick = () => {
        setPage(0);
        setSearchResults([]);
        setHasMore(true);
        fetchAdhesions(true);
    };

    const handleLoadMore = () => setPage(prevPage => prevPage + 1);
    const handleConfiguracoes = () => navigate('/configuracoes');
    const handleSair = () => onLogout();
    const handleRowClick = (adhesion) => {
        setSelectedAdhesion(adhesion);
        setShowModal(true);
    };
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedAdhesion(null);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8 font-sans">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-gray-800">Consulta de Adesões</h2>
                    <div className="flex space-x-4">
                        <button onClick={handleConfiguracoes} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md shadow-md hover:bg-gray-300">
                            Configurações
                        </button>
                        <button onClick={handleSair} className="px-6 py-2 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700">
                            Sair
                        </button>
                    </div>
                </div>
                <p className="text-gray-700 text-center mb-6">Utilize os campos abaixo para buscar e consultar os dados de adesão.</p>
                <div className="bg-white p-8 rounded-lg shadow-sm mb-10 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label htmlFor="matricula" className="block text-sm font-medium text-gray-700 mb-2">Matrícula:</label>
                            <input type="text" id="matricula" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex: JP2035" className="w-full px-4 py-3 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="endereco" className="block text-sm font-medium text-gray-700 mb-2">Endereço:</label>
                            <input type="text" id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Ex: Beco da Paz, 561," className="w-full px-4 py-3 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="nomeCliente" className="block text-sm font-medium text-gray-700 mb-2">Nome Cliente:</label>
                            <input type="text" id="nomeCliente" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Ex: João da Silva" className="w-full px-4 py-3 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-2">CPF:</label>
                            <input type="text" id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="XXX.XXX.XXX-XX" className="w-full px-4 py-3 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="comunidade" className="block text-sm font-medium text-gray-700 mb-2">Comunidade:</label>
                            <input type="text" id="comunidade" value={comunidade} onChange={(e) => setComunidade(e.target.value)} placeholder="Ex: Jardim Primavera" className="w-full px-4 py-3 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="statusAdesao" className="block text-sm font-medium text-gray-700 mb-2">Status Adesão:</label>
                            <select id="statusAdesao" value={statusAdesao} onChange={(e) => setStatusAdesao(e.target.value)} className="w-full px-4 py-3 border rounded-md bg-white">
                                <option value="">Selecione...</option>
                                <option value="Adesão Executada">Adesão Executada</option>
                                <option value="Adesão Programada">Adesão Programada</option>
                                <option value="Disponível p/ Programação">Disponível p/ Programação</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={handleSearchClick} className="px-8 py-3 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700">
                            Buscar
                        </button>
                    </div>
                </div>
                <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Resultados da Busca</h3>
                    {loading && <div className="text-center p-4">Carregando...</div>}
                    {error && <div className="bg-red-100 text-red-700 p-4 rounded-md"><b>Erro:</b> {error}</div>}
                    {!loading && !error && hasSearched && searchResults.length === 0 ? (
                        <div className="text-center p-4 bg-yellow-100 rounded-md">Nenhum resultado encontrado.</div>
                    ) : !loading && !error && hasSearched && searchResults.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg shadow-md">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matrícula</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome Cliente</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endereço</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {searchResults.map((adhesion) => (
                                        <tr key={adhesion.matricula} onClick={() => handleRowClick(adhesion)} className="cursor-pointer hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm">{adhesion.matricula}</td>
                                            <td className="px-6 py-4 text-sm">{formatClientName(adhesion.nome_cliente)}</td>
                                            <td className="px-6 py-4 text-sm">{formatStreetName(adhesion.endereco)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {hasMore && (
                                <div className="mt-8 flex justify-center">
                                    <button onClick={handleLoadMore} className="px-6 py-2 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700" disabled={loading}>
                                        {loading ? 'Carregando...' : 'Carregar Mais'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center p-10 text-gray-500">Os resultados aparecerão aqui.</div>
                    )}
                </div>
            </div>
            {showModal && (
                // Passa o token para o modal
                <AdhesionDetailsModal adhesion={selectedAdhesion} onClose={handleCloseModal} token={token} />
            )}
        </div>
    );
}

export default ConsultaAdesao;
