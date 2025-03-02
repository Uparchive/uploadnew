// Importações do Firebase Modular SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
    getAuth,
    signInWithPopup,
    signOut,
    GoogleAuthProvider,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    listAll,
    deleteObject,
    getMetadata
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAbADgKRicHlfDWoaXmIfU0EjGbU6nFkPQ",
    authDomain: "armazene-acd30.firebaseapp.com",
    databaseURL: "https://armazene-acd30-default-rtdb.firebaseio.com",
    projectId: "armazene-acd30",
    storageBucket: "armazene-acd30.appspot.com",
    messagingSenderId: "853849509051",
    appId: "1:853849509051:web:ea6f96915c4d5c895b2d9e",
    measurementId: "G-79TBH73QPT"
};

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Variáveis Globais
let currentUser = null;
let allFiles = [];
let isUploading = false;
let uploadTasks = [];
let videoPlayer = null;
let selectedFiles = [];
let activeFileForActions = null;
let currentView = 'grid';

// Cache de elementos DOM
const elements = {
    // Sidebar elements
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    navItems: document.querySelectorAll('.nav-item'),
    storageBar: document.getElementById('storage-bar'),
    storageDetails: document.getElementById('storage-details'),
    logoutButton: document.getElementById('logout-button'),
    
    // Content sections
    welcomeScreen: document.getElementById('welcome-screen'),
    uploadSection: document.getElementById('upload-section'),
    fileListSection: document.getElementById('file-list-section'),
    
    // User profile
    userProfile: document.getElementById('user-profile'),
    userName: document.getElementById('user-name'),
    profileAvatar: document.getElementById('profile-avatar'),
    
    // Login
    loginButton: document.getElementById('login-button'),
    
    // Upload elements
    uploadArea: document.getElementById('upload-area'),
    uploadDropzone: document.getElementById('upload-dropzone'),
    fileInput: document.getElementById('file-input'),
    selectFilesBtn: document.getElementById('select-files-btn'),
    startUploadBtn: document.getElementById('start-upload-btn'),
    selectedFilesContainer: document.getElementById('selected-files'),
    uploadProgress: document.getElementById('upload-progress'),
    
    // File list elements
    fileGrid: document.getElementById('file-grid'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    gridViewBtn: document.getElementById('grid-view-btn'),
    listViewBtn: document.getElementById('list-view-btn'),
    
    // Modals
    videoModal: document.getElementById('video-modal'),
    closeVideoModal: document.getElementById('close-video-modal'),
    videoTitle: document.getElementById('video-title'),
    videoPlayerContainer: document.getElementById('video-player-container'),
    
    fileActionsModal: document.getElementById('file-actions-modal'),
    closeFileActionsModal: document.getElementById('close-file-actions-modal'),
    fileActionsTitle: document.getElementById('file-actions-title'),
    previewFileBtn: document.getElementById('preview-file-btn'),
    downloadFileBtn: document.getElementById('download-file-btn'),
    shareFileBtn: document.getElementById('share-file-btn'),
    renameFileBtn: document.getElementById('rename-file-btn'),
    deleteFileBtn: document.getElementById('delete-file-btn'),
    
    shareModal: document.getElementById('share-modal'),
    closeShareModal: document.getElementById('close-share-modal'),
    shareLink: document.getElementById('share-link'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    embedOptionsContainer: document.getElementById('embed-options-container'),
    embedCode: document.getElementById('embed-code'),
    copyEmbedBtn: document.getElementById('copy-embed-btn'),
    
    renameModal: document.getElementById('rename-modal'),
    closeRenameModal: document.getElementById('close-rename-modal'),
    renameForm: document.getElementById('rename-form'),
    newFilename: document.getElementById('new-filename'),
    cancelRename: document.getElementById('cancel-rename'),
    
    deleteModal: document.getElementById('delete-modal'),
    closeDeleteModal: document.getElementById('close-delete-modal'),
    deleteFilename: document.getElementById('delete-filename'),
    cancelDelete: document.getElementById('cancel-delete'),
    confirmDelete: document.getElementById('confirm-delete'),
    
    // Other elements
    toastContainer: document.getElementById('toast-container'),
    backToTop: document.getElementById('back-to-top')
};

// =======================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =======================================

// Event Listeners Iniciais
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupAuthStateListener();
});

