let socket = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
let reconnectTimer = null;

const currentUser = {
  id: '',
  username: '',
  avatar: '',
  isAdmin: false,
  isPremium: false,
  isModerator: false
};

let typing = false;
let typingTimeout;

let typingUsers = new Set();

let activeMessageMenu = null;
let editingMessageId = null;
let replyingToMessageId = null;

const ADMIN_USERNAMES = ['yurii_fisting', 'lovely', 'Йогурт', 'Yogurt', 'Kiequra', 'Kirymeww', 'Кай', 'ЮркаФистинг'];

const MAX_GROUP_NAME_LENGTH = 15;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_TEXT_LENGTH = 100;  

function addAdminBadge(parentElement) { 
  const adminBadge = document.createElement('img');
  adminBadge.src = 'public/Images/verified.png';
  adminBadge.className = 'admin-badge';
  parentElement.appendChild(adminBadge);

  adminBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Администратор'));
  adminBadge.addEventListener('mouseleave', hideCustomTooltip);
}

function addModeratorBadge(parentElement) {
  const moderatorBadge = document.createElement('img');
  moderatorBadge.src = 'public/Images/moderator.png';
  moderatorBadge.className = 'moderator-badge';
  moderatorBadge.style.width = '16px';
  moderatorBadge.style.height = '16px';
  moderatorBadge.style.marginLeft = '6px';
  moderatorBadge.style.verticalAlign = 'text-bottom';
  parentElement.appendChild(moderatorBadge);
  moderatorBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Модератор'));
  moderatorBadge.addEventListener('mouseleave', hideCustomTooltip);
}

function addPremiumBadge(parentElement) {
  const premiumBadge = document.createElement('img');
  premiumBadge.src = 'public/Images/premium.png';
  premiumBadge.className = 'premium-badge';
  premiumBadge.style.width = '16px';
  premiumBadge.style.height = '16px';
  premiumBadge.style.marginLeft = '6px';
  premiumBadge.style.verticalAlign = 'text-bottom';
  premiumBadge.style.filter = 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.6))';
  parentElement.appendChild(premiumBadge);

  premiumBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Премиум-пользователь'));
  premiumBadge.addEventListener('mouseleave', hideCustomTooltip);
}

