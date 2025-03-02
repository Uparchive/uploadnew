// script.js

// Importações do Firebase Modular SDK
import { initializeApp, setLogLevel } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject, getMetadata } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';

// Habilitar logs para depuração
setLogLevel('debug');

// Configuração do Firebase – substitua pelos seus dados
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID",
  measurementId: "SEU_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Elementos do DOM
const loginSection = document.getElementById('login-section');
const uploadSection = document.getElementById('upload-section');
const folderSection = document.getElementById('folder-section');
const googleLoginButton = document.getElementById('google-login-button');
const logoutButton = document.getElementById('logout-button');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const renameFileList = document.getElementById('rename-file-list');
const progressContainer = document.getElementById('progress-container');
const folderList = document.getElementById('folder-list');

let remainingFiles = [];
let isUploading = false;
let uploadTasks = [];
let allFiles = [];

// Monitorar o estado de autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.style.display = 'none';
    uploadSection.style.display = 'block';
    folderSection.style.display = 'block';
    logoutButton.style.display = 'block';
    fetchAllFiles();
  } else {
    loginSection.style.display = 'block';
    uploadSection.style.display = 'none';
    folderSection.style.display = 'none';
    logoutButton.style.display = 'none';
    folderList.innerHTML = '';
  }
});

// Login com Google
googleLoginButton.addEventListener('click', () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then(result => {
      alert('Login realizado com sucesso!');
    })
    .catch(error => {
      console.error('Erro no login:', error);
      alert('Erro ao fazer login: ' + error.message);
    });
});

// Logout
logoutButton.addEventListener('click', () => {
  signOut(auth)
    .then(() => {
      alert('Logout realizado com sucesso!');
    })
    .catch(error => {
      console.error('Erro no logout:', error);
      alert('Erro ao fazer logout: ' + error.message);
    });
});

