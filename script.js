// Importações do Firebase Modular SDK
import { initializeApp, setLogLevel } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
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

// Habilitar logs detalhados do Firebase para depuração
setLogLevel('debug');

// Configuração do Firebase (Substitua pelas suas próprias credenciais)
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

// Elementos do DOM
const loginSection = document.getElementById('login-section');
const uploadSection = document.getElementById('upload-section');
const fileListSection = document.getElementById('file-list-section');
const googleLoginButton = document.getElementById('google-login-button');
const uploadForm = document.getElementById('upload-form');
const progressContainer = document.getElementById('progress-container');
const fileList = document.getElementById('file-list');
const storageUsageDisplay = document.getElementById('storage-usage');
const sortSelect = document.getElementById('sort-select');
const searchInput = document.getElementById('search-input');
const logoutButton = document.getElementById('logout-button');
const heroSection = document.getElementById('hero-section');
const videoPlayerSection = document.getElementById('video-player-section');
const backToTopButton = document.getElementById('back-to-top');
const videoContainer = document.getElementById('video-player-container');
const fileInput = document.getElementById('file-input');
const renameFileList = document.getElementById('rename-file-list');
const toggleButton = document.getElementById('toggle-file-list-button');
const fileListContainer = document.getElementById('file-list-container');

// Variáveis Globais
let allFiles = [];
let isUploading = false;
let uploadTasks = []; // Armazena os uploads em andamento
let videoPlayer; // Inicializamos a variável sem atribuir um player ainda
let remainingFiles = [];

// Monitorar o estado de autenticação do usuário
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário autenticado
        loginSection.style.display = 'none';
        uploadSection.style.display = 'block';
        fileListSection.style.display = 'block';
        logoutButton.style.display = 'block';
        heroSection.style.display = 'none';
        fetchAllFiles();
    } else {
        // Usuário não autenticado
        loginSection.style.display = 'block';
        uploadSection.style.display = 'none';
        fileListSection.style.display = 'none';
        fileList.innerHTML = '';
        storageUsageDisplay.textContent = '0.00 GB de Ilimitado';
        logoutButton.style.display = 'none';
        heroSection.style.display = 'block';

        // Certifique-se de que o player seja destruído quando o usuário sair
        if (videoPlayer) {
            videoPlayer.dispose();
            videoPlayer = null;
        }
    }
});

// Função para login com Google
googleLoginButton.addEventListener('click', () => {
    console.log('Botão de login clicado');
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log('Usuário logado via popup:', result.user);
            alert('Login realizado com sucesso!');
        })
        .catch((error) => {
            console.error('Erro ao fazer login:', error);
            alert(`Erro ao fazer login: ${error.code} - ${error.message}`);
        });
});

// Evento para o formulário de upload (usando o array atualizado de arquivos)
uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isUploading && remainingFiles.length > 0) {
        console.log('Iniciando upload...');
        startUpload(remainingFiles);
    } else {
        alert('Nenhum arquivo para fazer upload!');
    }
});