// Configurar Listeners
function setupEventListeners() {
    // Sidebar Toggle
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Navegação
    elements.navItems.forEach(item => {
        item.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
                setActiveNavItem(this);
                
                // Fechar sidebar em mobile
                if (window.innerWidth <= 768) {
                    elements.sidebar.classList.remove('expanded');
                }
            }
        });
    });
    
    // Login e Logout
    elements.loginButton.addEventListener('click', loginWithGoogle);
    elements.logoutButton.addEventListener('click', logout);
    
    // Upload
    elements.selectFilesBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelection);
    elements.startUploadBtn.addEventListener('click', startUpload);
    
    // Drag and Drop
    setupDragAndDrop();
    
    // Pesquisa e Ordenação
    elements.searchInput.addEventListener('input', filterFiles);
    elements.sortSelect.addEventListener('change', () => {
        sortFiles(elements.sortSelect.value);
        displayFiles();
    });
    
    // Alternar Visualização
    elements.gridViewBtn.addEventListener('click', () => setViewMode('grid'));
    elements.listViewBtn.addEventListener('click', () => setViewMode('list'));
    
    // Modais
    setupModalListeners();
    
    // Scroll
    window.addEventListener('scroll', handleScroll);
    elements.backToTop.addEventListener('click', scrollToTop);
}

// Configurar ouvinte de estado de autenticação
function setupAuthStateListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário autenticado
            currentUser = user;
            handleUserLoggedIn(user);
        } else {
            // Usuário não autenticado
            currentUser = null;
            handleUserLoggedOut();
        }
    });
}

// =======================================
// MANIPULADORES DE EVENTOS
// =======================================

// Toggle Sidebar
function toggleSidebar() {
    // Em dispositivos móveis
    if (window.innerWidth <= 768) {
        elements.sidebar.classList.toggle('expanded');
    } else {
        // Em desktop
        elements.sidebar.classList.toggle('collapsed');
    }
}

// Exibir seção
function showSection(sectionId) {
    // Ocultar todas as seções
    const sections = [elements.welcomeScreen, elements.uploadSection, elements.fileListSection];
    sections.forEach(section => {
        if (section) section.style.display = 'none';
    });
    
    // Exibir a seção selecionada
    if (sectionId === 'upload-section') {
        elements.uploadSection.style.display = 'block';
    } else if (sectionId === 'file-list-section') {
        elements.fileListSection.style.display = 'block';
    }
}

// Definir item de navegação ativo
function setActiveNavItem(activeItem) {
    elements.navItems.forEach(item => {
        item.classList.remove('active');
    });
    activeItem.classList.add('active');
}

// Login com Google
function loginWithGoogle() {
    signInWithPopup(auth, provider)
        .then((result) => {
            // Login bem-sucedido
            showToast('success', 'Login realizado', 'Bem-vindo ao CloudDrive!');
        })
        .catch((error) => {
            console.error('Erro ao fazer login:', error);
            showToast('error', 'Erro no login', 'Não foi possível fazer login. Tente novamente.');
        });
}

// Logout
function logout() {
    signOut(auth)
        .then(() => {
            showToast('info', 'Logout realizado', 'Você saiu da sua conta.');
            resetAppState();
        })
        .catch((error) => {
            console.error('Erro ao fazer logout:', error);
            showToast('error', 'Erro no logout', 'Não foi possível fazer logout. Tente novamente.');
        });
}

// Reset do estado da aplicação
function resetAppState() {
    allFiles = [];
    selectedFiles = [];
    
    // Limpar áreas de exibição
    elements.fileGrid.innerHTML = '';
    elements.selectedFilesContainer.innerHTML = '';
    elements.uploadProgress.innerHTML = '';
    elements.uploadProgress.style.display = 'none';
    
    // Redefinir botão de upload
    elements.startUploadBtn.disabled = true;
    
    // Se tiver um player de vídeo ativo, destruí-lo
    if (videoPlayer) {
        videoPlayer.dispose();
        videoPlayer = null;
    }
    
    // Reinicializar variáveis
    isUploading = false;
    uploadTasks = [];
    activeFileForActions = null;
}

// Configurar Drag and Drop
function setupDragAndDrop() {
    const dropzone = elements.uploadDropzone;
    
    // Prevenir o comportamento padrão
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults);
        document.body.addEventListener(eventName, preventDefaults);
    });
    
    // Feedback visual
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('drag-over');
        });
    });
    
    // Processar os arquivos dropados
    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Tratar seleção de arquivos
function handleFileSelection() {
    handleFiles(elements.fileInput.files);
}