function createMessageElement(message, isMyMessage, isNewMessage = true) {
  const messageWrapper = document.createElement('div');
  
  if (isNewMessage) {
    messageWrapper.className = `messageWrapper ${isMyMessage ? 'myMessage' : ''}`;
  } else {
    messageWrapper.className = `messageWrapper ${isMyMessage ? 'myMessage' : ''} no-animation`;
  }
  
  messageWrapper.dataset.messageId = message.id;
  messageWrapper.dataset.userId = message.user.id;
  messageWrapper.dataset.username = message.user.username;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'messageContent';
  
  const messageSender = document.createElement('div');
  messageSender.className = 'messageSender';
  messageSender.textContent = isMyMessage ? '' : message.user.username;
  
  if (!isMyMessage) {
    if (message.user.isAdmin) {
      addAdminBadge(messageSender);
    } else if (message.user.isModerator) {
      addModeratorBadge(messageSender);
    } else if (message.user.isPremium) {
      addPremiumBadge(messageSender);
    }
  }
  
  messageContent.appendChild(messageSender);
  
  if (message.replyTo && document.querySelector(`.messageWrapper[data-message-id="${message.replyTo.id}"]`)) {
    const replyBlock = document.createElement('div');
    replyBlock.className = 'messageReply';
    replyBlock.setAttribute('data-reply-to', message.replyTo.id);
    const replyAuthor = document.createElement('div');
    replyAuthor.className = 'replyAuthor';
    replyAuthor.textContent = message.replyTo.username;
    const replyText = document.createElement('div');
    replyText.className = 'replyText';
    let replyPreview = message.replyTo.text;
    if (replyPreview.length > MAX_REPLY_TEXT_LENGTH) {
      replyPreview = replyPreview.slice(0, MAX_REPLY_TEXT_LENGTH) + '...';
    }
    replyText.textContent = replyPreview;
    replyBlock.appendChild(replyAuthor);
    replyBlock.appendChild(replyText);
    replyBlock.addEventListener('click', function(e) {
      e.stopPropagation();
      scrollToMessage(message.replyTo.id);
    });
    messageContent.appendChild(replyBlock);
  }
  
  const messageText = document.createElement('div');
  messageText.className = 'messageText';
  messageText.textContent = message.text;
  messageContent.appendChild(messageText);
  
  if (message.files && message.files.length > 0) {
    const filesContainer = document.createElement('div');
    filesContainer.className = 'messageFiles';
    filesContainer.style.cssText = `
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    message.files.forEach((file, index) => {
      const fileElement = document.createElement('div');
      fileElement.className = 'messageFile';
      fileElement.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        border: 1px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const mediaPreview = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
        const isMobile = window.innerWidth <= 768;
        mediaPreview.style.cssText = `
          width: ${isMobile ? '50px' : '60px'};
          height: ${isMobile ? '50px' : '60px'};
          object-fit: cover;
          border-radius: 6px;
          margin-right: ${isMobile ? '10px' : '12px'};
          flex-shrink: 0;
          border: 1px solid var(--border-color);
        `;
        
        if (file.type.startsWith('video/')) {
          mediaPreview.muted = true;
          mediaPreview.loop = true;
          mediaPreview.playsInline = true;
        }
        
        if (file.url) {
          mediaPreview.src = file.url;
        } else if (file.data) {
          try {
            if (typeof file.data === 'string' && file.data.startsWith('data:')) {
              mediaPreview.src = file.data;
            } else if (typeof file.data === 'string') {
              mediaPreview.src = `data:${file.type};base64,${file.data}`;
            } else {
              const blob = new Blob([file.data], { type: file.type });
              mediaPreview.src = URL.createObjectURL(blob);
            }
          } catch (error) {
            mediaPreview.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MEgyMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHBhdGggZD0iTTI1IDI1TDM1IDM1TDI1IDM1VjI1WiIgZmlsbD0iIzg4OCIvPgo8L3N2Zz4K';
          }
        } else {
          mediaPreview.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MEgyMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHBhdGggZD0iTTI1IDI1TDM1IDM1TDI1IDM1VjI1WiIgZmlsbD0iIzg4OCIvPgo8L3N2Zz4K';
        }
        
        fileElement.appendChild(mediaPreview);
      } else {
        const fileIcon = document.createElement('span');
        fileIcon.textContent = getFileIcon(file.type);
        fileIcon.style.cssText = `
          font-size: 20px;
          margin-right: 10px;
          flex-shrink: 0;
        `;
        fileElement.appendChild(fileIcon);
      }
      
      const fileInfo = document.createElement('div');
      fileInfo.style.cssText = `
        flex: 1;
        min-width: 0;
      `;
      
              const fileName = document.createElement('div');
        const lastDotIndex = file.name.lastIndexOf('.');
        if (lastDotIndex > 0) {
          const nameWithoutExt = file.name.substring(0, lastDotIndex);
          const extension = file.name.substring(lastDotIndex);
          const displayName = nameWithoutExt.length > 5 ? nameWithoutExt.substring(0, 5) + '...' + extension : file.name;
          fileName.textContent = displayName;
        } else {
          const displayName = file.name.length > 5 ? file.name.substring(0, 5) + '...' : file.name;
          fileName.textContent = displayName;
        }
        fileName.title = file.name; 
      fileName.style.cssText = `
        font-weight: 500;
        color: var(--text-color);
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      
      const fileSize = document.createElement('div');
      fileSize.textContent = formatFileSize(file.size);
      fileSize.style.cssText = `
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 2px;
      `;
      
      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileSize);
      
      const downloadBtn = document.createElement('button');
      downloadBtn.innerHTML = '<img src="public/Images/download_attachment.png" style="width: 16px; height: 16px; filter: invert(1) brightness(0.8);" alt="Скачать">';
      downloadBtn.className = 'download-btn';
      downloadBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadFile(file);
      });
      
      downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.transform = 'scale(1.1)';
        downloadBtn.style.filter = 'brightness(1.2)';
      });
      
      downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.transform = 'scale(1)';
        downloadBtn.style.filter = 'brightness(1)';
      });
      
      fileElement.appendChild(fileInfo);
      fileElement.appendChild(downloadBtn);
      
      fileElement.addEventListener('click', () => {
        if (file.type.startsWith('image/')) {
          showImagePreview(file);
        } else if (file.type.startsWith('video/')) {
          showVideoPreview(file);
        } else {
          downloadFile(file);
        }
      });
      
      filesContainer.appendChild(fileElement);
    });
    
    messageContent.appendChild(filesContainer);
  }
  
  const messageTime = document.createElement('div');
  messageTime.className = 'messageTime';
  messageTime.textContent = formatTime(message.time);
  if (message.edited) {
    messageTime.textContent += ' (изменено)';
  }
  messageContent.appendChild(messageTime);
  
  messageWrapper.appendChild(messageContent);
  
  if (!isMyMessage) {
    const avatar = document.createElement('img');
    avatar.src = 'public/' + message.user.avatar;
    avatar.className = 'userAvatar';
    avatar.alt = message.user.username;
    avatar.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      margin-right: 10px;
      flex-shrink: 0;
    `;
    messageWrapper.prepend(avatar);
  }
  
  messageContent.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (editingMessageId === message.id) {
      return;
    }
    
    const menuX = e.clientX;
    const menuY = e.clientY;
    
    showMessageMenu(message.id, menuX, menuY);
  });
  
  return messageWrapper;
}

function showMessageMenu(messageId, x, y) {
  closeMessageMenu();

  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  const isMyMessage = messageWrapper && (messageWrapper.classList.contains('myMessage') || messageWrapper.dataset.userId === currentUser.id || messageWrapper.dataset.username.toLowerCase() === currentUser.username.toLowerCase());

  const menu = document.createElement('div');
  menu.className = 'message-context-menu';
  let menuHtml = `<div class="menu-item reply-message">Ответить</div>`;
  menuHtml += `<div class="menu-item copy-message">Скопировать</div>`;
  if (isMyMessage) {
    menuHtml += `<div class="menu-item edit-message">Редактировать</div>`;
    menuHtml += `<div class="menu-item delete-message">Удалить</div>`;
  }
  menu.innerHTML = menuHtml;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    menu.classList.add('mobile');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transform = 'translate(-50%, -100%)';
    setTimeout(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.left < 10) {
        menu.style.left = '10px';
        menu.style.transform = 'translateY(-100%)';
      }
      if (menuRect.right > window.innerWidth - 10) {
        menu.style.left = `${window.innerWidth - 10}px`;
        menu.style.transform = 'translate(-100%, -100%)';
      }
      if (menuRect.top < 10) {
        menu.style.top = `${y + 20}px`;
        menu.style.transform = menu.style.transform.includes('translateX') ? 
          menu.style.transform.replace('translateY(-100%)', 'translateY(0)') :
          menu.style.transform.replace('translate(-50%, -100%)', 'translate(-50%, 0)').replace('translate(-100%, -100%)', 'translate(-100%, 0)');
      }
      if (menuRect.bottom > window.innerHeight - 10) {
        menu.style.top = `${y - 20}px`;
        menu.style.transform = menu.style.transform.includes('translateX') ? 
          menu.style.transform.replace('translateY(0)', 'translateY(-100%)') :
          menu.style.transform.replace('translate(-50%, 0)', 'translate(-50%, -100%)').replace('translate(-100%, 0)', 'translate(-100%, -100%)');
      }
    }, 0);
  } else {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    setTimeout(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
      }
    }, 0);
  }

  document.body.appendChild(menu);
  activeMessageMenu = { menu, messageId };

  menu.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  menu.querySelector('.copy-message').addEventListener('click', function(e) {
    e.stopPropagation();
    const messageText = messageWrapper.querySelector('.messageText').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText).then(() => {
        createNotificationToast('Скопировано!');
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = messageText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      createNotificationToast('Скопировано!');
    }
    closeMessageMenu();
  });

  menu.querySelector('.reply-message').addEventListener('click', function(e) {
    e.stopPropagation();
    startReplyToMessage(messageId);
    closeMessageMenu();
  });
  if (isMyMessage) {
    menu.querySelector('.edit-message').addEventListener('click', function(e) {
      e.stopPropagation();
      startEditingMessage(messageId);
      closeMessageMenu();
    });
    menu.querySelector('.delete-message').addEventListener('click', function(e) {
      e.stopPropagation();
      confirmDeleteMessage(messageId);
      closeMessageMenu();
    });
  }

  const escHandler = function(e) {
    if (e.key === 'Escape') {
      closeMessageMenu();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  setTimeout(() => {
    document.addEventListener('click', closeMessageMenu);
  }, 10);
}

function closeMessageMenu() {
  if (activeMessageMenu && activeMessageMenu.menu) {
    if (document.body.contains(activeMessageMenu.menu)) {
      activeMessageMenu.menu.remove();
    }
    document.removeEventListener('click', closeMessageMenu);
    document.removeEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMessageMenu();
    });
    activeMessageMenu = null;
  }
}

function startEditingMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  if (!messageTextElement) return;
  
  const originalText = messageTextElement.textContent;
  
  messageWrapper.classList.add('editing');
  
  const sendButton = document.getElementById('send-button');
  sendButton.classList.add('editing');
  
  const messageInput = document.getElementById('message-input');
  const currentInputText = messageInput.value;
  
  const previousState = {
    text: currentInputText,
    placeholder: messageInput.placeholder
  };
  
  messageInput.value = originalText;
  messageInput.placeholder = 'Редактирование сообщения...';
  messageInput.focus();
  messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
  
  editingMessageId = messageId;
  
  const keyHandler = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newText = messageInput.value.trim();
      if (newText && newText !== originalText) {
        if (newText.length > MAX_MESSAGE_LENGTH) {
          showConfirmModal("Слишком длинное сообщение", `Максимальная длина сообщения — ${MAX_MESSAGE_LENGTH} символов.`, false);
          return;
        }
        socket.send(JSON.stringify({
          event: 'editMessage',
          data: { id: editingMessageId, text: newText }
        }));
        
        messageInput.value = '';
        messageInput.placeholder = previousState.placeholder;
        
        messageWrapper.classList.remove('editing');
        
        document.getElementById('send-button').classList.remove('editing');
        
        editingMessageId = null;
        
        closeMessageMenu();
        messageInput.removeEventListener('keydown', keyHandler);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      messageInput.value = previousState.text;
      messageInput.placeholder = previousState.placeholder;
      
      messageWrapper.classList.remove('editing');
      
      document.getElementById('send-button').classList.remove('editing');
      
      editingMessageId = null;
      
      closeMessageMenu();
      messageInput.removeEventListener('keydown', keyHandler);
    }
  };
  
  messageInput.addEventListener('keydown', keyHandler);
}

function confirmDeleteMessage(messageId) {
  showConfirmModal(
    "Удалить сообщение",
    "Вы уверены, что хотите удалить это сообщение?",
    true,
    () => {
      if (socket) {
        socket.send(JSON.stringify({
          event: 'deleteMessage',
          data: { id: messageId }
        }));
      }
    }
  );
}

function updateMessageText(messageId, newText, isEdited) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  const messageTimeElement = messageWrapper.querySelector('.messageTime');
  
  if (messageTextElement) {
    messageTextElement.textContent = newText;
  }
  
  if (messageTimeElement && isEdited) {
    if (!messageTimeElement.textContent.includes('(изменено)')) {
      messageTimeElement.textContent += ' (изменено)';
    }
  }
}

function removeMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (messageWrapper) {
    messageWrapper.classList.add('removing');
    setTimeout(() => {
      messageWrapper.remove();
    }, 300);
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addUserToList(user, isNewUser = true) {
  const usersList = document.querySelector('.usersList');
  
  const existingUser = document.getElementById(`user-${user.id}`);
  
  if (existingUser) {
    const avatarElement = existingUser.querySelector('.userAvatar');
    if (avatarElement) {
      avatarElement.src = 'public/' + user.avatar;
    }
    return;
  }
  
  const userItem = document.createElement('div');
  
  if (isNewUser) {
    userItem.className = 'userItem';
  } else {
    userItem.className = 'userItem no-animation';
  }
  
  userItem.id = `user-${user.id}`;
  
  if (user.id === currentUser.id) {
    userItem.classList.add('current-user');
  }
  
  const avatar = document.createElement('img');
  avatar.src = 'public/' + user.avatar;
  avatar.className = 'userAvatar online';
  avatar.alt = user.username;
  
  const userName = document.createElement('div');
  userName.className = 'userName';
  userName.textContent = user.username;
  
  if (user.isAdmin) {
    addAdminBadge(userName);
  } else if (user.isModerator) {
    addModeratorBadge(userName);
  } else if (user.isPremium) {
    addPremiumBadge(userName);
  }
  
  userItem.appendChild(avatar);
  userItem.appendChild(userName);
  
  if (user.id === currentUser.id) {
    const existingSeparator = document.querySelector('.users-separator');
    if (!existingSeparator) {
      const separator = document.createElement('div');
      separator.className = 'users-separator';
      
      if (usersList.firstChild) {
        usersList.insertBefore(separator, usersList.firstChild);
        usersList.insertBefore(userItem, usersList.firstChild);
      } else {
        usersList.appendChild(userItem);
        usersList.appendChild(separator);
      }
    } else {
      usersList.insertBefore(userItem, usersList.firstChild);
    }
  } else {
    const separator = document.querySelector('.users-separator');
    if (separator) {
      separator.parentNode.insertBefore(userItem, separator.nextSibling);
    } else {
      usersList.appendChild(userItem);
    }
  }
}

function removeUser(userId) {
  const userElement = document.getElementById(`user-${userId}`);
  if (userElement) {
    userElement.remove();
  }
}



let attachedFiles = [];
const MAX_FILE_SIZE = 25 * 1024 * 1024; 
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
  'video/mp4'
];

let currentPage = 0;
let hasMoreMessages = false;
let isLoadingMessages = false;

function attachFile() {
  
  if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
    showConfirmModal('Ошибка', 'Ваш браузер не поддерживает загрузку файлов.', false);
    return;
  }
  
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = ALLOWED_FILE_TYPES.join(',');
    
  input.addEventListener('error', (e) => {
    showConfirmModal('Ошибка', 'Не удалось выбрать файлы. Попробуйте еще раз.', false);
  });
  
  input.addEventListener('change', (e) => {
    
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const files = Array.from(e.target.files);
    const validFiles = [];
    const invalidFiles = [];
    
    
    for (let file of files) {
      
      if (file.size > MAX_FILE_SIZE) {
        showConfirmModal('Файл слишком большой', `Файл "${file.name}" превышает максимальный размер 25MB.`, false);
        return;
      }
      
      if (ALLOWED_FILE_TYPES.includes(file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }
    
    if (invalidFiles.length > 0) {
      const invalidFilesList = invalidFiles.slice(0, 3).join(', ');
      const message = invalidFiles.length > 3 
        ? `Файлы "${invalidFilesList}" и еще ${invalidFiles.length - 3} не поддерживаются. Разрешены только изображения (PNG, JPEG, GIF, WebP, BMP, TIFF) и видео MP4.`
        : `Файлы "${invalidFilesList}" не поддерживаются. Разрешены только изображения (PNG, JPEG, GIF, WebP, BMP, TIFF) и видео MP4.`;
      
      showConfirmModal('Неподдерживаемый тип файла', message, false);
    }
    
    if (validFiles.length > 0) {
      attachedFiles = attachedFiles.concat(validFiles);
      updateFilePreview();
    }
    
    input.value = '';
  });
  
  try {
    input.click();
  } catch (error) {
    showConfirmModal('Ошибка', 'Не удалось открыть диалог выбора файлов. Попробуйте еще раз.', false);
  }
}

function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('text/')) return '📄';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('word')) return '📘';
  return '📎';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadFile(file) {
  let url;
  
  if (file.url) {
    url = file.url;
  } else if (file.data) {
    const blob = new Blob([file.data], { type: file.type });
    url = URL.createObjectURL(blob);
  } else if (file instanceof File) {
    url = URL.createObjectURL(file);
  } else {
    return;
  }
  
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  if (url !== file.url) {
    URL.revokeObjectURL(url);
  }
}

function showImagePreview(file) {
  
  const modal = document.createElement('div');
  const isMobile = window.innerWidth <= 768;
  
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  `;
  
  const img = document.createElement('img');
  
  try {
    if (file.url) {
      img.src = file.url;
    } else if (file.data) {
      if (typeof file.data === 'string' && file.data.startsWith('data:')) {
        img.src = file.data;
      } else if (typeof file.data === 'string') {
        img.src = `data:${file.type};base64,${file.data}`;
      } else {
        const blob = new Blob([file.data], { type: file.type });
        img.src = URL.createObjectURL(blob);
      }
    } else if (file instanceof File) {
      img.src = URL.createObjectURL(file);
    } else {
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MFY0MEgyMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHBhdGggZD0iTTI1IDI1TDM1IDM1TDI1IDM1VjI1WiIgZmlsbD0iIzg4OCIvPgo8L3N2Zz4K';
    }
  } catch (error) {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MFY0MEgyMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHBhdGggZD0iTTI1IDI1TDM1IDM1TDI1IDM1VjI1WiIgZmlsbD0iIzg4OCIvPgo8L3N2Zz4K';
  }
  
  img.style.cssText = `
    max-width: ${isMobile ? '98%' : '95%'};
    max-height: ${isMobile ? '98%' : '95%'};
    object-fit: contain;
    border-radius: ${isMobile ? '8px' : '12px'};
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    transition: transform 0.3s ease;
  `;
  
  if (!isMobile) {
    img.addEventListener('mouseenter', () => {
      img.style.transform = 'scale(1.02)';
    });
    
    img.addEventListener('mouseleave', () => {
      img.style.transform = 'scale(1)';
    });
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      URL.revokeObjectURL(img.src);
    }
  });
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      URL.revokeObjectURL(img.src);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  modal.appendChild(img);
  document.body.appendChild(modal);
}