// Ao selecionar arquivos, exibir campos para renomeação e exclusão
fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files); // Obtenha a lista de arquivos
    remainingFiles = files; // Inicializa com todos os arquivos selecionados
    renameFileList.innerHTML = ''; // Limpar a lista anterior

    if (files.length > 0) {
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span id="file-name-${index}" class="file-name">${file.name}</span>
                <i class="fas fa-pencil-alt rename-icon" id="edit-icon-${index}" title="Renomear"></i>
                <i class="fas fa-trash delete-icon" id="delete-icon-${index}" title="Excluir"></i>
                <input type="text" id="rename-input-${index}" class="rename-input" value="${file.name}" style="display: none;">
            `;
            renameFileList.appendChild(fileItem);

            // Evento para renomear
            const editIcon = document.getElementById(`edit-icon-${index}`);
            const renameInput = document.getElementById(`rename-input-${index}`);
            const fileNameSpan = document.getElementById(`file-name-${index}`);

            editIcon.addEventListener('click', () => {
                fileNameSpan.style.display = 'none';
                renameInput.style.display = 'inline-block';
                renameInput.focus();

                renameInput.addEventListener('blur', () => {
                    if (renameInput.value.trim()) {
                        fileNameSpan.textContent = renameInput.value.trim();
                    }
                    fileNameSpan.style.display = 'inline-block';
                    renameInput.style.display = 'none';
                });

                renameInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        renameInput.blur();
                    }
                });
            });

            // Evento para excluir o arquivo
            const deleteIcon = document.getElementById(`delete-icon-${index}`);
            deleteIcon.addEventListener('click', () => {
                const confirmDelete = confirm(`Tem certeza de que deseja excluir o arquivo "${file.name}"?`);
                if (confirmDelete) {
                    // Remove o arquivo da lista de pré-visualização
                    fileItem.remove();

                    // Remove o arquivo do array de arquivos restantes
                    remainingFiles = remainingFiles.filter((f) => f !== file);
                }
            });
        });
    }
});

// Evento para alternar visibilidade da lista de arquivos
toggleButton.addEventListener('click', () => {
    const currentDisplay = window.getComputedStyle(fileListContainer).display;

    if (currentDisplay === 'none') {
        // Mostrar a lista de uploads
        fileListContainer.style.display = 'block';
        toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
    } else {
        // Ocultar a lista de uploads
        fileListContainer.style.display = 'none';
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
    }

    // Adicionar classe de animação ao botão
    toggleButton.classList.add('clicked');
    setTimeout(() => {
        toggleButton.classList.remove('clicked');
    }, 300);
});

// Limite Gratuito para o servidor
function getMaxStorageBytes() {
    return 500 * 1024 ** 4; // Limite de 500 GB em bytes
}

// Função para atualizar o uso de armazenamento
async function updateStorageUsage() {
    const totalUsedBytes = allFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const totalUsedGB = totalUsedBytes / (1024 ** 3);
    const formattedUsedGB = totalUsedGB.toFixed(2);

    const storageUsageDisplay = document.querySelector('.storage-text');
    storageUsageDisplay.textContent = `${formattedUsedGB} GB de 500.00 GB`;

    const progressBar = document.querySelector('.progress-bar');
    const usedPercentage = (totalUsedBytes / getMaxStorageBytes()) * 100;
    progressBar.style.width = `${Math.min(usedPercentage, 100)}%`;

    console.log(`Total Usado: ${formattedUsedGB} GB de 500.00 GB`);
}

// Função para iniciar o upload múltiplo
async function startUpload(files) {
    const user = auth.currentUser;
    if (!user) {
        console.log('Usuário não autenticado');
        alert('Você precisa estar logado para fazer o upload de arquivos.');
        return;
    }
    if (!files.length) {
        console.log('Nenhum arquivo selecionado');
        alert('Por favor, selecione pelo menos um arquivo antes de fazer o upload.');
        return;
    }

    const totalNewFilesBytes = files.reduce((sum, file) => sum + file.size, 0);
    const totalUsedBytes = allFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
    const projectedTotalBytes = totalUsedBytes + totalNewFilesBytes;

    if (projectedTotalBytes > getMaxStorageBytes()) {
        alert(`Você atingiu o limite máximo de armazenamento de ${formatBytes(getMaxStorageBytes())}. Não é possível fazer novos uploads.`);
        return;
    }

    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';
    isUploading = true;
    uploadTasks = [];

    console.log(`Iniciando upload de ${files.length} arquivos...`);

    files.forEach((file, index) => {
        const renameInput = document.getElementById(`rename-input-${index}`);
        const customFileName = renameInput && renameInput.value.trim() ? renameInput.value.trim() : file.name;
        const storageRefPath = `uploads/${user.uid}/${customFileName}`;
        const storageRefObj = ref(storage, storageRefPath);
        const uploadTask = uploadBytesResumable(storageRefObj, file);

        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
            <span>${customFileName} (${formatBytes(file.size)})</span>
            <div class="progress-bar-wrapper">
                <div class="progress-bar" id="progress-bar-${index}"></div>
                <span class="progress-text" id="progress-text-${index}">0%</span>
            </div>
        `;
        progressContainer.appendChild(progressItem);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const progressBar = document.getElementById(`progress-bar-${index}`);
                const progressText = document.getElementById(`progress-text-${index}`);
                if (progressBar && progressText) {
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${progress.toFixed(2)}%`;
                }
                console.log(`Upload do arquivo ${customFileName} em progresso: ${progress.toFixed(2)}%`);
            },
            (error) => {
                console.error(`Erro ao fazer upload do arquivo ${customFileName}:`, error);
                alert(`Erro ao fazer upload do arquivo ${customFileName}: ${error.code} - ${error.message}`);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref)
                    .then((downloadURL) => {
                        console.log(`Upload do arquivo ${customFileName} concluído. URL: ${downloadURL}`);
                    })
                    .catch((error) => {
                        console.error(`Erro ao obter a URL de download para o arquivo ${customFileName}:`, error);
                    });
            }
        );

        uploadTasks.push(uploadTask);
    });

    Promise.all(uploadTasks.map(task => new Promise((resolve, reject) => {
        task.on('state_changed', null, reject, resolve);
    })))
    .then(async () => {
        alert('Todos os arquivos foram enviados com sucesso!');
        await fetchAllFiles();
        updateStorageUsage();
        fileInput.value = '';
        renameFileList.innerHTML = '';
        progressContainer.style.display = 'none';
        progressContainer.innerHTML = '';
        isUploading = false;
    })
    .catch((error) => {
        console.error('Erro durante os uploads múltiplos:', error);
        alert(`Erro durante os uploads múltiplos: ${error.code} - ${error.message}`);
        progressContainer.style.display = 'none';
        progressContainer.innerHTML = '';
        isUploading = false;
    });
}

// Função para buscar todos os arquivos do usuário
async function fetchAllFiles() {
    const user = auth.currentUser;
    if (user) {
        try {
            console.log('Usuário autenticado:', user.uid);
            const storageRef = ref(storage, `uploads/${user.uid}/`);
            console.log('Buscando arquivos no caminho:', storageRef.fullPath);
            const filesSnapshot = await listAll(storageRef);
            console.log('Arquivos encontrados:', filesSnapshot.items.length);

            const allFilesFetched = await Promise.all(
                filesSnapshot.items.map(async (item) => {
                    try {
                        const url = await getDownloadURL(item);
                        const metadata = await getMetadata(item);
                        return {
                            name: item.name,
                            url,
                            timeCreated: metadata.timeCreated,
                            size: Number(metadata.size)
                        };
                    } catch (error) {
                        console.error('Erro ao obter URL ou metadados do arquivo:', item.name, error);
                        return null;
                    }
                })
            );

            allFiles = allFilesFetched.filter(file => file !== null);
            console.log('Arquivos válidos para exibição:', allFiles);

            if (allFiles.length > 0) {
                sortFiles(sortSelect.value);
                updateStorageUsage();
            } else {
                console.log('Nenhum arquivo válido encontrado.');
                fileList.innerHTML = '';
                updateStorageUsage();
            }
        } catch (error) {
            console.error('Erro ao listar arquivos:', error);
        }
    } else {
        console.log('Usuário não autenticado.');
    }
}

function displayFiles(files) {
    fileList.innerHTML = '';
    files.forEach((file, index) => {
        const listItem = document.createElement('li');
        const isVideo = file.name.endsWith('.mp4') || file.name.endsWith('.mkv') || file.name.endsWith('.webm');

        const displayName = file.name; 
        const fileSizeFormatted = formatBytes(file.size);

        listItem.className = 'file-item';
        listItem.innerHTML = `
            <div class="file-header">
                <span id="file-name-${index}" class="file-name">${displayName}</span>
                <span class="file-size">(${fileSizeFormatted})</span>
            </div>
            <div class="file-actions">
                ${isVideo ? `<button class="play-button" id="play-button-${index}"><i class="fas fa-play"></i></button>` : ''}
                <a href="${file.url}" class="download-button" id="download-button-${index}" download="${file.name}"><i class="fas fa-download"></i></a>
                <button class="share-button" id="share-button-${index}"><i class="fas fa-link"></i></button>
                <button class="delete-button delete-icon" id="delete-button-${index}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        fileList.appendChild(listItem);

        if (isVideo) {
            const playButton = document.getElementById(`play-button-${index}`);
            playButton.addEventListener('click', () => {
                playVideo(file.url);
            });
        }

        const shareButton = document.getElementById(`share-button-${index}`);
        shareButton.addEventListener('click', () => {
            copyToClipboard(file.url);
        });

        const deleteButton = document.getElementById(`delete-button-${index}`);
        deleteButton.addEventListener('click', () => {
            deleteFile(file.name);
        });
    });

    document.querySelectorAll('.delete-icon').forEach(icon => {
        icon.addEventListener('click', function() {
            const fileItem = this.closest('.file-item');
            fileItem.remove();
        });
    });
}