// Processar arquivos para upload
function handleFiles(files) {
    if (files.length === 0) return;
    
    const newFiles = Array.from(files);
    
    // Adicionar novos arquivos à lista de selecionados
    selectedFiles = [...selectedFiles, ...newFiles];
    
    // Habilitar o botão de upload
    elements.startUploadBtn.disabled = false;
    
    // Exibir arquivos selecionados
    displaySelectedFiles();
}

// Exibir arquivos selecionados
function displaySelectedFiles() {
    elements.selectedFilesContainer.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const fileSize = formatBytes(file.size);
        
        const fileElement = document.createElement('div');
        fileElement.className = 'selected-file';
        
        // Determinar ícone com base no tipo de arquivo
        let iconClass = getFileIconClass(file.type, fileExtension);
        
        fileElement.innerHTML = `
            <div class="file-icon ${getFileTypeClass(file.type, fileExtension)}">
                <i class="${iconClass}"></i>
            </div>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${fileSize}</div>
            </div>
            <div class="file-actions">
                <button class="file-action-btn remove-file" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        elements.selectedFilesContainer.appendChild(fileElement);
        
        // Adicionar evento para remover arquivo
        const removeBtn = fileElement.querySelector('.remove-file');
        removeBtn.addEventListener('click', () => {
            selectedFiles.splice(index, 1);
            displaySelectedFiles();
            
            // Desabilitar botão de upload se não houver arquivos
            if (selectedFiles.length === 0) {
                elements.startUploadBtn.disabled = true;
            }
        });
    });
}

// Iniciar upload
function startUpload() {
    if (!currentUser || selectedFiles.length === 0 || isUploading) {
        return;
    }
    
    // Calcular tamanho total dos novos arquivos
    const totalNewFilesBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalUsedBytes = allFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const projectedTotalBytes = totalUsedBytes + totalNewFilesBytes;
    
    // Verificar limite de armazenamento (500GB = 500 * 1024 * 1024 * 1024)
    const maxStorage = 500 * 1024 * 1024 * 1024;
    
    if (projectedTotalBytes > maxStorage) {
        showToast('error', 'Limite excedido', `Você atingiu o limite de armazenamento de 500GB.`);
        return;
    }
    
    // Configurar UI para upload
    isUploading = true;
    elements.uploadProgress.style.display = 'block';
    elements.uploadProgress.innerHTML = '';
    elements.startUploadBtn.disabled = true;
    
    uploadTasks = [];
    
    // Para cada arquivo, iniciar upload
    selectedFiles.forEach((file, index) => {
        const storageRefPath = `uploads/${currentUser.uid}/${file.name}`;
        const storageRefObj = ref(storage, storageRefPath);
        const uploadTask = uploadBytesResumable(storageRefObj, file);
        
        // Criar elemento de progresso
        const progressElement = document.createElement('div');
        progressElement.className = 'progress-item';
        progressElement.innerHTML = `
            <div class="progress-header">
                <div class="file-name">${file.name}</div>
                <div class="progress-status">0%</div>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar" style="width: 0"></div>
            </div>
        `;
        
        elements.uploadProgress.appendChild(progressElement);
        
        // Monitorar progresso
        uploadTask.on('state_changed', 
            (snapshot) => {
                // Progresso
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const progressBar = progressElement.querySelector('.progress-bar');
                const progressStatus = progressElement.querySelector('.progress-status');
                
                progressBar.style.width = `${progress}%`;
                progressStatus.textContent = `${Math.round(progress)}%`;
            },
            (error) => {
                // Erro
                console.error('Upload error:', error);
                progressElement.classList.add('error');
                progressElement.querySelector('.progress-status').textContent = 'Erro';
                showToast('error', 'Erro no upload', `Não foi possível fazer o upload de ${file.name}.`);
            }
        );
        
        uploadTasks.push(uploadTask);
    });
    
    // Aguardar conclusão de todos os uploads
    Promise.all(uploadTasks.map(task => task.catch(err => err)))
        .then(async () => {
            isUploading = false;
            
            // Verificar se todos os uploads foram bem-sucedidos
            const allSuccessful = uploadTasks.every(task => 
                task.snapshot && task.snapshot.state === 'success'
            );
            
            if (allSuccessful) {
                showToast('success', 'Upload concluído', 'Todos os arquivos foram enviados com sucesso.');
                
                // Limpar e atualizar UI
                selectedFiles = [];
                elements.selectedFilesContainer.innerHTML = '';
                elements.fileInput.value = '';
                
                // Buscar arquivos atualizados
                await fetchAllFiles();
                updateStorageUsage();
                
                // Ir para a seção de arquivos
                showSection('file-list-section');
                setActiveNavItem(document.querySelector('[data-section="file-list-section"]'));
            } else {
                showToast('warning', 'Upload parcial', 'Alguns arquivos não puderam ser enviados.');
            }
            
            // Aguardar um pouco antes de esconder o progresso
            setTimeout(() => {
                elements.uploadProgress.style.display = 'none';
                elements.uploadProgress.innerHTML = '';
            }, 3000);
        });
}

// Buscar todos os arquivos
async function fetchAllFiles() {
    if (!currentUser) return;
    
    try {
        const storageRef = ref(storage, `uploads/${currentUser.uid}/`);
        const filesSnapshot = await listAll(storageRef);
        
        const fetchedFiles = await Promise.all(
            filesSnapshot.items.map(async (item) => {
                try {
                    const url = await getDownloadURL(item);
                    const metadata = await getMetadata(item);
                    
                    return {
                        name: item.name,
                        url,
                        timeCreated: metadata.timeCreated,
                        size: Number(metadata.size),
                        contentType: metadata.contentType
                    };
                } catch (error) {
                    console.error('Error fetching file:', error);
                    return null;
                }
            })
        );
        
        // Filtrar arquivos nulos
        allFiles = fetchedFiles.filter(file => file !== null);
        
        // Ordenar por data de criação (mais recentes primeiro)
        sortFiles('newest');
        
        // Exibir arquivos
        displayFiles();
        
        // Atualizar contador de armazenamento
        updateStorageUsage();
        
    } catch (error) {
        console.error('Error fetching files:', error);
        showToast('error', 'Erro', 'Não foi possível carregar seus arquivos.');
    }
}

// Atualizar contador de armazenamento
function updateStorageUsage() {
    const totalUsedBytes = allFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const totalUsedGB = totalUsedBytes / (1024 ** 3);
    const formattedUsedGB = totalUsedGB.toFixed(2);
    
    // Atualizar texto
    elements.storageDetails.textContent = `${formattedUsedGB} GB de 500 GB`;
    
    // Atualizar barra de progresso
    const maxStorage = 500 * 1024 ** 3; // 500 GB em bytes
    const usedPercentage = (totalUsedBytes / maxStorage) * 100;
    elements.storageBar.style.width = `${Math.min(usedPercentage, 100)}%`;
    
    // Adicionar classe de alerta se estiver próximo ao limite
    if (usedPercentage > 90) {
        elements.storageBar.classList.add('warning');
    } else if (usedPercentage > 75) {
        elements.storageBar.classList.add('alert');
    } else {
        elements.storageBar.classList.remove('warning', 'alert');
    }
}

// Ordenar arquivos
function sortFiles(criteria) {
    switch (criteria) {
        case 'newest':
            allFiles.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));
            break;
        case 'oldest':
            allFiles.sort((a, b) => new Date(a.timeCreated) - new Date(b.timeCreated));
            break;
        case 'alphabetical':
            allFiles.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'alphabetical-desc':
            allFiles.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'size-desc':
            allFiles.sort((a, b) => b.size - a.size);
            break;
        case 'size-asc':
            allFiles.sort((a, b) => a.size - b.size);
            break;
        default:
            break;
    }
}

// Filtrar arquivos por pesquisa
function filterFiles() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    if (searchTerm === '') {
        displayFiles();
    } else {
        const filteredFiles = allFiles.filter(file => 
            file.name.toLowerCase().includes(searchTerm)
        );
        
        displayFiles(filteredFiles);
    }
}

// Exibir arquivos
function displayFiles(filesToDisplay = allFiles) {
    elements.fileGrid.innerHTML = '';
    
    if (filesToDisplay.length === 0) {
        elements.emptyState.style.display = 'flex';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    
    filesToDisplay.forEach(file => {
        const extension = file.name.split('.').pop().toLowerCase();
        const isImage = /^image\//.test(file.contentType);
        const isVideo = /^video\//.test(file.contentType) || ['mp4', 'webm', 'mkv'].includes(extension);
        
        const fileElement = document.createElement('div');
        fileElement.className = 'file-card';
        fileElement.dataset.fileUrl = file.url;
        fileElement.dataset.fileName = file.name;
        fileElement.dataset.fileSize = file.size;
        fileElement.dataset.fileType = file.contentType || '';
        
        // Obter ícone com base no tipo
        const iconClass = getFileIconClass(file.contentType, extension);
        const fileTypeClass = getFileTypeClass(file.contentType, extension);
        
        const formattedDate = new Date(file.timeCreated).toLocaleDateString();
        const formattedSize = formatBytes(file.size);
        
        fileElement.innerHTML = `
            <div class="file-thumbnail">
                ${isImage ? 
                    `<img src="${file.url}" alt="${file.name}">` : 
                    `<i class="${iconClass}"></i>`
                }
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    <span>${formattedSize}</span>
                    <span>${formattedDate}</span>
                </div>
            </div>
            <div class="file-options">
                <button class="file-options-btn">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;
        
        elements.fileGrid.appendChild(fileElement);
        
        // Adicionar eventos
        fileElement.addEventListener('click', (e) => {
            if (!e.target.closest('.file-options-btn')) {
                handleFileClick(file);
            }
        });
        
        const optionsBtn = fileElement.querySelector('.file-options-btn');
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showFileActions(file);
        });
    });
    
    // Aplicar visualização atual
    setViewMode(currentView);
}