function showVideoPreview(file) {
  
  const modal = document.createElement('div');
  const isMobile = window.innerWidth <= 768;
  
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  `;
  
  const video = document.createElement('video');
  
  try {
    if (file.url) {
      video.src = file.url;
    } else if (file.data) {
      if (typeof file.data === 'string' && file.data.startsWith('data:')) {
        video.src = file.data;
      } else if (typeof file.data === 'string') {
        video.src = `data:${file.type};base64,${file.data}`;
      } else {
        const blob = new Blob([file.data], { type: file.type });
        video.src = URL.createObjectURL(blob);
      }
    } else if (file instanceof File) {  
      video.src = URL.createObjectURL(file);
    } else {
      return;
    }
  } catch (error) {
    return;
  }
  
  video.style.cssText = `
    max-width: ${isMobile ? '98%' : '95%'};
    max-height: ${isMobile ? '98%' : '95%'};
    object-fit: contain;
    border-radius: ${isMobile ? '8px' : '12px'};
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;
  
  video.controls = true;
  video.autoplay = false;
  video.muted = false;
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      URL.revokeObjectURL(video.src);
    }
  });
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      URL.revokeObjectURL(video.src);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  modal.appendChild(video);
  document.body.appendChild(modal);
}

function updateFilePreview() {
  const oldPreview = document.querySelector('.file-preview');
  if (oldPreview) {
    oldPreview.remove();
  }
  
  if (attachedFiles.length === 0) return;
  
  const inputArea = document.querySelector('.inputArea');
  if (!inputArea) return;
  
  const preview = document.createElement('div');
  preview.className = 'file-preview';
  
  const isMobile = window.innerWidth <= 768;
  
  preview.style.cssText = `
    background: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  `;
  
  const title = document.createElement('div');
  title.textContent = `📎 ${attachedFiles.length} файл(ов)`;
  title.style.cssText = `
    font-weight: 500;
    color: var(--text-color);
    font-size: 13px;
  `;
  preview.appendChild(title);
  
  const fileCount = document.createElement('div');
  fileCount.textContent = `${attachedFiles.length} файл(ов) готово к отправке`;
  fileCount.style.cssText = `
    color: var(--text-secondary);
    font-size: 12px;
    margin-top: 4px;
  `;
  preview.appendChild(fileCount);
  
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '✕';
  clearBtn.style.cssText = `
    background: rgba(255, 82, 82, 0.1);
    color: #ff5252;
    border: 1px solid rgba(255, 82, 82, 0.3);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 8px;
    transition: all 0.2s ease;
    margin-top: 4px;
  `;
  clearBtn.addEventListener('click', () => {
    attachedFiles = [];
    updateFilePreview();
  });
  preview.appendChild(clearBtn);
  
  inputArea.parentNode.insertBefore(preview, inputArea);
}