// Ao selecionar arquivos, mostrar opções para renomear ou remover
fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  remainingFiles = files;
  renameFileList.innerHTML = '';
  files.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span id="file-name-${index}" class="file-name">${file.name}</span>
      <input type="text" id="rename-input-${index}" class="rename-input" value="${file.name}" style="display:none;">
      <button class="edit-btn" id="edit-btn-${index}" title="Renomear"><i class="fas fa-pencil-alt"></i></button>
      <button class="delete-btn" id="delete-btn-${index}" title="Remover"><i class="fas fa-trash"></i></button>
    `;
    renameFileList.appendChild(fileItem);

    // Renomear
    document.getElementById(`edit-btn-${index}`).addEventListener('click', () => {
      const nameSpan = document.getElementById(`file-name-${index}`);
      const renameInput = document.getElementById(`rename-input-${index}`);
      nameSpan.style.display = 'none';
      renameInput.style.display = 'inline-block';
      renameInput.focus();
      renameInput.addEventListener('blur', () => {
        if (renameInput.value.trim()) {
          nameSpan.textContent = renameInput.value.trim();
        }
        nameSpan.style.display = 'inline-block';
        renameInput.style.display = 'none';
      });
      renameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') renameInput.blur();
      });
    });

    // Remover arquivo da seleção
    document.getElementById(`delete-btn-${index}`).addEventListener('click', () => {
      if (confirm(`Remover o arquivo "${file.name}"?`)) {
        fileItem.remove();
        remainingFiles = remainingFiles.filter(f => f !== file);
      }
    });
  });
});

// Envio de arquivos
uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!isUploading && remainingFiles.length > 0) {
    startUpload(remainingFiles);
  } else {
    alert('Selecione pelo menos um arquivo para upload.');
  }
});

// Formatar tamanho dos arquivos
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  else return (bytes / 1073741824).toFixed(1) + ' GB';
}

// Iniciar o upload
function startUpload(files) {
  const user = auth.currentUser;
  if (!user) {
    alert('Você precisa estar logado para fazer upload.');
    return;
  }
  isUploading = true;
  progressContainer.style.display = 'block';
  progressContainer.innerHTML = '';
  uploadTasks = [];
  files.forEach((file, index) => {
    const renameInput = document.getElementById(`rename-input-${index}`);
    const customName = (renameInput && renameInput.value.trim()) ? renameInput.value.trim() : file.name;
    const storagePath = `uploads/${user.uid}/${customName}`;
    const fileRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    // Cria elemento de progresso
    const progressItem = document.createElement('div');
    progressItem.className = 'progress-item';
    progressItem.innerHTML = `<span>${customName} (${formatBytes(file.size)})</span>
      <div class="progress-bar-wrapper">
        <div class="progress-bar" id="progress-bar-${index}"></div>
        <span class="progress-text" id="progress-text-${index}">0%</span>
      </div>`;
    progressContainer.appendChild(progressItem);

    uploadTask.on('state_changed', snapshot => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      document.getElementById(`progress-bar-${index}`).style.width = progress + '%';
      document.getElementById(`progress-text-${index}`).textContent = progress.toFixed(0) + '%';
    }, error => {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload: ' + error.message);
    }, () => {
      getDownloadURL(uploadTask.snapshot.ref).then(url => {
        console.log('Arquivo enviado:', customName, url);
        fetchAllFiles(); // Atualiza a lista de arquivos
      });
    });
    uploadTasks.push(uploadTask);
  });
  Promise.all(uploadTasks.map(task => new Promise((resolve, reject) => {
    task.on('state_changed', null, reject, resolve);
  }))).then(() => {
    alert('Todos os arquivos foram enviados com sucesso!');
    fileInput.value = '';
    renameFileList.innerHTML = '';
    progressContainer.style.display = 'none';
    isUploading = false;
  }).catch(error => {
    console.error('Erro durante o upload:', error);
    alert('Erro durante o upload: ' + error.message);
    progressContainer.style.display = 'none';
    isUploading = false;
  });
}

// Buscar arquivos no Firebase Storage
async function fetchAllFiles() {
  const user = auth.currentUser;
  if (!user) return;
  const userFilesRef = ref(storage, `uploads/${user.uid}/`);
  try {
    const res = await listAll(userFilesRef);
    const filesPromises = res.items.map(async (item) => {
      try {
        const url = await getDownloadURL(item);
        const metadata = await getMetadata(item);
        return {
          name: item.name,
          url: url,
          size: Number(metadata.size),
          timeCreated: metadata.timeCreated
        };
      } catch (err) {
        console.error('Erro ao obter arquivo:', item.name, err);
        return null;
      }
    });
    const files = await Promise.all(filesPromises);
    allFiles = files.filter(file => file !== null);
    displayFiles(allFiles);
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
  }
}

// Exibir arquivos na seção de pastas (grid)
function displayFiles(files) {
  folderList.innerHTML = '';
  if (files.length === 0) {
    folderList.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
    return;
  }
  files.forEach((file, index) => {
    const fileCard = document.createElement('div');
    fileCard.className = 'folder-item';
    const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);
    fileCard.innerHTML = `
      <i class="fas ${isVideo ? 'fa-file-video' : 'fa-file'} folder-icon"></i>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatBytes(file.size)}</span>
      <div class="file-actions">
        ${isVideo ? `<button class="play-button" data-index="${index}" title="Play"><i class="fas fa-play"></i></button>` : ''}
        <a href="${file.url}" class="download-button" download="${file.name}" title="Download"><i class="fas fa-download"></i></a>
        <button class="delete-button" data-index="${index}" title="Excluir"><i class="fas fa-trash"></i></button>
      </div>
    `;
    folderList.appendChild(fileCard);

    if (isVideo) {
      fileCard.querySelector('.play-button').addEventListener('click', () => {
        window.open(file.url, '_blank');
      });
    }

    fileCard.querySelector('.delete-button').addEventListener('click', () => {
      if (confirm(`Excluir o arquivo "${file.name}"?`)) {
        deleteFile(file.name);
      }
    });
  });
}

// Excluir arquivo do Firebase Storage
function deleteFile(fileName) {
  const user = auth.currentUser;
  if (!user) return;
  const fileRef = ref(storage, `uploads/${user.uid}/${fileName}`);
  deleteObject(fileRef).then(() => {
    alert(`Arquivo ${fileName} excluído com sucesso.`);
    fetchAllFiles();
  }).catch(error => {
    console.error('Erro ao excluir arquivo:', error);
    alert('Erro ao excluir arquivo: ' + error.message);
  });
}