// Manipular clique em arquivo
function handleFileClick(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const isImage = /^image\//.test(file.contentType);
    const isVideo = /^video\//.test(file.contentType) || ['mp4', 'webm', 'mkv'].includes(extension);
    
    if (isVideo) {
        playVideo(file);
    } else if (isImage) {
        window.open(file.url, '_blank');
    } else {
        // Oferecer para baixar o arquivo
        downloadFile(file);
    }
}

// Reproduzir vídeo
function playVideo(file) {
    elements.videoTitle.textContent = file.name;
    elements.videoModal.style.display = 'flex';
    
    // Destruir player anterior se existir
    if (videoPlayer) {
        videoPlayer.dispose();
    }
    
    // Criar novo elemento de vídeo
    const videoElement = document.createElement('video');
    videoElement.id = 'video-player';
    videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered';
    videoElement.controls = true;
    videoElement.preload = 'auto';
    
    elements.videoPlayerContainer.innerHTML = '';
    elements.videoPlayerContainer.appendChild(videoElement);
    
    // Inicializar o player
    videoPlayer = videojs('video-player', {
        autoplay: false,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{ 
            src: file.url, 
            type: getMimeType(file.name) 
        }]
    });
    
    // Adicionar botões personalizados
    addCustomVideoButtons(videoPlayer, file);
}