// Função para renomear o arquivo no Firebase Storage
async function renameFile(oldName, newName) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('Usuário não autenticado');
            return;
        }

        const oldFileRef = ref(storage, `uploads/${user.uid}/${oldName}`);
        const newFileRef = ref(storage, `uploads/${user.uid}/${newName}`);

        const url = await getDownloadURL(oldFileRef);
        const response = await fetch(url);
        const blob = await response.blob();

        await uploadBytesResumable(newFileRef, blob);
        await deleteObject(oldFileRef);

        console.log(`Arquivo renomeado de ${oldName} para ${newName}`);
        alert(`Arquivo renomeado para ${newName} com sucesso!`);
        fetchAllFiles();
    } catch (error) {
        console.error('Erro ao renomear o arquivo:', error);
        alert(`Erro ao renomear o arquivo: ${error.code} - ${error.message}`);
    }
}

function playVideo(url) {
    const videoModal = document.getElementById('video-modal');
    const videoContainer = document.getElementById('video-player-container');

    videoModal.style.display = 'flex';

    if (videojs.getPlayer('video-player')) {
        videojs.getPlayer('video-player').dispose();
    }

    videoContainer.innerHTML = `
        <video id="video-player" class="video-js vjs-default-skin vjs-fluid" controls preload="auto"></video>
    `;

    const player = videojs('video-player', {
        autoplay: true,
        controls: true,
        sources: [{ src: url, type: 'video/mp4' }],
        aspectRatio: '16:9',
    });

    addCustomButtons(player);
}