function sendMessage() {
  if (!socket) return;
  
  const messageInput = document.getElementById('message-input');
  let message = messageInput.value.trim();
  
  if (message) {
    if (editingMessageId) {
      const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${editingMessageId}"]`);
      const originalText = messageWrapper.querySelector('.messageText').textContent;
      const newText = messageInput.value.trim();
      if (newText && newText !== originalText) {
        if (newText.length > MAX_MESSAGE_LENGTH) {
          showConfirmModal("Слишком длинное сообщение", `Максимальная длина сообщения — ${MAX_MESSAGE_LENGTH} символов.`, false);
          return;
        }
        socket.send(JSON.stringify({
          event: 'editMessage',
          data: { id: editingMessageId, text: newText }
        }));
      }
      messageWrapper.classList.remove('editing');
      document.getElementById('send-button').classList.remove('editing');
      messageInput.value = '';
      messageInput.placeholder = 'Введите сообщение...';
      editingMessageId = null;
      return;
    }
    let parts = [];
    while (message.length > 0) {
      parts.push(message.slice(0, MAX_MESSAGE_LENGTH));
      message = message.slice(MAX_MESSAGE_LENGTH);
    }
    const messageData = { text: parts[0] };
    if (replyingToMessageId) {
      const replyToMessage = document.querySelector(`.messageWrapper[data-message-id="${replyingToMessageId}"]`);
      if (replyToMessage) {
        const replyText = replyToMessage.querySelector('.messageText').textContent;
        const replyUsername = replyToMessage.querySelector('.messageSender').textContent || currentUser.username;
        messageData.replyTo = {
          id: replyingToMessageId,
          text: replyText,
          username: replyUsername
        };
      }
    }
    
    if (attachedFiles.length > 0) {
      const sendButton = document.getElementById('send-button');
      const originalHTML = sendButton.innerHTML;
      sendButton.innerHTML = '<img src="public/Images/send.png" class="loading-icon" style="width: 28px; height: 28px; filter: brightness(0.5);" alt="Загрузка">';
      sendButton.disabled = true;
      
      const filesData = [];
      let loadedFiles = 0;
      const totalFiles = attachedFiles.length;
      
      const sendMessageWithFiles = () => {
        const finalMessageData = { ...messageData };
        finalMessageData.files = filesData;
        socket.send(JSON.stringify({
          event: 'chatMessage',
          data: finalMessageData
        }));
        
        attachedFiles = [];
        updateFilePreview();
        messageInput.value = '';
        messageInput.placeholder = 'Введите сообщение...';
        messageInput.focus();
        if (replyingToMessageId) {
          cancelReply();
        }
        socket.send(JSON.stringify({
          event: 'stopTyping'
        }));
        typing = false;
        typingUsers.delete(currentUser.id);
        updateTypingIndicator();
        clearTimeout(typingTimeout);
        
        sendButton.innerHTML = originalHTML;
        sendButton.disabled = false;
      };
      
      for (const file of attachedFiles) {
        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size
        };
        
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          const reader = new FileReader();
          reader.onload = function(e) {
            fileData.data = e.target.result;
            loadedFiles++;
            
            if (loadedFiles === totalFiles) {
              sendMessageWithFiles();
            }
          };
          reader.onerror = function() {
            loadedFiles++;
            if (loadedFiles === totalFiles) {
              sendMessageWithFiles();
            }
          };
          reader.readAsDataURL(file);
        } else {
          fileData.data = null;
          loadedFiles++;
        }
        
        filesData.push(fileData);
      }
      
      const hasMediaFiles = attachedFiles.some(file => 
        file.type.startsWith('image/') || file.type.startsWith('video/')
      );
      
      if (!hasMediaFiles) {
        sendMessageWithFiles();
      }
      
      return;
    }
    
    socket.send(JSON.stringify({
      event: 'chatMessage',
      data: messageData
    }));
    
    for (let i = 1; i < parts.length; i++) {
      const additionalMessageData = { text: parts[i] };
      socket.send(JSON.stringify({
        event: 'chatMessage',
        data: additionalMessageData
      }));
    }
    
    attachedFiles = [];
    updateFilePreview();
    messageInput.value = '';
    messageInput.placeholder = 'Введите сообщение...';
    messageInput.focus();
    if (replyingToMessageId) {
      cancelReply();
    }
    socket.send(JSON.stringify({
      event: 'stopTyping'
    }));
    typing = false;
    typingUsers.delete(currentUser.id);
    updateTypingIndicator();
    clearTimeout(typingTimeout);
  }
}

function handleTyping() {
  if (!socket) return;
  
  if (!typing) {
    typing = true;
    typingUsers.add(currentUser.id);
    socket.send(JSON.stringify({
      event: 'typing'
    }));
  }
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.send(JSON.stringify({
      event: 'stopTyping'
    }));
    typing = false;
    typingUsers.delete(currentUser.id);
    updateTypingIndicator();
  }, 2000);
}