// Adicionar botões personalizados ao player de vídeo
function addCustomVideoButtons(player, file) {
    // Evitar duplicar botões
    if (player.getChild('controlBar').getChild('RewindButton')) return;
    
    // Botão de retroceder 10 segundos
    const RewindButton = videojs.getComponent('Button');
    const rewindButton = videojs.extend(RewindButton, {
        constructor: function() {
            RewindButton.apply(this, arguments);
            this.controlText('Retroceder 10 segundos');
            this.addClass('vjs-rewind-button');
        },
        handleClick: function() {
            const currentTime = player.currentTime();
            player.currentTime(Math.max(0, currentTime - 10));
        },
        buildCSSClass: function() {
            return 'vjs-control vjs-button fas fa-undo';
        }
    });
    
    videojs.registerComponent('RewindButton', rewindButton);
    player.getChild('controlBar').addChild('RewindButton', {}, 0);
    
    // Botão de avançar 10 segundos
    const ForwardButton = videojs.getComponent('Button');
    const forwardButton = videojs.extend(ForwardButton, {
        constructor: function() {
            ForwardButton.apply(this, arguments);
            this.controlText('Avançar 10 segundos');
            this.addClass('vjs-forward-button');
        },
        handleClick: function() {
            const currentTime = player.currentTime();
            const duration = player.duration();
            player.currentTime(Math.min(duration, currentTime + 10));
        },
        buildCSSClass: function() {
            return 'vjs-control vjs-button fas fa-redo';
        }
    });
    
    videojs.registerComponent('ForwardButton', forwardButton);
    player.getChild('controlBar').addChild('ForwardButton', {}, 2);
    
    // Botão de download
    const DownloadButton = videojs.getComponent('Button');
    const downloadButton = videojs.extend(DownloadButton, {
        constructor: function() {
            DownloadButton.apply(this, arguments);
            this.controlText('Download Vídeo');
            this.addClass('vjs-download-button');
        },
        handleClick: function() {
            downloadFile(file);
        },
        buildCSSClass: function() {
            return 'vjs-control vjs-button fas fa-download';
        }
    });
    
    videojs.registerComponent('DownloadButton', downloadButton);
    player.getChild('controlBar').addChild('DownloadButton', {}, player.controlBar.children().length - 1);
}