function openVideoModal(videoUrl) {
    const videoModal = document.getElementById('video-modal');
    const videoContainer = document.getElementById('video-player-container');

    if (videojs.getPlayer('video-player')) {
        videojs.getPlayer('video-player').dispose();
    }

    videoContainer.innerHTML = `
        <video id="video-player" class="video-js vjs-default-skin vjs-fluid" controls preload="auto"></video>
    `;

    videojs('video-player', {
        autoplay: true,
        controls: true,
        sources: [{ src: videoUrl, type: getMimeType(videoUrl) }],
        aspectRatio: '16:9',
    });

    videoModal.style.display = 'flex';
}

function closeVideoModal() {
    const videoModal = document.getElementById('video-modal');
    const videoContainer = document.getElementById('video-player-container');

    videoModal.style.display = 'none';

    if (videojs.getPlayer('video-player')) {
        videojs.getPlayer('video-player').dispose();
    }

    videoContainer.innerHTML = '';
}

// Função para adicionar botões personalizados ao player
function addCustomButtons(videoPlayer) {
    if (videoPlayer.getChild('controlBar').getChild('RewindButton')) return;

    const RewindButton = videojs.getComponent('Button');
    const rewindButton = videojs.extend(RewindButton, {
        constructor: function() {
            RewindButton.apply(this, arguments);
            this.controlText('Retroceder 10 segundos');
            this.addClass('vjs-rewind-button');
            this.el().innerHTML = '<i class="fas fa-undo"></i>';
        },
        handleClick: function() {
            const currentTime = videoPlayer.currentTime();
            videoPlayer.currentTime(Math.max(0, currentTime - 10));
        }
    });

    videojs.registerComponent('RewindButton', rewindButton);
    videoPlayer.getChild('controlBar').addChild('RewindButton', {}, 0);

    const ForwardButton = videojs.getComponent('Button');
    const forwardButton = videojs.extend(ForwardButton, {
        constructor: function() {
            ForwardButton.apply(this, arguments);
            this.controlText('Avançar 10 segundos');
            this.addClass('vjs-forward-button');
            this.el().innerHTML = '<i class="fas fa-redo"></i>';
        },
        handleClick: function() {
            const currentTime = videoPlayer.currentTime();
            const duration = videoPlayer.duration();
            videoPlayer.currentTime(Math.min(duration, currentTime + 10));
        }
    });

    videojs.registerComponent('ForwardButton', forwardButton);
    videoPlayer.getChild('controlBar').addChild('ForwardButton', {}, 2);

    const DownloadButton = videojs.getComponent('Button');
    const downloadButton = videojs.extend(DownloadButton, {
        constructor: function() {
            DownloadButton.apply(this, arguments);
            this.controlText('Download Vídeo');
            this.addClass('vjs-download-button');
            this.el().innerHTML = '<i class="fas fa-download"></i>';
        },
        handleClick: function() {
            downloadCurrentVideo(videoPlayer.currentSrc());
        }
    });

    videojs.registerComponent('DownloadButton', downloadButton);
    videoPlayer.getChild('controlBar').addChild('DownloadButton', {}, videoPlayer.getChild('controlBar').children().length - 1);

    const EmbedButton = videojs.getComponent('Button');
    const embedButton = videojs.extend(EmbedButton, {
        constructor: function() {
            EmbedButton.apply(this, arguments);
            this.controlText('Copiar Código de Incorporação');
            this.addClass('vjs-embed-button');
            this.el().innerHTML = '<i class="fas fa-code"></i>';
            this.hide();
        },
        handleClick: function() {
            copyEmbedCode(videoPlayer.currentSrc());
        }
    });

    videojs.registerComponent('EmbedButton', embedButton);
    videoPlayer.getChild('controlBar').addChild('EmbedButton', {}, videoPlayer.getChild('controlBar').children().length - 1);

    const pipButtonInstance = videoPlayer.getChild('controlBar').getChild('PictureInPictureToggle');
    if (pipButtonInstance) {
        pipButtonInstance.hide();
    }

    videoPlayer.on('fullscreenchange', function() {
        const isFullscreen = videoPlayer.isFullscreen();
        const embedButtonInstance = videoPlayer.getChild('controlBar').getChild('EmbedButton');

        if (embedButtonInstance) {
            if (isFullscreen) {
                embedButtonInstance.show();
            } else {
                embedButtonInstance.hide();
            }
        }

        if (pipButtonInstance) {
            if (isFullscreen) {
                pipButtonInstance.show();
            } else {
                pipButtonInstance.hide();
            }
        }
    });
}