function initChat(userData) {
  try {
    if (!userData || !userData.user) {
      console.error('Invalid userData received:', userData);
      showConfirmModal("Ошибка входа", "Получены некорректные данные от сервера", false);
      return;
    }
    
    if (document.getElementById('login-form').style.display === 'none') {
      
      currentUser.id = userData.user.id;
      currentUser.username = userData.user.username;
      currentUser.avatar = userData.user.avatar;
      currentUser.isAdmin = userData.user.isAdmin;
      currentUser.isPremium = userData.user.isPremium;
      currentUser.isModerator = userData.user.isModerator;
      
      document.getElementById('current-user-avatar').src = 'public/' + userData.user.avatar;
      const userNameElement = document.getElementById('current-user-name');
      userNameElement.textContent = userData.user.username;
      
      userNameElement.querySelectorAll('.admin-badge, .premium-badge').forEach(badge => badge.remove());
      
      if (userData.user.isAdmin) {
        addAdminBadge(userNameElement);
      } else if (userData.user.isModerator) {
        addModeratorBadge(userNameElement);
      } else if (userData.user.isPremium) {
        addPremiumBadge(userNameElement);
      }
      
      if (Array.isArray(userData.users)) {
        document.querySelector('.usersList').innerHTML = '';
        userData.users.forEach(user => {
          addUserToList(user, false);
        });
      }
      
      document.getElementById('current-user-avatar').addEventListener('click', showAvatarSelector);
      
      return;
    }
    
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';

    currentUser.id = userData.user.id;
    currentUser.username = userData.user.username;
    currentUser.avatar = userData.user.avatar;
    currentUser.isAdmin = userData.user.isAdmin;
    currentUser.isPremium = userData.user.isPremium;
    currentUser.isModerator = userData.user.isModerator;
    
    document.getElementById('current-user-avatar').src = 'public/' + userData.user.avatar;
    const userNameElement = document.getElementById('current-user-name');
    userNameElement.textContent = userData.user.username;
    
    userNameElement.querySelectorAll('.admin-badge, .premium-badge').forEach(badge => badge.remove());
    
    if (userData.user.isAdmin) {
      addAdminBadge(userNameElement);
    } else if (userData.user.isModerator) {
      addModeratorBadge(userNameElement);
    } else if (userData.user.isPremium) {
      addPremiumBadge(userNameElement);
    }
    
    document.getElementById('group-name').textContent = userData.groupName;
    document.querySelector('.usersList').innerHTML = '';
    
    if (Array.isArray(userData.users)) {
      userData.users.forEach(user => {
        addUserToList(user, false);
      });
    } else {
      console.warn('Users list is not an array:', userData.users);
    }
    
    const messagesContainer = document.querySelector('.messagesContainer');
    messagesContainer.innerHTML = '';
    
    if (Array.isArray(userData.messages)) {
      userData.messages.forEach(message => {
        const isMyMessage = message.user.id === currentUser.id || message.user.username.toLowerCase() === currentUser.username.toLowerCase();
        const messageElement = createMessageElement(message, isMyMessage, false);
        messagesContainer.appendChild(messageElement);
      });
    } else {
      console.warn('Messages list is not an array:', userData.messages);
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    document.getElementById('message-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    document.getElementById('message-input').addEventListener('input', () => {
      handleTyping();
    });
    
    document.getElementById('send-button').addEventListener('click', sendMessage);
    const attachButton = document.getElementById('attach-button');
    
    attachButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showAttachModal();
    });
    
    attachButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
    });
    
    attachButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showAttachModal();
    });
    
    document.getElementById('group-name').addEventListener('click', (e) => {
      if (!currentUser.isAdmin && !currentUser.isModerator && !currentUser.isPremium) {
        showConfirmModal('Ошибка доступа', 'У вас нет прав изменять название группы.', false);
        return;
      }
      
      const groupNameElement = e.target;
      if (groupNameElement.isContentEditable) return;

      const originalName = groupNameElement.textContent;
      groupNameElement.contentEditable = true;
      groupNameElement.classList.add('editing');
      groupNameElement.focus();
      document.execCommand('selectAll', false, null);

      const onInput = () => {
        let currentText = groupNameElement.textContent;
        if (currentText.length > MAX_GROUP_NAME_LENGTH) {
          const selection = window.getSelection();
          const range = selection.getRangeAt(0);
          const cursorPosition = range.startOffset;
          
          groupNameElement.textContent = currentText.substring(0, MAX_GROUP_NAME_LENGTH);
          
          const newRange = document.createRange();
          const textNode = groupNameElement.firstChild;
          if (textNode) {
            const newPosition = Math.min(cursorPosition, MAX_GROUP_NAME_LENGTH);
            newRange.setStart(textNode, newPosition);
            newRange.setEnd(textNode, newPosition);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      };

      const finishEditing = (save) => {
        groupNameElement.contentEditable = false;
        groupNameElement.classList.remove('editing');
        let newName = groupNameElement.textContent.trim();
        if (newName.length > MAX_GROUP_NAME_LENGTH) {
          showConfirmModal('Слишком длинное название', `Максимальная длина — ${MAX_GROUP_NAME_LENGTH} символов.`, false);
          groupNameElement.textContent = originalName;
          return;
        }
        if (save && newName && newName !== originalName) {
          socket.send(JSON.stringify({
          event: 'updateGroupName',
          data: { name: newName }
        }));
        } else {
          groupNameElement.textContent = originalName;
        }
        groupNameElement.removeEventListener('blur', onBlur);
        groupNameElement.removeEventListener('keydown', onKeydown);
        groupNameElement.removeEventListener('input', onInput);
      };

      const onBlur = () => finishEditing(true);
      const onKeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishEditing(true);
        } else if (e.key === 'Escape') {
          finishEditing(false);
        }
      };

      groupNameElement.addEventListener('blur', onBlur);
      groupNameElement.addEventListener('keydown', onKeydown);
      groupNameElement.addEventListener('input', onInput);
    });
    
    document.getElementById('current-user-avatar').addEventListener('click', showAvatarSelector);
    
  } catch (error) {
    showConfirmModal("Ошибка инициализации", "Произошла ошибка при инициализации чата", false);
  }
}

function setupChatEvents() {
  
  const currentUserAvatar = document.getElementById('current-user-avatar');
  if (currentUserAvatar) {
    currentUserAvatar.style.cursor = 'pointer';
    currentUserAvatar.title = 'Нажмите, чтобы изменить аватарку';
    
    currentUserAvatar.addEventListener('click', showAvatarSelector);
  }
  
  const messagesContainer = document.querySelector('.messagesContainer');
  if (messagesContainer) {
    let scrollTimeout;
    messagesContainer.addEventListener('scroll', () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      if (messagesContainer.scrollTop <= 200 && hasMoreMessages && !isLoadingMessages) {
        scrollTimeout = setTimeout(() => {
          loadMoreMessages();
        }, 100);
      }
    });
  }
  
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('focus', () => {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
      
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer) {
        messagesContainer.style.overflowY = 'auto';
        messagesContainer.style.webkitOverflowScrolling = 'touch';
      }
    });
    
    messageInput.addEventListener('blur', () => {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
    });
    
    messageInput.addEventListener('input', () => {
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer) {
        messagesContainer.style.pointerEvents = 'auto';
        messagesContainer.style.touchAction = 'pan-y';
        messagesContainer.style.overflowY = 'auto';
      }
    });
    
    messageInput.addEventListener('focus', () => {
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer) {
        messagesContainer.style.pointerEvents = 'auto';
        messagesContainer.style.touchAction = 'pan-y';
        messagesContainer.style.overflowY = 'auto';
      }
    });
  }
  
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    document.addEventListener('touchstart', (e) => {
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer && (e.target === messagesContainer || messagesContainer.contains(e.target))) {
        e.stopPropagation();
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer && (e.target === messagesContainer || messagesContainer.contains(e.target))) {
        e.stopPropagation();
      }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer && (e.target === messagesContainer || messagesContainer.contains(e.target))) {
        e.stopPropagation();
      }
    }, { passive: true });
  }
}

function updateTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  const replyIndicator = document.querySelector('.replyIndicator');
  const inputArea = document.querySelector('.inputArea');

  if (typingIndicator && inputArea && inputArea.parentNode) {
    if (typingIndicator.nextSibling !== inputArea) {
      inputArea.parentNode.insertBefore(typingIndicator, inputArea);
    }
  }

  if (replyIndicator && inputArea && inputArea.parentNode) {
    if (replyIndicator.nextSibling !== typingIndicator) {
      inputArea.parentNode.insertBefore(replyIndicator, typingIndicator);
    }
  }

  let typingUserIds = Array.from(typingUsers);
  typingUserIds = typingUserIds.filter(userId => userId !== currentUser.id);
  const typingUserNames = typingUserIds
    .map(userId => {
      const userElement = document.getElementById(`user-${userId}`);
      if (userElement) {
        return userElement.querySelector('.userName').textContent;
      }
      return null;
    })
    .filter(name => name !== null);

  if (typingUserNames.length === 0) {
    typingIndicator.textContent = '';
    typingIndicator.style.display = 'none';
    if (typingIndicator.classList.contains('active')) {
      typingIndicator.classList.add('inactive');
      typingIndicator.classList.remove('active');
      setTimeout(() => {
        typingIndicator.classList.remove('inactive');
        updateReplyIndicatorMargin();
      }, 500);
    } else {
      updateReplyIndicatorMargin();
    }
    return;
  }

  typingIndicator.style.display = 'flex';

  if (typingUserNames.length === 1) {
    typingIndicator.textContent = `${typingUserNames[0]} печатает...`;
  } else if (typingUserNames.length === 2) {
    typingIndicator.textContent = `${typingUserNames[0]} и ${typingUserNames[1]} печатают...`;
  } else if (typingUserNames.length > 2) {
    typingIndicator.textContent = `${typingUserNames.length} пользователей печатают...`;
  } else {
    typingIndicator.textContent = '';
  }
  if (typingIndicator.textContent && !typingIndicator.classList.contains('active')) {
    typingIndicator.classList.remove('inactive');
    typingIndicator.classList.add('active');
  }
  updateReplyIndicatorMargin();
}