// Exibir menu de ações do arquivo
function showFileActions(file) {
    activeFileForActions = file;
    elements.fileActionsTitle.textContent = file.name;
    elements.fileActionsModal.style.display = 'flex';
    
    const extension = file.name.split('.').pop().toLowerCase();
    const isImage = /^image\//.test(file.contentType);
    const isVideo = /^video\//.test(file.contentType) || ['mp4', 'webm', 'mkv'].includes(extension);
    
    // Mostrar/ocultar botão de visualização com base no tipo de arquivo
    elements.previewFileBtn.style.display = (isImage || isVideo) ? 'flex' : 'none';
    
    // Configurar eventos dos botões
    elements.previewFileBtn.onclick = () => {
        elements.fileActionsModal.style.display = 'none';
        if (isVideo) {
            playVideo(file);
        } else if (isImage) {
            window.open(file.url, '_blank');
        }
    };
    
    elements.downloadFileBtn.onclick = () => {
        elements.fileActionsModal.style.display = 'none';
        downloadFile(file);
    };
    
    elements.shareFileBtn.onclick = () => {
        elements.fileActionsModal.style.display = 'none';
        showShareModal(file);
    };
    
    elements.renameFileBtn.onclick = () => {
        elements.fileActionsModal.style.display = 'none';
        showRenameModal(file);
    };
    
    elements.deleteFileBtn.onclick = () => {
        elements.fileActionsModal.style.display = 'none';
        showDeleteModal(file);
    };
}

// Baixar arquivo
function downloadFile(file) {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast('info', 'Download iniciado', `O download de ${file.name} foi iniciado.`);
}