// Função para baixar o vídeo atual
function downloadCurrentVideo(videoUrl) {
    const videoName = videoUrl.substring(videoUrl.lastIndexOf('/') + 1).split('?')[0];
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = videoName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Função para copiar o código de incorporação para a área de transferência
function copyEmbedCode(videoUrl) {
    const embedPageUrl = `https://uparchive.github.io/uploadgalaxy/embed.html?videoUrl=${encodeURIComponent(videoUrl)}`;
    const embedCode = `<iframe src="${embedPageUrl}" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode).then(() => {
        alert('Código de incorporação copiado para a área de transferência!');
    }).catch((error) => {
        console.error('Erro ao copiar o código de incorporação:', error);
        alert('Erro ao copiar o código de incorporação. Tente novamente.');
    });
}

// Função para obter o tipo MIME do vídeo
function getMimeType(url) {
    const extension = url.split('.').pop().toLowerCase();
    switch (extension) {
        case 'mp4':
            return 'video/mp4';
        case 'mkv':
            return 'video/x-matroska';
        case 'webm':
            return 'video/webm';
        default:
            return 'video/mp4';
    }
}

// Ordenar arquivos com base na seleção
sortSelect.addEventListener('change', () => {
    sortFiles(sortSelect.value);
});

function sortFiles(criteria) {
    const sortedFiles = [...allFiles];
    switch (criteria) {
        case 'alphabetical':
            sortedFiles.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'alphabetical-desc':
            sortedFiles.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'newest':
            sortedFiles.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));
            break;
        case 'oldest':
            sortedFiles.sort((a, b) => new Date(a.timeCreated) - new Date(b.timeCreated));
            break;
        case 'size-asc':
            sortedFiles.sort((a, b) => a.size - b.size);
            break;
        case 'size-desc':
            sortedFiles.sort((a, b) => b.size - a.size);
            break;
        default:
            break;
    }
    displayFiles(sortedFiles);
}

// Função para excluir um arquivo
async function deleteFile(fileName) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('Usuário não autenticado para excluir arquivos');
            alert('Você precisa estar logado para excluir arquivos.');
            return;
        }
        const confirmDelete = confirm(`Tem certeza de que deseja excluir o arquivo "${fileName}"?`);
        if (!confirmDelete) {
            console.log('Exclusão cancelada pelo usuário.');
            return;
        }
        const fileRef = ref(storage, `uploads/${user.uid}/${fileName}`);
        await deleteObject(fileRef);
        console.log(`Arquivo "${fileName}" excluído com sucesso.`);
        alert('Arquivo excluído com sucesso!');
        await fetchAllFiles();
        updateStorageUsage();
    } catch (error) {
        console.error('Erro ao excluir o arquivo:', error);
        alert(`Erro ao excluir o arquivo: ${error.code} - ${error.message}`);
    }
}

// Função para formatar bytes em unidades legíveis
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Função para buscar e exibir arquivos com base na busca
searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    const filteredFiles = allFiles.filter(file => file.name.toLowerCase().includes(query));
    displayFiles(filteredFiles);
});

// Função para copiar URL para a área de transferência
function copyToClipboard(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('Link copiado para a área de transferência!');
    }).catch((error) => {
        console.error('Erro ao copiar link:', error);
        alert('Erro ao copiar link. Tente novamente.');
    });
}

// Função para logout (Desconectar o usuário)
async function logout() {
    try {
        await signOut(auth);
        console.log('Usuário desconectado com sucesso.');
        alert('Você foi desconectado com sucesso.');
    } catch (error) {
        console.error('Erro ao desconectar:', error);
        alert(`Erro ao desconectar: ${error.code} - ${error.message}`);
    }
}

logoutButton.addEventListener('click', () => {
    logout();
});

document.getElementById('close-video-modal').addEventListener('click', closeVideoModal);

// Impedir que o usuário saia durante o upload
window.addEventListener('beforeunload', function (e) {
    if (isUploading) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Exibir/ocultar o botão de voltar ao topo com base no scroll
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 200) {
        backToTopButton.style.display = 'block';
    } else {
        backToTopButton.style.display = 'none';
    }
});

// Tornar funções acessíveis globalmente
window.copyToClipboard = copyToClipboard;
window.deleteFile = deleteFile;
window.playVideo = playVideo;