function showConnectionInfo() {
}

function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username-input');
  
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const tunnelUrl = document.getElementById('tunnel-url').value.trim();
    
    if (!username) {
      showConfirmModal("Поле не заполнено", "Пожалуйста, введите ваше имя", false);
      return;
    }
    
    if (username.length < 3 || username.length > 20) {
      showConfirmModal("Некорректное имя", "Имя должно содержать от 3 до 20 символов", false);
      return;
    }
    
    if (!tunnelUrl) {
      showConfirmModal("Поле не заполнено", "Пожалуйста, введите URL сервера", false);
      return;
    }
    
    const isAdmin = ADMIN_USERNAMES.map(name => name.toLowerCase()).includes(username.toLowerCase());
    const isModerator = ['kirymeww'].includes(username.toLowerCase());

    if (isAdmin) {
      showAdminConfirmModal(() => {
        completeLogin(username, tunnelUrl, true);
      });
    } else if (isModerator) {
      showModeratorConfirmModal(() => {
        completeLogin(username, tunnelUrl, false, true);
      });
    } else {
      completeLogin(username, tunnelUrl, false);
    }
  });
}

function completeLogin(username, serverUrl, isAdmin = false, isModerator = false) {
  let formattedUrl = serverUrl.trim();
  
  if (!formattedUrl || formattedUrl.trim() === '') {
    formattedUrl = window.location.host;
  }
  
  if (!formattedUrl.match(/^(https?:\/\/)?([a-zA-Z0-9-]+\.?[a-zA-Z0-9-]*)+(:[0-9]+)?(\/.*)?$/)) {
    showConfirmModal(
      "Некорректный URL", 
      "Введенный URL имеет некорректный формат. Пример правильного формата: localhost:8000 или example.com", 
      false
    );
    return;
  }
  
  const mainSocket = initializeSocket(formattedUrl);
  
  if (mainSocket) {
    showConfirmModal(
      `Подтвердите подключение к серверу`,
      `Вы хотите подключиться к серверу как ${username}?`,
      true,
      () => {
        let userId = null;
        joinChat(mainSocket, username, userId, isAdmin, isModerator);
      }
    );
  } else {
    showConfirmModal(
      "Ошибка подключения", 
      "Не удалось создать соединение с сервером. Проверьте URL и убедитесь, что сервер запущен.", 
      false
    );
  }
}

function joinChat(socket, username, userId, isAdmin = false, isModerator = false) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  
  const userData = {
    username: username,
    isAdmin: isAdmin,
    isModerator: isModerator
  };
  
  if (userId) {
    userData.id = userId;
  }
  
  socket.send(JSON.stringify({
    event: 'join',
    data: userData
  }));
  
  setTimeout(() => {
    if (document.getElementById('login-form').style.display !== 'none') {
      showConfirmModal(
        "Проблема с подключением", 
        "Не удалось войти в чат. Проверьте URL сервера и попробуйте снова.", 
        false
      );
    }
  }, 5000);
}

function initializeSocket(serverUrl, isTemp = false) {
  try {
    if (!serverUrl || serverUrl.trim() === '') {
      if (!isTemp) {
        showConfirmModal("Ошибка подключения", "Не указан URL сервера", false);
      }
      return null;
    }
    
    let wsUrl = serverUrl.trim();
    
    if (wsUrl.endsWith('/')) {
      wsUrl = wsUrl.slice(0, -1);
    }
    
    if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else {
      wsUrl = `ws://${wsUrl}`;
    }
    
    wsUrl += '/ws';
    
    if (socket && !isTemp) {
      socket.close();
    }
    
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      connectionAttempts = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    
    newSocket.onerror = (error) => {
      if (!isTemp && document.getElementById('chat-container') && 
          document.getElementById('chat-container').style.display === 'flex') {
        showConfirmModal(
          "Ошибка соединения", 
          "Произошла ошибка соединения с сервером. Сервер может быть недоступен.", 
          false,
          () => {
            window.location.reload();
          }
        );
      }
    };
    
    newSocket.onclose = (event) => {
      if (!isTemp && document.getElementById('chat-container') && 
          document.getElementById('chat-container').style.display === 'flex') {
        showConfirmModal(
          "Сервер закрыт", 
          "Соединение с сервером потеряно. Сервер был закрыт или недоступен.", 
          false,
          () => { 
            window.location.reload();
          }
        );
        return;
      }
      
      if (!event.wasClean && connectionAttempts < MAX_RETRY_ATTEMPTS) {
        connectionAttempts++;
        reconnectTimer = setTimeout(() => {
          initializeSocket(serverUrl, isTemp);
        }, 2000);
      } else if (connectionAttempts >= MAX_RETRY_ATTEMPTS && !isTemp) {
        showConfirmModal(
          "Ошибка подключения", 
          `Не удалось подключиться к серверу по адресу ${serverUrl}. Проверьте URL и убедитесь, что сервер запущен.`, 
          false
        );
      }
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
      }
    };
    
    if (!isTemp) {
      socket = newSocket;
      setupChatEvents();
    }
    
    return newSocket;
  } catch (error) {
    if (!isTemp) {
      showConfirmModal("Ошибка инициализации", "Произошла ошибка при инициализации соединения", false);
    }
    return null;
  }
}

function handleWebSocketMessage(data) {
  const event = data.event;
  
  switch (event) {
    case 'welcome':
      handleWelcome(data);
      break;
    case 'userJoined':
      handleUserJoined(data.user);
      break;
    case 'userLeft':
      handleUserLeft(data.user);
      break;
    case 'message':
      handleNewMessage(data.message);
      break;
    case 'messageEdited':
      handleMessageEdited(data.message);
      break;
    case 'messageDeleted':
      handleMessageDeleted(data.id);
      break;
    case 'userTyping':
      handleUserTyping(data.user);
      break;
    case 'userStoppedTyping':
      handleUserStoppedTyping(data.user);
      break;
    case 'avatarChanged':
      handleAvatarChanged(data);
      break;
    case 'groupNameUpdated':
      handleGroupNameUpdated(data.name);
      break;
    case 'avatarCategories':
      handleAvatarCategories(data.categories);
      break;
    case 'usernameTaken':
      handleUsernameTaken(data.message);
      break;
    case 'messagesLoaded':
      handleMessagesLoaded(data);
      break;
    default:
  }
}

function handleWelcome(data) {
  currentPage = 0;
  hasMoreMessages = data.hasMoreMessages || false;
  
  initChat(data);
}

function handleUserJoined(user) {
  addUserToList(user);
  createUserActivityToast(`${user.username} присоединился к чату`, user.avatar);
}

function handleUserLeft(user) {
  removeUser(user.id);
  createUserActivityToast(`${user.username} покинул чат`, user.avatar);
}

function handleNewMessage(message) {
  const isMyMessage = message.user.id === currentUser.id;
  const messageElement = createMessageElement(message, isMyMessage);
  
  const messageContainer = document.querySelector('.messagesContainer');
  
  if (messageContainer) {
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight; 
  }
}

function handleMessageEdited(message) {
  updateMessageText(message.id, message.text, true);
}

function handleMessageDeleted(messageId) {
  removeMessage(messageId);
}

function handleUserTyping(user) {
  if (user.id !== currentUser.id) {
    typingUsers.add(user.id);
    updateTypingIndicator();
  }
}

function handleUserStoppedTyping(user) {
  typingUsers.delete(user.id);
  updateTypingIndicator();
}