// Exibir modal de compartilhamento
function showShareModal(file) {
    elements.shareLink.value = file.url;
    elements.shareModal.style.display = 'flex';
    
    // Verificar se é um vídeo para mostrar o código de incorporação
    const extension = file.name.split('.').pop().toLowerCase();
    const isVideo = /^video\//.test(file.contentType) || ['mp4', 'webm', 'mkv'].includes(extension);
    
    if (isVideo) {
        const embedPageUrl = `${window.location.origin}/embed.html?videoUrl=${encodeURIComponent(file.url)}`;
        const embedCode = `<iframe src="${embedPageUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;
        
        elements.embedCode.value = embedCode;
        elements.embedOptionsContainer.style.display = 'block';
    } else {
        elements.embedOptionsContainer.style.display = 'none';
    }
    
    // Focar no campo para facilitar a seleção
    setTimeout(() => elements.shareLink.select(), 100);
}

// Exibir modal de renomeação
function showRenameModal(file) {
    elements.newFilename.value = file.name;
    elements.renameModal.style.display = 'flex';
    
    // Focar no campo de nome
    setTimeout(() => elements.newFilename.select(), 100);
}

// Exibir modal de exclusão
function showDeleteModal(file) {
    elements.deleteFilename.textContent = file.name;
    elements.deleteModal.style.display = 'flex';
}

// Configurar listeners para modais
function setupModalListeners() {
    // Modal de vídeo
    elements.closeVideoModal.addEventListener('click', () => {
        elements.videoModal.style.display = 'none';
        if (videoPlayer) {
            videoPlayer.pause();
        }
    });
    
    // Modal de ações de arquivo
    elements.closeFileActionsModal.addEventListener('click', () => {
        elements.fileActionsModal.style.display = 'none';
    });
    
    // Modal de compartilhamento
    elements.closeShareModal.addEventListener('click', () => {
        elements.shareModal.style.display = 'none';
    });
    
    elements.copyLinkBtn.addEventListener('click', () => {
        elements.shareLink.select();
        document.execCommand('copy');
        showToast('success', 'Link copiado', 'O link foi copiado para a área de transferência.');
    });
    
    elements.copyEmbedBtn.addEventListener('click', () => {
        elements.embedCode.select();
        document.execCommand('copy');
        showToast('success', 'Código copiado', 'O código de incorporação foi copiado.');
    });
    
    // Modal de renomeação
    elements.closeRenameModal.addEventListener('click', () => {
        elements.renameModal.style.display = 'none';
    });
    
    elements.cancelRename.addEventListener('click', () => {
        elements.renameModal.style.display = 'none';
    });
    
    elements.renameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!activeFileForActions) return;
        
        const newName = elements.newFilename.value.trim();
        
        if (!newName) {
            showToast('error', 'Nome inválido', 'Por favor, insira um nome válido.');
            return;
        }
        
        renameFile(activeFileForActions.name, newName);
        elements.renameModal.style.display = 'none';
    });
    
    // Modal de exclusão
    elements.closeDeleteModal.addEventListener('click', () => {
        elements.deleteModal.style.display = 'none';
    });
    
    elements.cancelDelete.addEventListener('click', () => {
        elements.deleteModal.style.display = 'none';
    });
    
    elements.confirmDelete.addEventListener('click', () => {
        if (!activeFileForActions) return;
        
        deleteFile(activeFileForActions.name);
        elements.deleteModal.style.display = 'none';
    });
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === elements.videoModal) {
            elements.videoModal.style.display = 'none';
            if (videoPlayer) {
                videoPlayer.pause();
            }
        }
        if (e.target === elements.fileActionsModal) {
            elements.fileActionsModal.style.display = 'none';
        }
        if (e.target === elements.shareModal) {
            elements.shareModal.style.display = 'none';
        }
        if (e.target === elements.renameModal) {
            elements.renameModal.style.display = 'none';
        }
        if (e.target === elements.deleteModal) {
            elements.deleteModal.style.display = 'none';
        }
    });
    
    // Tecla ESC para fechar modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.videoModal.style.display = 'none';
            elements.fileActionsModal.style.display = 'none';
            elements.shareModal.style.display = 'none';
            elements.renameModal.style.display = 'none';
            elements.deleteModal.style.display = 'none';
            
            if (videoPlayer) {
                videoPlayer.pause();
            }
        }
    });
}

// Renomear arquivo
async function renameFile(oldName, newName) {
    if (!currentUser) return;
    
    try {
        const oldFileRef = ref(storage, `uploads/${currentUser.uid}/${oldName}`);
        const newFileRef = ref(storage, `uploads/${currentUser.uid}/${newName}`);
        
        // Verificar se o arquivo de destino já existe
        try {
            await getMetadata(newFileRef);
            // Se chegar aqui, o arquivo já existe
            showToast('error', 'Arquivo existente', 'Já existe um arquivo com esse nome.');
            return;
        } catch (error) {
            // Arquivo não existe, podemos prosseguir
        }
        
        // Obter URL de download
        const url = await getDownloadURL(oldFileRef);
        
        // Baixar o arquivo
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Fazer upload com o novo nome
        await uploadBytesResumable(newFileRef, blob);
        
        // Deletar o arquivo antigo
        await deleteObject(oldFileRef);
        
        showToast('success', 'Arquivo renomeado', `"${oldName}" foi renomeado para "${newName}".`);
        
        // Atualizar lista de arquivos
        await fetchAllFiles();
        
    } catch (error) {
        console.error('Error renaming file:', error);
        showToast('error', 'Erro ao renomear', 'Não foi possível renomear o arquivo.');
    }
}

// Excluir arquivo
async function deleteFile(fileName) {
    if (!currentUser) return;
    
    try {
        const fileRef = ref(storage, `uploads/${currentUser.uid}/${fileName}`);
        await deleteObject(fileRef);
        
        showToast('success', 'Arquivo excluído', `"${fileName}" foi excluído com sucesso.`);
        
        // Atualizar lista de arquivos
        await fetchAllFiles();
        
    } catch (error) {
        console.error('Error deleting file:', error);
        showToast('error', 'Erro ao excluir', 'Não foi possível excluir o arquivo.');
    }
}

// Definir modo de visualização (grade ou lista)
function setViewMode(mode) {
    currentView = mode;
    
    if (mode === 'grid') {
        elements.fileGrid.classList.remove('file-list-view');
        elements.gridViewBtn.classList.add('active');
        elements.listViewBtn.classList.remove('active');
    } else {
        elements.fileGrid.classList.add('file-list-view');
        elements.gridViewBtn.classList.remove('active');
        elements.listViewBtn.classList.add('active');
    }
}

// =======================================
// MANIPULADORES DE ESTADO DE USUÁRIO
// =======================================

// Usuário logado
function handleUserLoggedIn(user) {
    // Atualizar UI
    elements.welcomeScreen.style.display = 'none';
    elements.uploadSection.style.display = 'block';
    
    elements.userName.textContent = user.displayName || 'Usuário';
    
    if (user.photoURL) {
        elements.profileAvatar.innerHTML = `<img src="${user.photoURL}" alt="Avatar">`;
    } else {
        const initials = (user.displayName || 'U').charAt(0).toUpperCase();
        elements.profileAvatar.innerHTML = initials;
    }
    
    // Ativar o primeiro item de navegação
    setActiveNavItem(document.querySelector('[data-section="upload-section"]'));
    
    // Buscar arquivos
    fetchAllFiles();
}

// Usuário deslogado
function handleUserLoggedOut() {
    // Atualizar UI
    elements.welcomeScreen.style.display = 'flex';
    elements.uploadSection.style.display = 'none';
    elements.fileListSection.style.display = 'none';
    
    elements.userName.textContent = 'Visitante';
    elements.profileAvatar.innerHTML = '<i class="fas fa-user"></i>';
    
    resetAppState();
}

// =======================================
// FUNÇÕES DE SCROLL E INTERFACE
// =======================================

// Manipular evento de scroll
function handleScroll() {
    // Exibir ou ocultar botão "Voltar ao topo"
    if (window.scrollY > 300) {
        elements.backToTop.style.display = 'flex';
    } else {
        elements.backToTop.style.display = 'none';
    }
}

// Voltar ao topo
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// =======================================
// FUNÇÕES UTILITÁRIAS
// =======================================

// Determinar o ícone a ser usado para um tipo de arquivo
function getFileIconClass(mimeType, extension) {
    // Tipos de imagem
    if (mimeType && mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
        return 'fas fa-file-image';
    }
    
    // Tipos de vídeo
    if (mimeType && mimeType.startsWith('video/') || ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(extension)) {
        return 'fas fa-file-video';
    }
    
    // Tipos de áudio
    if (mimeType && mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
        return 'fas fa-file-audio';
    }
    
    // Documentos
    if (['pdf'].includes(extension)) {
        return 'fas fa-file-pdf';
    }
    
    if (['doc', 'docx'].includes(extension)) {
        return 'fas fa-file-word';
    }
    
    if (['xls', 'xlsx', 'csv'].includes(extension)) {
        return 'fas fa-file-excel';
    }
    
    if (['ppt', 'pptx'].includes(extension)) {
        return 'fas fa-file-powerpoint';
    }
    
    if (['txt', 'rtf'].includes(extension)) {
        return 'fas fa-file-alt';
    }
    
    // Arquivos compactados
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return 'fas fa-file-archive';
    }
    
    // Código
    if (['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'php', 'py', 'java', 'c', 'cpp', 'cs', 'rb'].includes(extension)) {
        return 'fas fa-file-code';
    }
    
    // Padrão
    return 'fas fa-file';
}

// Obter classe para o tipo de arquivo (para estilização)
function getFileTypeClass(mimeType, extension) {
    // Tipos de imagem
    if (mimeType && mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
        return 'image';
    }
    
    // Tipos de vídeo
    if (mimeType && mimeType.startsWith('video/') || ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(extension)) {
        return 'video';
    }
    
    // Tipos de áudio
    if (mimeType && mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
        return 'audio';
    }
    
    // Documentos
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv'].includes(extension)) {
        return 'document';
    }
    
    // Arquivos compactados
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return 'archive';
    }
    
    // Código
    if (['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'php', 'py', 'java', 'c', 'cpp', 'cs', 'rb'].includes(extension)) {
        return 'code';
    }
    
    // Padrão
    return '';
}

// Obter tipo MIME para vídeos
function getMimeType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    switch (extension) {
        case 'mp4':
            return 'video/mp4';
        case 'webm':
            return 'video/webm';
        case 'mkv':
            return 'video/x-matroska';
        case 'avi':
            return 'video/x-msvideo';
        case 'mov':
            return 'video/quicktime';
        default:
            return 'video/mp4'; // Tipo padrão
    }
}

// Formatar bytes para unidades legíveis
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Exibir notificação toast
function showToast(type, title, message) {
    const toastId = `toast-${Date.now()}`;
    
    let iconClass = '';
    switch (type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            break;
        case 'error':
            iconClass = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            break;
        case 'info':
        default:
            iconClass = 'fas fa-info-circle';
            break;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = toastId;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${iconClass}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Adicionar evento de fechar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        elements.toastContainer.removeChild(toast);
    });
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (document.getElementById(toastId)) {
            elements.toastContainer.removeChild(toast);
        }
    }, 5000);
}

// =======================================
// EXPOR FUNÇÕES IMPORTANTES GLOBALMENTE
// =======================================

// Tornar algumas funções acessíveis globalmente (para uso em HTML)
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.downloadFile = downloadFile;
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('success', 'Copiado', 'Texto copiado para a área de transferência.');
        })
        .catch(() => {
            showToast('error', 'Erro', 'Não foi possível copiar o texto.');
        });
};