function handleMessagesLoaded(data) {
  isLoadingMessages = false;
  hasMoreMessages = data.hasMore;
  
  const loadingIndicator = document.querySelector('.loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
  
  const messagesContainer = document.querySelector('.messagesContainer');
  if (messagesContainer && data.messages.length > 0) {
    const fragment = document.createDocumentFragment();
    
    data.messages.forEach(message => {
      const isMyMessage = message.user.id === currentUser.id;
      const messageElement = createMessageElement(message, isMyMessage, false);
      fragment.appendChild(messageElement);
    });
    
    messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
    
    if (window.lastScrollHeight) {
      const newScrollHeight = messagesContainer.scrollHeight;
      const scrollDiff = newScrollHeight - window.lastScrollHeight;
      messagesContainer.scrollTop = scrollDiff;
      window.lastScrollHeight = null;
    }
  }
}

function handleAvatarChanged(data) {
  const userElement = document.querySelector(`#user-${data.userId}`);
  if (userElement) {
    const avatarImg = userElement.querySelector('.userAvatar');
    if (avatarImg) {
      avatarImg.src = `public/${data.newAvatar}`;
    }
  }
  
  const messagesById = document.querySelectorAll(`[data-user-id="${data.userId}"]`);
  const messagesByName = document.querySelectorAll(`[data-username="${data.username}"]`);
  const allMessages = new Set([...messagesById, ...messagesByName]);
  
  allMessages.forEach((messageElement, index) => {
    const avatarImg = messageElement.querySelector('.userAvatar');
    if (avatarImg) {
      avatarImg.src = `public/${data.newAvatar}`;
    }
  });
  
  if (data.userId === currentUser.id) {
    currentUser.avatar = data.newAvatar;
    const currentUserAvatar = document.getElementById('current-user-avatar');
    if (currentUserAvatar) {
      currentUserAvatar.src = `public/${data.newAvatar}`;
    }
  }
}

function handleGroupNameUpdated(name) {
  updateGroupName(name);
}

function handleAvatarCategories(categories) {
  const animals = categories['Animals'] || [];
  const modal = document.querySelector('.avatar-selector-modal');
  if (modal) {
    const avatarContainer = modal.querySelector('div');
    if (avatarContainer) {
      renderAvatars(animals, avatarContainer, 1, animals, null, modal, modal.querySelector('div:last-child'));
    }
  }
}

function handleUsernameTaken(message) {
  showConfirmModal("Ошибка", message, false);
}



function updateGroupName(name) {
  const groupNameElement = document.getElementById('group-name');
  if (groupNameElement) {
    groupNameElement.textContent = name;
  }
}

function loadMoreMessages() {
  if (isLoadingMessages || !hasMoreMessages || !socket) {
    return;
  }

  isLoadingMessages = true;
  currentPage++;
  
  const messagesContainer = document.querySelector('.messagesContainer');
  const scrollHeight = messagesContainer ? messagesContainer.scrollHeight : 0;
  
  if (messagesContainer) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = 'Загрузка сообщений...';
    loadingIndicator.style.cssText = `
      text-align: center;
      padding: 20px;
      color: var(--text-secondary);
      font-size: 14px;
    `;
    messagesContainer.insertBefore(loadingIndicator, messagesContainer.firstChild);
  }
  
  socket.send(JSON.stringify({
    event: 'getMessages',
    data: {
      page: currentPage,
      limit: 20
    }
  }));
  
  window.lastScrollHeight = scrollHeight;
}



function checkNetworkStatus() {
  return navigator.onLine;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkNetworkStatus()) {
    showConfirmModal(
      "Нет подключения к интернету", 
      "Проверьте ваше интернет-соединение и перезагрузите страницу.", 
      false
    );
  }
  
  window.addEventListener('online', () => {
    createNotificationToast('Соединение с интернетом восстановлено');
    
    if (socket) {
      socket.connect();
    }
  });
  
  window.addEventListener('offline', () => {
    createNotificationToast('Соединение с интернетом потеряно');
    
    if (document.getElementById('chat-container') && 
        document.getElementById('chat-container').style.display === 'flex') {
      showConfirmModal(
        "Нет подключения к интернету", 
        "Проверьте ваше интернет-соединение для продолжения работы чата.", 
        false,
        () => {
          window.location.reload();
        }
      );
    } else {
      showConfirmModal(
        "Нет подключения к интернету", 
        "Проверьте ваше интернет-соединение для продолжения работы чата.", 
        false,
        () => {
          window.location.reload();
        }
      );
    }
  });
  
  setupLoginForm();
  
  document.addEventListener('click', function(e) {
    if (activeMessageMenu && !e.target.closest('.message-context-menu') && !e.target.closest('.message-actions')) {
      closeMessageMenu();
    }
  });
});

function updateUserAvatar(newAvatarSrc) {
  if (!socket || !currentUser.username) {
    return;
  }
  
  const avatarPathForServer = newAvatarSrc.replace('public/', '');
  socket.send(JSON.stringify({
    event: 'updateAvatar',
    data: {
      avatar: avatarPathForServer
    }
  }));
}

function getPaginationPages(current, total) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let l;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l > 2) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }
  return rangeWithDots;
}

function renderAvatars(avatars, avatarContainer, currentPage, currentAvatars, pagination, modal, buttonsContainer) {
  currentAvatars = avatars;
  avatarContainer.innerHTML = '';
  if (avatars && avatars.length <= 4) {
    avatarContainer.style.maxWidth = 'none';
    avatarContainer.style.gap = '4px';
  } else {
    avatarContainer.style.maxWidth = '320px';
    avatarContainer.style.gap = '10px';
  }
  if (!avatars || avatars.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'Нет доступных аватарок';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = 'var(--text-color)';
    emptyMsg.style.margin = '32px 0 24px 0';
    avatarContainer.appendChild(emptyMsg);
    if (pagination) {
      pagination.remove();
      pagination = null;
    }
    return;
  }
  const totalPages = Math.ceil(avatars.length / 28);
  let nonEmptyPages = [];
  for (let i = 1; i <= totalPages; i++) {
    const pageStart = (i - 1) * 28;
    const pageEnd = pageStart + 28;
    if (avatars.slice(pageStart, pageEnd).length > 0) {
      nonEmptyPages.push(i);
    }
  }
  if (nonEmptyPages.length === 0) nonEmptyPages = [1];
  if (!nonEmptyPages.includes(currentPage)) currentPage = nonEmptyPages[0] || 1;
  const startIdx = (currentPage - 1) * 28;
  const endIdx = startIdx + 28;
  const pageAvatars = avatars.slice(startIdx, endIdx);
  
  const saveButton = modal.querySelector('.button.primary');
  
  pageAvatars.forEach((avatarSrc, idx) => {
    if (pageAvatars.length > 8 && idx === 4) {
      const separator = document.createElement('div');
      separator.className = 'avatars-separator';
      avatarContainer.appendChild(separator);
    }
    const avatarOption = document.createElement('img');
    avatarOption.src = 'public/' + avatarSrc;
    avatarOption.className = 'avatarOption';
    avatarOption.style.width = '50px';
    avatarOption.style.height = '50px';
    avatarOption.style.borderRadius = '50%';
    avatarOption.style.cursor = 'pointer';
    avatarOption.style.border = '2px solid transparent';
    avatarOption.style.transition = 'all 0.2s ease';
    avatarOption.style.objectFit = 'cover';
    let userAvatarRelative = currentUser.avatar.replace(/^public\//, '').replace(/^\//, '');
    let avatarSrcRelative = avatarSrc.replace(/^public\//, '').replace(/^\//, '');
    if (userAvatarRelative === avatarSrcRelative) {
      avatarOption.classList.add('selectedAvatar');
      avatarOption.style.borderColor = 'var(--accent-color)';
      avatarOption.style.boxShadow = '0 0 0 4px rgba(var(--accent-color-rgb), 0.7)';
      if (saveButton) {
        saveButton.dataset.selectedAvatar = avatarSrc;
      }
    }
    avatarOption.addEventListener('click', function() {
      avatarContainer.querySelectorAll('.avatarOption').forEach(avatar => {
        avatar.classList.remove('selectedAvatar');
        avatar.style.borderColor = 'transparent';
        avatar.style.boxShadow = 'none';
      });
      this.classList.add('selectedAvatar');
      this.style.borderColor = 'var(--accent-color)';
      this.style.boxShadow = '0 0 0 4px rgba(var(--accent-color-rgb), 0.7)';
      if (saveButton) {
        saveButton.dataset.selectedAvatar = avatarSrc;
      }
    });
    avatarOption.addEventListener('mouseenter', function() {
      if (!this.classList.contains('selectedAvatar')) {
        this.style.transform = 'scale(1.1)';
        this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      }
    });
    avatarOption.addEventListener('mouseleave', function() {
      if (!this.classList.contains('selectedAvatar')) {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'none';
      }
    });
    avatarContainer.appendChild(avatarOption);
  });
  if (nonEmptyPages.length >= 1) {
    if (pagination) {
      pagination.remove();
      pagination = null;
    }
    pagination = document.createElement('div');
    pagination.style.display = 'flex';
    pagination.style.justifyContent = 'center';
    pagination.style.alignItems = 'center';
    pagination.style.gap = '4px';
    pagination.style.marginTop = '8px';
    pagination.style.marginBottom = '18px';
    const pagesToShow = getPaginationPages(currentPage, nonEmptyPages.length);
    pagesToShow.forEach(p => {
      if (p === '...') {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 10px';
        dots.style.fontSize = '18px';
        dots.style.color = 'var(--text-color)';
        pagination.appendChild(dots);
      } else {
        const realPage = nonEmptyPages[p - 1] || 1;
        const pageBtn = document.createElement('button');
        pageBtn.className = 'avatar-page-tab';
        if (realPage === currentPage) pageBtn.classList.add('primary');
        pageBtn.textContent = realPage;
        pageBtn.type = 'button';
        pageBtn.style.minWidth = '36px';
        pageBtn.style.padding = '6px 12px';
        pageBtn.style.margin = '0 2px';
        pageBtn.addEventListener('click', () => {
          currentPage = realPage;
          renderAvatars(currentAvatars, avatarContainer, currentPage, currentAvatars, pagination, modal, buttonsContainer);
        });
        pagination.appendChild(pageBtn);
      }
    });
    modal.insertBefore(pagination, buttonsContainer);
  } else if (pagination) {
    pagination.remove();
    pagination = null;
  }
}

function showAvatarSelector() {
  
  const modal = document.createElement('div');
  modal.className = 'avatar-selector-modal';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = 'var(--card-background)';
  modal.style.borderRadius = '16px';
  modal.style.padding = '20px';
  modal.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.5)';
  modal.style.zIndex = '1000';
  modal.style.maxWidth = '90%';
  modal.style.width = '500px';
  modal.style.border = '1px solid var(--border-color)';
  
  const title = document.createElement('h3');
  title.textContent = 'Выберите новую аватарку';
  title.style.textAlign = 'center';
  title.style.marginTop = '0';
  title.style.marginBottom = '20px';
  title.style.color = 'var(--text-color)';
  modal.appendChild(title);
  
  const avatarContainer = document.createElement('div');
  avatarContainer.style.display = 'flex';
  avatarContainer.style.flexWrap = 'wrap';
  avatarContainer.style.justifyContent = 'center';
  avatarContainer.style.maxWidth = '320px';
  avatarContainer.style.margin = '0 auto';
  avatarContainer.style.gap = '10px';
  avatarContainer.style.marginBottom = '20px';
  avatarContainer.style.minHeight = '200px';
  modal.appendChild(avatarContainer);
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.justifyContent = 'center';
  buttonsContainer.style.gap = '10px';
  modal.appendChild(buttonsContainer);
  
  let selectedAvatarSrc = null;
  if (socket) {
    socket.send(JSON.stringify({
      event: 'getAvatarCategories'
    }));
  }
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Отмена';
  cancelButton.className = 'button';
  cancelButton.style.padding = '10px 20px';
  cancelButton.style.borderRadius = '8px';
  cancelButton.style.border = '1px solid var(--border-color)';
  cancelButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  cancelButton.style.color = 'var(--text-color)';
  cancelButton.style.cursor = 'pointer';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  buttonsContainer.appendChild(cancelButton);
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Сохранить';
  saveButton.className = 'button primary';
  saveButton.style.padding = '10px 20px';
  saveButton.style.borderRadius = '8px';
  saveButton.style.border = 'none';
  saveButton.style.background = 'var(--button-gradient)';
  saveButton.style.color = 'white';
  saveButton.style.cursor = 'pointer';
  saveButton.addEventListener('click', function() {
    const selectedAvatar = this.dataset.selectedAvatar;
    if (selectedAvatar) {
      updateUserAvatar('public/' + selectedAvatar);
    }
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  buttonsContainer.appendChild(saveButton);
  
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.zIndex = '999';
  overlay.addEventListener('click', function() {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  
  modal.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

function startReplyToMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  const messageSenderElement = messageWrapper.querySelector('.messageSender');
  if (!messageTextElement || !messageSenderElement) return;
  
  const replyText = messageTextElement.textContent;
  const replyUsername = messageSenderElement.textContent || currentUser.username;
  
  replyingToMessageId = messageId;
  
  const messageInput = document.getElementById('message-input');
  const currentInputText = messageInput.value;
  
  const previousState = {
    text: currentInputText,
    placeholder: messageInput.placeholder
  };
  
  messageInput.placeholder = `Ответить на сообщение от ${replyUsername}...`;
  messageInput.focus();
  
  showReplyIndicator(messageId, replyText, replyUsername);
  
  const cancelReplyHandler = function(e) {
    if (e.key === 'Escape') {
      cancelReply();
      document.removeEventListener('keydown', cancelReplyHandler);
    }
  };
  document.addEventListener('keydown', cancelReplyHandler);
}

function showReplyIndicator(messageId, replyText, replyUsername) {
  hideReplyIndicator();
  let replyIndicator = document.createElement('div');
  replyIndicator.className = 'replyIndicator';
  replyIndicator.innerHTML = `
    <div class="replyIndicatorContent">
      <div class="replyIndicatorText">
        <span class="replyIndicatorAuthor">${replyUsername}</span>
        <span class="replyIndicatorMessage">${replyText}</span>
      </div>
      <button class="replyIndicatorCancel" onclick="cancelReply()">✕</button>
    </div>
  `;
  const inputArea = document.querySelector('.inputArea');
  const typingIndicator = document.getElementById('typing-indicator');
  if (inputArea && inputArea.parentNode) {
    inputArea.parentNode.insertBefore(replyIndicator, typingIndicator);
  }
  updateReplyIndicatorMargin();
}

function hideReplyIndicator() {
  const existingIndicator = document.querySelector('.replyIndicator');
  if (existingIndicator) existingIndicator.remove();
}

function updateReplyIndicatorMargin() {
  const replyIndicator = document.querySelector('.replyIndicator');
  const typingIndicator = document.getElementById('typing-indicator');
  if (replyIndicator) {
    if (typingIndicator && typingIndicator.classList.contains('active') && typingIndicator.textContent) {
      replyIndicator.style.marginBottom = '32px';
    } else {
      replyIndicator.style.marginBottom = '8px';
    }
  }
}

function cancelReply() {
  replyingToMessageId = null;
  hideReplyIndicator();
  
  const messageInput = document.getElementById('message-input');
  messageInput.placeholder = 'Введите сообщение...';
}

function scrollToMessage(messageId) {
  const messageElement = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const contentElement = messageElement.querySelector('.messageContent');
    if (contentElement) {
      contentElement.classList.add('highlighted');
      setTimeout(() => {
        contentElement.classList.remove('highlighted');
      }, 2000);
    }
  }
}