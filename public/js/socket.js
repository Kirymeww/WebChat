// ======== Переменные для файлов ========

let socket = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
let reconnectTimer = null;

let attachedFiles = [];
const ALLOWED_FILE_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 
  'image/webp', 'image/bmp', 'image/tiff', 'video/mp4'
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; 

let currentPage = 0;
let hasMoreMessages = false;
let isLoadingMessages = false;

let messageStore = new Map();

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

const MAX_GROUP_NAME_LENGTH = 16;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_TEXT_LENGTH = 100;  

// ======== Добавить значок администратора ========
function addAdminBadge(parentElement) { 
  const adminBadge = document.createElement('img');
  adminBadge.src = 'public/Images/verified.png';
  adminBadge.className = 'admin-badge';
  parentElement.appendChild(adminBadge);

  adminBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Администратор'));
  adminBadge.addEventListener('mouseleave', hideCustomTooltip);
}

// ======== Добавить значок модератора ========
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

// ======== Добавить значок премиум пользователя ========
function addPremiumBadge(parentElement) {
  const premiumBadge = document.createElement('img');
  premiumBadge.src = 'public/Images/premium.png';
  premiumBadge.className = 'premium-badge';
  premiumBadge.style.width = '16px';
  premiumBadge.style.height = '16px';
  premiumBadge.style.marginLeft = '6px';
  premiumBadge.style.verticalAlign = 'text-bottom';
  parentElement.appendChild(premiumBadge);

  premiumBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Премиум-пользователь'));
  premiumBadge.addEventListener('mouseleave', hideCustomTooltip);
}

// ======== Создать элемент сообщения ========
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
  
  const messageText = document.createElement('div');
  messageText.className = 'messageText';
  
  let filesContainer;
  if (message.files && message.files.length > 0) {
    filesContainer = document.createElement('div');
    filesContainer.className = 'messageFiles';
    filesContainer.style.cssText = `
      margin-bottom: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
    messageContent.appendChild(filesContainer);
  }

  if (message.replyTo && document.querySelector(`.messageWrapper[data-message-id="${message.replyTo.id}"]`)) {
    const replyBlock = document.createElement('div');
    replyBlock.className = 'messageReply';
    replyBlock.setAttribute('data-reply-to', message.replyTo.id);
    const replyAuthor = document.createElement('div');
    replyAuthor.className = 'replyAuthor';
    replyAuthor.textContent = message.replyTo.username;
    
    const replyToMessage = document.querySelector(`.messageWrapper[data-message-id="${message.replyTo.id}"]`);
    const replyToFiles = replyToMessage ? replyToMessage.querySelectorAll('.messageFile img, .messageFile video') : [];
    
    const hasFiles = message.replyTo.files && message.replyTo.files.length > 0;
    
    if (replyToFiles.length > 0 || hasFiles) {
      let firstFile = null;
      let fileType = 'image';
      
      if (replyToFiles.length > 0) {
        firstFile = replyToFiles[0];
        fileType = firstFile.tagName.toLowerCase();
      } else if (hasFiles) {
        const replyFile = message.replyTo.files[0];
        fileType = replyFile.type && replyFile.type.startsWith('video/') ? 'video' : 'image';
      }
      
      const mediaPreview = document.createElement(fileType === 'video' ? 'video' : 'img');
      
      if (replyToFiles.length > 0) {
        mediaPreview.src = firstFile.src;
      } else if (hasFiles) {
        const replyFile = message.replyTo.files[0];
        mediaPreview.src = `public/${replyFile.path || replyFile.name}`;
      }
      
      mediaPreview.style.cssText = `
        width: 24px;
        height: 24px;
        object-fit: cover;
        border-radius: 3px;
        margin-right: 6px;
        flex-shrink: 0;
      `;
      
      mediaPreview.addEventListener('error', function() {
        this.style.display = 'none';
      });
      
      if (fileType === 'video') {
        mediaPreview.muted = true;
        mediaPreview.loop = true;
        mediaPreview.playsInline = true;
      }
      
      const replyContent = document.createElement('div');
      replyContent.style.cssText = `
        display: flex;
        align-items: center;
        flex: 1;
      `;
      
      const replyText = document.createElement('div');
      replyText.className = 'replyText';
      
      if (message.replyTo.text && message.replyTo.text.trim() !== '') {
        let replyPreview = message.replyTo.text;
        if (replyPreview.length > MAX_REPLY_TEXT_LENGTH) {
          replyPreview = replyPreview.slice(0, MAX_REPLY_TEXT_LENGTH) + '...';
        }
        replyText.textContent = replyPreview;
      } else {
        replyText.textContent = fileType === 'video' ? 'Видео' : 'Фото';
        replyText.style.cssText = `
          font-style: italic;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
          opacity: 1;
        `;
      }
      
      replyContent.appendChild(mediaPreview);
      replyContent.appendChild(replyText);
      replyBlock.appendChild(replyAuthor);
      replyBlock.appendChild(replyContent);

    } else if (message.replyTo.text && message.replyTo.text.trim() !== '') {
      const replyText = document.createElement('div');
      replyText.className = 'replyText';
      let replyPreview = message.replyTo.text;
      if (replyPreview.length > MAX_REPLY_TEXT_LENGTH) {
        replyPreview = replyPreview.slice(0, MAX_REPLY_TEXT_LENGTH) + '...';
      }
      replyText.textContent = replyPreview;
      replyBlock.appendChild(replyAuthor);
      replyBlock.appendChild(replyText);
    }
    
    replyBlock.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      scrollToMessage(message.replyTo.id);
    });
    
    replyBlock.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });
    
    replyBlock.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      scrollToMessage(message.replyTo.id);
    }, { passive: false });
    messageContent.appendChild(replyBlock);
  }
  
  messageText.textContent = message.text;
  messageContent.appendChild(messageText);
  
  if (message.files && message.files.length > 0) {
    
    message.files.forEach((file, index) => {
      const fileElement = document.createElement('div');
      fileElement.className = 'messageFile';
      fileElement.style.cssText = `
        display: flex;
        align-items: center;
        padding: 2px 6px;
        background: rgba(0, 0, 0, 0.15);
        border-left: 2px solid var(--accent-color);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 13px;
      `;
      
      if (isMyMessage) {
        fileElement.style.background = 'rgba(255, 255, 255, 0.2)';
        fileElement.style.borderLeftColor = '#fff';
      }
      
      fileElement.addEventListener('mouseover', () => {
        fileElement.style.background = isMyMessage ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
      });
      
      fileElement.addEventListener('mouseout', () => {
        fileElement.style.background = isMyMessage ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
      });
      
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const mediaPreview = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
        mediaPreview.style.cssText = `
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
          margin-right: 8px;
          flex-shrink: 0;
        `;
        if (!file.type.startsWith('video/')) {
          mediaPreview.loading = 'lazy';
          mediaPreview.decoding = 'async';
        }
        
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
          margin-right: 8px;
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
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      
      const fileSize = document.createElement('div');
      fileSize.textContent = formatFileSize(file.size);
      fileSize.style.cssText = `
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 1px;
      `;
      
      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileSize);
      
      fileElement.appendChild(fileInfo);
      
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
  
  const openContextMenu = function(e) {
    if (e.target.tagName.toLowerCase() === 'img' || e.target.tagName.toLowerCase() === 'video') {
      return;
    }
    
    if (e.target.closest('.messageFile')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    if (editingMessageId === message.id) {
      return;
    }

    const touchPoint = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    let menuX = 0;
    let menuY = 0;

    if (touchPoint) {
      menuX = touchPoint.clientX;
      menuY = touchPoint.clientY;
    } else if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      menuX = e.clientX;
      menuY = e.clientY;
    } else {
      const rect = messageContent.getBoundingClientRect();
      menuX = rect.left + rect.width / 2;
      menuY = rect.top + rect.height / 2;
    }

    showMessageMenu(message.id, menuX, menuY);
  };

  const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  if (isMobileDevice) {
    let touchStartTime = 0;
    let touchStartY = 0;
    
    messageContent.addEventListener('touchstart', function(e) {
      touchStartTime = Date.now();
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    messageContent.addEventListener('touchend', function(e) {
      const touchEndTime = Date.now();
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = touchEndTime - touchStartTime;
      const touchDistance = Math.abs(touchEndY - touchStartY);
      
      if (touchDuration < 300 && touchDistance < 10) {
        openContextMenu(e);
      }
    }, { passive: false });
    
    messageContent.addEventListener('click', openContextMenu, { passive: false });
  } else {
    messageContent.addEventListener('contextmenu', openContextMenu);
  }
  
  return messageWrapper;
}

// ======== Показать меню сообщения ========
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

// ======== Закрыть меню сообщения ========
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

// ======== Начать редактирование сообщения ========
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

// ======== Подтвердить удаление сообщения ========
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

// ======== Обновить текст сообщения ========
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

// ======== Обновить цитаты ответов после редактирования исходного сообщения ========
function updateReplyBlocksAfterEdit(editedMessageId) {
  const replyBlocks = document.querySelectorAll(`.messageReply[data-reply-to="${editedMessageId}"]`);
  const sourceMessage = document.querySelector(`.messageWrapper[data-message-id="${editedMessageId}"]`);
  if (!sourceMessage) return;

  const sourceText = (sourceMessage.querySelector('.messageText') || {}).textContent || '';
  const sourceMedia = sourceMessage.querySelectorAll('.messageFile img, .messageFile video');

  replyBlocks.forEach(replyBlock => {
    const authorEl = replyBlock.querySelector('.replyAuthor');
    const sourceSender = sourceMessage.querySelector('.messageSender');
    if (authorEl && sourceSender) {
      authorEl.textContent = sourceSender.textContent || authorEl.textContent;
    }

    const replyTextEl = replyBlock.querySelector('.replyText');
    if (!replyTextEl) return;

    let preview = (sourceText || '').trim();
    if (preview.length > 0) {
      if (preview.length > MAX_REPLY_TEXT_LENGTH) {
        preview = preview.slice(0, MAX_REPLY_TEXT_LENGTH) + '...';
      }
      replyTextEl.textContent = preview;
      replyTextEl.style.cssText = '';
      return;
    }

    if (sourceMedia && sourceMedia.length > 0) {
      const firstFile = sourceMedia[0];

      let mediaPreview = replyBlock.querySelector('img, video');
      if (!mediaPreview) {
        mediaPreview = document.createElement(firstFile.tagName.toLowerCase());
        mediaPreview.style.cssText = `
          width: 24px;
          height: 24px;
          object-fit: cover;
          border-radius: 3px;
          margin-right: 6px;
          flex-shrink: 0;
          border: 1px solid var(--border-color);
        `;
        const container = replyTextEl.parentElement;
        if (container) {
          container.insertBefore(mediaPreview, container.firstChild);
        }
      }
      mediaPreview.src = firstFile.src;
      if (mediaPreview.tagName.toLowerCase() === 'video') {
        mediaPreview.muted = true;
        mediaPreview.loop = true;
        mediaPreview.playsInline = true;
      }

      replyTextEl.textContent = firstFile.tagName.toLowerCase() === 'video' ? 'Видео' : 'Фото';
      replyTextEl.style.cssText = `
        font-style: italic;
        color: rgba(255, 255, 255, 0.7);
        font-weight: 500;
        opacity: 1;
      `;
      return;
    }

    replyTextEl.textContent = '';
    replyTextEl.style.cssText = '';
  });

  const activeReplyIndicator = document.querySelector('.replyIndicator');
  if (activeReplyIndicator && replyingToMessageId === editedMessageId) {
    const indicatorMessageEl = activeReplyIndicator.querySelector('.replyIndicatorMessage');
    const indicatorTextWrapper = activeReplyIndicator.querySelector('.replyIndicatorText');
    const mediaInSource = sourceMessage.querySelectorAll('.messageFile img, .messageFile video');

    const trimmed = (sourceText || '').trim();
    if (trimmed.length > 0) {
      indicatorMessageEl.textContent = trimmed;
      indicatorMessageEl.removeAttribute('style');
      const existingMedia = activeReplyIndicator.querySelector('img, video');
      if (existingMedia && existingMedia.parentElement && existingMedia.parentElement.closest('.replyIndicator')) {
        existingMedia.remove();
      }
    } else if (mediaInSource && mediaInSource.length > 0) {
      indicatorMessageEl.textContent = mediaInSource[0].tagName.toLowerCase() === 'video' ? 'Видео' : 'Фото';
      indicatorMessageEl.style.cssText = 'font-style: italic; color: rgba(255, 255, 255, 0.7); font-weight: 500; opacity: 1;';
      let existingMedia = activeReplyIndicator.querySelector('img, video');
      if (!existingMedia && indicatorTextWrapper && indicatorTextWrapper.parentElement) {
        existingMedia = document.createElement(mediaInSource[0].tagName.toLowerCase());
        existingMedia.style.cssText = 'width: 32px; height: 32px; object-fit: cover; border-radius: 4px; margin-right: 8px; flex-shrink: 0; border: 1px solid var(--border-color);';
        indicatorTextWrapper.parentElement.insertBefore(existingMedia, indicatorTextWrapper.parentElement.firstChild);
      }
      if (existingMedia) {
        existingMedia.src = mediaInSource[0].src;
        if (existingMedia.tagName.toLowerCase() === 'video') {
          existingMedia.muted = true;
          existingMedia.loop = true;
          existingMedia.playsInline = true;
        }
      }
    } else {
      indicatorMessageEl.textContent = '';
      indicatorMessageEl.removeAttribute('style');
      const existingMedia = activeReplyIndicator.querySelector('img, video');
      if (existingMedia) existingMedia.remove();
    }
  }
}

// ======== Удалить сообщение ========
function removeMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (messageWrapper) {
    messageWrapper.classList.add('removing');
    setTimeout(() => {
      messageWrapper.remove();
    }, 300);
  }
  
      const replyBlocks = document.querySelectorAll(`.messageReply[data-reply-to="${messageId}"]`);
    replyBlocks.forEach(replyBlock => {
      const replyText = replyBlock.querySelector('.replyText');
      if (replyText) {
        replyText.textContent = 'Удалено';
        replyText.style.cssText = `
          font-style: italic;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
          opacity: 1;
        `;
      }
      
      const mediaPreview = replyBlock.querySelector('img, video');
      if (mediaPreview) {
        const iconSpan = document.createElement('span');
        iconSpan.textContent = '🗑️';
        iconSpan.style.cssText = `
          font-size: 16px;
          margin-right: 6px;
          opacity: 0.9;
        `;
        mediaPreview.parentNode.replaceChild(iconSpan, mediaPreview);
      }
    });
}

// ======== Форматировать время ========
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ======== Добавить пользователя в список ========
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

// ======== Удалить пользователя из списка ========
function removeUser(userId) {
  const userElement = document.getElementById(`user-${userId}`);
  if (userElement) {
    userElement.remove();
  }
}

// ======== Прикрепить файл ========
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

// ======== Обработка вставки из буфера обмена ========
function handlePaste(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  
  for (let item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          showConfirmModal('Файл слишком большой', `Изображение превышает максимальный размер 25MB.`, false);
          return;
        }
        
        if (ALLOWED_FILE_TYPES.includes(file.type)) {
          attachedFiles.push(file);
          updateFilePreview();
          e.preventDefault();
          return;
        } else {
          showConfirmModal('Неподдерживаемый тип файла', 'Вставленное изображение не поддерживается. Разрешены только PNG, JPEG, GIF, WebP, BMP, TIFF.', false);
          return;
        }
      }
    }
  }
}

// ======== Получить иконку файла ========
function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('text/')) return '📄';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('word')) return '📘';
  return '📎';
}

// ======== Форматировать размер файла ========
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ======== Скачать файл ========
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

// ======== Показать предварительный просмотр изображения ========
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
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MEgyMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHBhdGggZD0iTTI1IDI1TDM1IDM1TDI1IDM1VjI1WiIgZmlsbD0iIzg4OCIvPgo8L3N2Zz4K';
    }
  } catch (error) {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0yMCAyMEg0MFY0MEgyMFYyMFoiIGZpbGw9IiM2NjYiLz4KPHBhdGggZD0iTTI1IDI1TDM1IDM1TDI1IDM1VjI1WiIgZmlsbD0iIzg4OCIvPgo8L3N2Zz4K';
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

// ======== Показать предварительный просмотр видео ========
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

// ======== Обновить предварительный просмотр файлов ========
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
  
  const textContainer = document.createElement('div');
  textContainer.className = 'file-preview-text';
  
  const title = document.createElement('span');
  title.className = 'file-preview-title';
  title.textContent = `📎 ${attachedFiles.length} файл(ов)`;
  textContainer.appendChild(title);
  
  const fileCount = document.createElement('span');
  fileCount.className = 'file-preview-count';
  fileCount.textContent = `${attachedFiles.length} файл(ов) готово к отправке`;
  textContainer.appendChild(fileCount);
  
  preview.appendChild(textContainer);
  
  const clearBtn = document.createElement('button');
  clearBtn.className = 'file-preview-cancel';
  clearBtn.textContent = '✕';
  clearBtn.addEventListener('click', () => {
    attachedFiles = [];
    updateFilePreview();
  });
  preview.appendChild(clearBtn);
  
  const replyIndicator = document.querySelector('.replyIndicator');
  const typingIndicator = document.getElementById('typing-indicator');
  
  if (replyIndicator) {
    inputArea.parentNode.insertBefore(preview, replyIndicator);
  } else if (typingIndicator) {
    inputArea.parentNode.insertBefore(preview, typingIndicator);
  } else {
    inputArea.parentNode.insertBefore(preview, inputArea);
  }
  
  ensureFilePreviewOrder();
}

// ======== Отправить сообщение ========
function sendMessage() {
  if (!socket) {
    return;
  }
  
  const messageInput = document.getElementById('message-input');
  let message = messageInput.value.trim();
  
  if (message || attachedFiles.length > 0) {
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
    const messageData = {};
    let parts = [];
    
    if (message) {
      while (message.length > 0) {
        parts.push(message.slice(0, MAX_MESSAGE_LENGTH));
        message = message.slice(MAX_MESSAGE_LENGTH);
      }
      messageData.text = parts[0];
    }
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
      
      if (typeof showProgressConfirmModal === 'function') {
        showProgressConfirmModal('Отправка файлов', 'Подготовка медиа...');
        if (typeof updateProgressConfirmModal === 'function') {
          updateProgressConfirmModal(0, 'Подготовка...');
        }
      }
      
      const filesData = [];
      let loadedFiles = 0;
      const totalFiles = attachedFiles.length;
      
      const sendMessageWithFiles = () => {
        const finalMessageData = { ...messageData };
        finalMessageData.files = filesData;
        if (!window.__pendingClientMessageIds) window.__pendingClientMessageIds = new Set();
        const clientMessageId = Date.now() + Math.random();
        finalMessageData.clientMessageId = clientMessageId;
        window.__pendingClientMessageIds.add(clientMessageId);
        socket.send(JSON.stringify({
          event: 'chatMessage',
          data: finalMessageData
        }));
        
        const messagesContainer = document.querySelector('.messagesContainer');
        if (messagesContainer) {
          setTimeout(() => {
            messagesContainer.scrollTo({
              top: messagesContainer.scrollHeight,
              behavior: 'smooth'
            });
          }, 100);
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
            if (typeof updateProgressConfirmModal === 'function') {
              updateProgressConfirmModal((loadedFiles / totalFiles) * 100, `Подготовлено ${loadedFiles} из ${totalFiles}`);
            }
            
            if (loadedFiles === totalFiles) {
              sendMessageWithFiles();
            }
          };
          reader.onerror = function() {
            loadedFiles++;
            if (typeof updateProgressConfirmModal === 'function') {
              updateProgressConfirmModal((loadedFiles / totalFiles) * 100, `Подготовлено ${loadedFiles} из ${totalFiles}`);
            }
            if (loadedFiles === totalFiles) {
              sendMessageWithFiles();
            }
          };
          reader.readAsDataURL(file);
        } else {
          fileData.data = null;
          loadedFiles++;
          if (typeof updateProgressConfirmModal === 'function') {
            updateProgressConfirmModal((loadedFiles / totalFiles) * 100, `Подготовлено ${loadedFiles} из ${totalFiles}`);
          }
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
    
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const additionalMessageData = { text: parts[i] };
        socket.send(JSON.stringify({
          event: 'chatMessage',
          data: additionalMessageData
        }));
      }
    }
    
    const messagesContainer = document.querySelector('.messagesContainer');
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
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

// ======== Обработать печатание ========
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

// ======== Инициализировать чат ========
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
        try { messageStore.set(message.id, message); } catch (e) { }
      });
    } else {
      console.warn('Messages list is not an array:', userData.messages);
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (Array.isArray(userData.messages)) {
      requestImagesForMessages(userData.messages);
    }
    
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
      if (typeof showAttachModal === 'function') {
        showAttachModal();
      } else {
        attachFile();
      }
    });
    
    attachButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
    });
    
    attachButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof showAttachModal === 'function') {
        showAttachModal();
      } else {
        attachFile();
      }
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
          if (window.playSound) {
            window.playSound('swift');
          }
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

// ======== Настроить события чата ========
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
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer) {
        if (isMobile) {
          messagesContainer.classList.add('input-focused');
          document.body.classList.add('input-focused');
          
          const preventPageScroll = (e) => {
            if (document.body.classList.contains('keyboard-open')) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          };
          
          document.addEventListener('touchmove', preventPageScroll, { passive: false });
          document.addEventListener('scroll', preventPageScroll, { passive: false });
          
          messageInput._preventPageScroll = preventPageScroll;
        } else {
          messagesContainer.style.pointerEvents = 'auto';
          messagesContainer.style.touchAction = 'pan-y';
          messagesContainer.style.overflowY = 'auto';
        }
      }
    });
    
    messageInput.addEventListener('blur', () => {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
      
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer && isMobile) {
        messagesContainer.classList.remove('input-focused');
        document.body.classList.remove('input-focused');
        
        if (messageInput._preventPageScroll) {
          document.removeEventListener('touchmove', messageInput._preventPageScroll);
          document.removeEventListener('scroll', messageInput._preventPageScroll);
          delete messageInput._preventPageScroll;
        }
      }
    });
    
    messageInput.addEventListener('input', () => {
      const messagesContainer = document.querySelector('.messagesContainer');
      if (messagesContainer) {
        if (!isMobile) {
          messagesContainer.style.pointerEvents = 'auto';
          messagesContainer.style.touchAction = 'pan-y';
          messagesContainer.style.overflowY = 'auto';
        }
      }
    });
    
    messageInput.addEventListener('paste', handlePaste);
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
  
  const scrollToBottomButton = document.getElementById('scroll-to-bottom-button');
  
  if (scrollToBottomButton && messagesContainer) {
    function scrollToBottom() {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
    
    scrollToBottomButton.addEventListener('click', scrollToBottom);
    
    function checkScrollButtonVisibility() {
      const scrollTop = messagesContainer.scrollTop;
      const scrollHeight = messagesContainer.scrollHeight;
      const clientHeight = messagesContainer.clientHeight;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 6000;
      
      if (isNearBottom) {
        scrollToBottomButton.style.display = 'none';
      } else {
        scrollToBottomButton.style.display = 'flex';
      }
    }
    
    messagesContainer.addEventListener('scroll', checkScrollButtonVisibility);
    
    checkScrollButtonVisibility();
    
    window.addEventListener('resize', checkScrollButtonVisibility);
  }
}

// ======== Обновить индикатор печатания ========
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

// ======== Настроить форму входа ========
function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username-input');
  
  if (usernameInput) {
    usernameInput.addEventListener('input', function(e) {
      const value = this.value;
      const englishOnlyRegex = /^[a-zA-Z0-9_-]*$/;
      
      if (!englishOnlyRegex.test(value)) {
        this.value = value.replace(/[^a-zA-Z0-9_-]/g, '');
      }
    });
  }
  
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
    
    const englishOnlyRegex = /^[a-zA-Z0-9_-]+$/;
    if (!englishOnlyRegex.test(username)) {
      showConfirmModal("Некорректное имя", "Имя может содержать только английские буквы, цифры, дефис и подчеркивание", false);
      return;
    }
    
    if (!tunnelUrl) {
      showConfirmModal("Поле не заполнено", "Пожалуйста, введите URL сервера", false);
      return;
    }

    localStorage.setItem('savedUsername', username);

    checkUserRights(username, tunnelUrl);
  });
}



// ======== Проверить права пользователя ========
async function checkUserRights(username, tunnelUrl) {
  try {
    const adminResponse = await fetch(`${tunnelUrl}/check_auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: '',
        auth_type: 'admin'
      })
    });
    
    const adminData = await adminResponse.json();
    
    if (adminData.success === false && adminData.message.includes('не найден')) {
      const moderatorResponse = await fetch(`${tunnelUrl}/check_auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: '',
          auth_type: 'moderator'
        })
      });
      
      const moderatorData = await moderatorResponse.json();
      
      if (moderatorData.success === false && moderatorData.message.includes('не найден')) {
        completeLogin(username, tunnelUrl, false);
      } else {
        showModeratorConfirmModal((password) => {
          completeLogin(username, tunnelUrl, false, true, password);
        });
      }
    } else {
      showAdminConfirmModal((password) => {
        completeLogin(username, tunnelUrl, true, false, password);
      });
    }
  } catch (error) {
    console.error('Ошибка при проверке прав пользователя:', error);
    completeLogin(username, tunnelUrl, false);
  }
}

// ======== Завершить вход ========
function completeLogin(username, serverUrl, isAdmin = false, isModerator = false, password = '') {
  let formattedUrl = serverUrl.trim();
  
  if (!formattedUrl || formattedUrl.trim() === '') {
    formattedUrl = window.location.host;
  }
  
  if (formattedUrl && formattedUrl !== window.location.host) {
    localStorage.setItem('savedServerUrl', formattedUrl);
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
          joinChat(mainSocket, username, userId, isAdmin, isModerator, password);
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

// ======== Присоединиться к чату ========
function joinChat(socket, username, userId, isAdmin = false, isModerator = false, password = '') {
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
  
  if (isAdmin || isModerator) {
    userData.password = password;
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

// ======== Инициализировать сокет ========
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
        if (typeof closeProgressConfirmModal === 'function') {
          closeProgressConfirmModal();
        }
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

// ======== Обработать сообщение WebSocket ========
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
      // Закрыть модалку прогресса после подтверждения отправки нашего сообщения
      try {
        const msg = data.message || {};
        if (msg.user && msg.user.id === currentUser.id && typeof msg.clientMessageId !== 'undefined') {
          if (window.__pendingClientMessageIds && window.__pendingClientMessageIds.has(msg.clientMessageId)) {
            window.__pendingClientMessageIds.delete(msg.clientMessageId);
            if (typeof updateProgressConfirmModal === 'function') {
              updateProgressConfirmModal(100, 'Отправлено');
            }
            if (typeof closeProgressConfirmModal === 'function') {
              setTimeout(() => closeProgressConfirmModal(), 150);
            }
          }
        }
      } catch (_) {}
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
      handleAvatarCategories(data);
      break;
    case 'usernameTaken':
      handleUsernameTaken(data.message);
      break;
    case 'authFailed':
      handleAuthFailed(data.message);
      break;
    case 'messagesLoaded':
      handleMessagesLoaded(data);
      break;
    case 'imageDataLoaded':
      handleImageDataLoaded(data.images || []);
      break;
    default:
  }
}

// ======== Обработать приветствие ========
function handleWelcome(data) {
  currentPage = 0;
  hasMoreMessages = data.hasMoreMessages || false;
  
      if (window.playSound) {
        window.playSound('elegant');
      }
  
  initChat(data);
  
}

// ======== Обработать присоединение пользователя ========
function handleUserJoined(user) {
  addUserToList(user);
  createUserActivityToast(user, 'joined');
  
  if (user.id !== currentUser.id && window.playSound) {
    window.playSound('cheer');
  }
}

// ======== Обработать выход пользователя ========
function handleUserLeft(user) {
  removeUser(user.id);  
  createUserActivityToast(user, 'left');
  
  if (user.id !== currentUser.id && window.playSound) {
    window.playSound('light');
  }
}

// ======== Обработать новое сообщение ========
function handleNewMessage(message) {
  const isMyMessage = message.user.id === currentUser.id;
  const messageElement = createMessageElement(message, isMyMessage);
  
  const messageContainer = document.querySelector('.messagesContainer');
  
  if (messageContainer) {
    const wasAtBottom = messageContainer.scrollTop + messageContainer.clientHeight >= messageContainer.scrollHeight - 10;
    
    messageContainer.appendChild(messageElement);
    
    console.log('Новое сообщение:', {
      isMyMessage,
      wasAtBottom,
      from: message.user.username,
      text: message.text.substring(0, 50) + '...'
    });
    
    if (!isMyMessage || wasAtBottom) {
      setTimeout(() => {
        messageContainer.scrollTo({
          top: messageContainer.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  }
  try { messageStore.set(message.id, message); } catch (e) { }
  
  if (!isMyMessage) {
    if (document.hidden) {
      if (window.playSound) {
        window.playSound('times');
      }
      
      if (window.showNewMessageNotification) {
        window.showNewMessageNotification(message.text, message.user.username);
      }
    }
  }
}

// ======== Обработать редактирование сообщения ========
function handleMessageEdited(message) {
  updateMessageText(message.id, message.text, true);
  try {
    updateReplyBlocksAfterEdit(message.id);
  } catch (e) {}
}

// ======== Обработать удаление сообщения ========
function handleMessageDeleted(messageId) {
  removeMessage(messageId);
}

// ======== Обработать печатание пользователя ========
function handleUserTyping(user) {
  if (user.id !== currentUser.id) {
    typingUsers.add(user.id);
    updateTypingIndicator();
  }
}

// ======== Обработать остановку печатания пользователя ========
function handleUserStoppedTyping(user) {
  typingUsers.delete(user.id);
  updateTypingIndicator();
}

// ======== Обработать загрузку сообщений ========
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
      try { messageStore.set(message.id, message); } catch (e) { }
    });
    
    messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
    
    if (window.lastScrollHeight) {
      const newScrollHeight = messagesContainer.scrollHeight;
      const scrollDiff = newScrollHeight - window.lastScrollHeight;
      messagesContainer.scrollTop = scrollDiff;
      window.lastScrollHeight = null;
    }
    requestImagesForMessages(data.messages);
  }
}

// ======== Запросить данные изображений для списка сообщений ========
function requestImagesForMessages(messages) {
  if (!socket || !Array.isArray(messages) || messages.length === 0) return;
  const requests = [];
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.files)) continue;
    msg.files.forEach((file, index) => {
      if (file && typeof file.type === 'string' && file.type.startsWith('image/')) {
        if (!file.data) {
          requests.push({ messageId: msg.id, fileIndex: index });
        }
      }
    });
  }
  if (requests.length > 0) {
    socket.send(JSON.stringify({
      event: 'getImageData',
      data: { requests }
    }));
  }
}

// ======== Обработать подгрузку данных изображений ========
function handleImageDataLoaded(images) {
  if (!Array.isArray(images) || images.length === 0) return;
  for (const item of images) {
    const { messageId, fileIndex, data } = item || {};
    if (messageId == null || fileIndex == null || !data) continue;
    const message = messageStore.get(messageId);
    if (!message || !Array.isArray(message.files) || fileIndex < 0 || fileIndex >= message.files.length) continue;
    try { message.files[fileIndex].data = data; } catch (e) { }
    const wrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
    if (!wrapper) continue;
    const fileNodes = wrapper.querySelectorAll('.messageFile');
    if (!fileNodes || fileNodes.length <= fileIndex) continue;
    const targetNode = fileNodes[fileIndex];
    if (!targetNode) continue;
    const img = targetNode.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = data;
    }
    
    updateReplyPreviews(messageId, data);
  }
}

// ======== Обновить превью изображений в плашках ответов ========
function updateReplyPreviews(messageId, imageData) {
  const replyBlocks = document.querySelectorAll(`.messageReply[data-reply-to="${messageId}"]`);
  replyBlocks.forEach(replyBlock => {
    const mediaPreview = replyBlock.querySelector('img, video');
    if (mediaPreview && mediaPreview.tagName.toLowerCase() === 'img') {
      mediaPreview.src = imageData;
      mediaPreview.style.display = 'block';
    }
  });
}

// ======== Обработать изменение аватара ========
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

// ======== Обработать обновление названия группы ========
function handleGroupNameUpdated(name) {
  updateGroupName(name);
  createNotificationToast(`Название группы изменено на "${name}"`);
  if (window.playSound) {
    window.playSound('swift');
  }
}

// ======== Обработать категории аватаров ========
function handleAvatarCategories(data) {
  const categories = data.categories || {};
  const unlockedSpecialAvatars = data.unlockedSpecialAvatars || [];
  const animals = categories['Animals'] || [];
  const special = categories['Special'] || [];
  
  const modal = document.querySelector('.avatar-selector-modal');
  if (modal) {
    const avatarContainer = modal.querySelector('.avatarSelector');
    if (avatarContainer) {
      const allAvatars = [...animals];
      
      special.forEach(avatar => {
        const isUnlocked = unlockedSpecialAvatars.includes(avatar);
        allAvatars.push({
          path: avatar,
          isSpecial: true,
          isUnlocked: isUnlocked
        });
      });
      
      renderAvatars(allAvatars, avatarContainer, 1, allAvatars, null, modal, modal.querySelector('div:last-child'));
    }
  }
}

// ======== Обработать занятое имя пользователя ========
function handleUsernameTaken(message) {
  showConfirmModal("Ошибка", message, false);
}

// ======== Обработать ошибку аутентификации ========
function handleAuthFailed(message) {
  showConfirmModal("Ошибка аутентификации", message, false);
}

// ======== Обновить название группы ========
function updateGroupName(name) {
  const groupNameElement = document.getElementById('group-name');
  if (groupNameElement) {
    groupNameElement.textContent = name;
  }
}

// ======== Загрузить больше сообщений ========
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

// ======== Проверить статус сети ========
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

// ======== Обновить аватар пользователя ========
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

// ======== Получить страницы пагинации ========
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

// ======== Отобразить аватары ========
function renderAvatars(avatars, avatarContainer, currentPage, currentAvatars, pagination, modal, buttonsContainer) {
  currentAvatars = avatars;
  avatarContainer.innerHTML = '';
  
  avatarContainer.style.maxWidth = '100%';
  avatarContainer.style.gap = '15px';
  
  if (!avatars || avatars.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'Нет доступных аватарок';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = 'var(--text-color)';
    emptyMsg.style.margin = '32px 0 24px 0';
    avatarContainer.appendChild(emptyMsg);
    return;
  }
  
  const saveButton = modal.querySelector('.button.primary');
  
  avatars.forEach((avatarData, idx) => {
    let avatarSrc, isSpecial = false, isUnlocked = true;
    
    if (typeof avatarData === 'string') {
      avatarSrc = avatarData;
    } else {
      avatarSrc = avatarData.path;
      isSpecial = avatarData.isSpecial || false;
      isUnlocked = avatarData.isUnlocked !== false;
    }
    
    const avatarWrapper = document.createElement('div');
    avatarWrapper.style.position = 'relative';
    avatarWrapper.style.display = 'inline-block';
    
    const avatarOption = document.createElement('img');
    avatarOption.src = 'public/' + avatarSrc;
    avatarOption.className = 'avatarOption';
    avatarOption.style.width = '60px';
    avatarOption.style.height = '60px';
    avatarOption.style.borderRadius = '50%';
    avatarOption.style.cursor = isUnlocked ? 'pointer' : 'not-allowed';
    avatarOption.style.border = '2px solid transparent';
    avatarOption.style.transition = 'all 0.3s ease';
    avatarOption.style.objectFit = 'cover';
    
    if (isSpecial && !isUnlocked) {
      avatarOption.style.filter = 'grayscale(100%) brightness(0.5)';
      
      const lockOverlay = document.createElement('div');
      lockOverlay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
      `;
      lockOverlay.innerHTML = '🔒';
      avatarWrapper.appendChild(lockOverlay);
    }
    
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
      if (!isUnlocked) {
        createNotificationToast('У вас нет доступа к этой специальной аватарке');
        return;
      }
      
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
      if (!this.classList.contains('selectedAvatar') && isUnlocked) {
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
    
    avatarWrapper.appendChild(avatarOption);
    avatarContainer.appendChild(avatarWrapper);
  });
}

// ======== Показать селектор аватара ========
function showAvatarSelector() {
  
  const modal = document.createElement('div');
  modal.className = 'avatar-selector-modal';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = 'var(--card-background)';
  modal.style.borderRadius = '16px';
  modal.style.padding = '25px';
  modal.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
  modal.style.zIndex = '1000';
  modal.style.maxWidth = '95%';
  modal.style.width = '800px';
  modal.style.border = '1px solid var(--border-color)';
  
  const title = document.createElement('h3');
  title.textContent = 'Выберите новую аватарку';
  title.style.textAlign = 'center';
  title.style.marginTop = '0';
  title.style.marginBottom = '15px';
  title.style.color = 'white';
  title.style.fontSize = '20px';
  title.style.fontWeight = '600';
  modal.appendChild(title);
  
  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'avatarSelector';
  avatarContainer.style.display = 'flex';
  avatarContainer.style.flexWrap = 'wrap';
  avatarContainer.style.justifyContent = 'center';
  avatarContainer.style.maxWidth = '100%';
  avatarContainer.style.margin = '0 auto';
  avatarContainer.style.gap = '15px';
  avatarContainer.style.marginBottom = '25px';
  avatarContainer.style.minHeight = '350px';
  avatarContainer.style.maxHeight = '450px';
  avatarContainer.style.overflowY = 'auto';
  avatarContainer.style.padding = '20px';
  avatarContainer.style.background = 'var(--card-background)';
  avatarContainer.style.opacity = '1';
  avatarContainer.style.borderRadius = '15px';
  avatarContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  avatarContainer.style.height = '350px';
  modal.appendChild(avatarContainer);
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.justifyContent = 'center';
  buttonsContainer.style.gap = '10px';
  modal.appendChild(buttonsContainer);
  
  if (socket) {
    socket.send(JSON.stringify({
      event: 'getAvatarCategories'
    }));
  }
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Сохранить';
  saveButton.className = 'button primary';
  saveButton.style.padding = '12px 30px';
  saveButton.style.borderRadius = '12px';
  saveButton.style.border = 'none';
  saveButton.style.background = 'linear-gradient(135deg, var(--accent-color), var(--primary-color))';
  saveButton.style.color = 'white';
  saveButton.style.cursor = 'pointer';
  saveButton.style.fontWeight = '600';
  saveButton.style.transition = 'all 0.3s ease';
  saveButton.style.boxShadow = '0 4px 15px rgba(var(--accent-color-rgb), 0.4)';
  saveButton.addEventListener('click', function() {
    const selectedAvatar = this.dataset.selectedAvatar;
    if (selectedAvatar) {
      updateUserAvatar('public/' + selectedAvatar);
      if (window.playSound) {
        window.playSound('nowhere');
      }
    }
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  buttonsContainer.appendChild(saveButton);
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Отмена';
  cancelButton.className = 'button';
  cancelButton.style.padding = '12px 25px';
  cancelButton.style.borderRadius = '12px';
  cancelButton.style.border = '2px solid rgba(255, 255, 255, 0.2)';
  cancelButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
  cancelButton.style.color = 'var(--text-color)';
  cancelButton.style.cursor = 'pointer';
  cancelButton.style.fontWeight = '500';
  cancelButton.style.transition = 'all 0.3s ease';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  buttonsContainer.appendChild(cancelButton);
  
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
  
  avatarContainer.addEventListener('touchstart', function(e) {
    e.stopPropagation();
  });
  
  avatarContainer.addEventListener('touchmove', function(e) {
    e.stopPropagation();
  });
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

// ======== Начать ответ на сообщение ========
function startReplyToMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  const messageSenderElement = messageWrapper.querySelector('.messageSender');
  if (!messageTextElement || !messageSenderElement) return;
  
  const replyText = messageTextElement.textContent;
  const replyUsername = messageSenderElement.textContent || currentUser.username;
  
  const messageFiles = messageWrapper.querySelectorAll('.messageFile');
  let replyFiles = [];
  
  if (messageFiles.length > 0) {
    messageFiles.forEach(fileElement => {
      const mediaPreview = fileElement.querySelector('img, video');
      if (mediaPreview) {
        replyFiles.push({
          src: mediaPreview.src,
          type: mediaPreview.tagName.toLowerCase() === 'video' ? 'video' : 'image'
        });
      }
    });
  }
  
  replyingToMessageId = messageId;
  
  const messageInput = document.getElementById('message-input');
  const currentInputText = messageInput.value;
  
  const previousState = {
    text: currentInputText,
    placeholder: messageInput.placeholder
  };
  
  messageInput.placeholder = `Ответить на сообщение от ${replyUsername}...`;
  messageInput.focus();
  
  showReplyIndicator(messageId, replyText, replyUsername, replyFiles);
  
  const cancelReplyHandler = function(e) {
    if (e.key === 'Escape') {
      cancelReply();
      document.removeEventListener('keydown', cancelReplyHandler);
    }
  };
  document.addEventListener('keydown', cancelReplyHandler);
}

// ======== Показать индикатор ответа ========
function showReplyIndicator(messageId, replyText, replyUsername, replyFiles = []) {
  hideReplyIndicator();
  let replyIndicator = document.createElement('div');
  replyIndicator.className = 'replyIndicator';
  
  let replyContent = '';
  
  if (replyFiles.length > 0 && (!replyText || replyText.trim() === '')) {
    const firstFile = replyFiles[0];
    const mediaType = firstFile.type === 'video' ? 'video' : 'img';
    const mediaElement = `<${mediaType} src="${firstFile.src}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; margin-right: 8px; flex-shrink: 0; border: 1px solid var(--border-color);" ${mediaType === 'video' ? 'muted loop playsinline' : ''}></${mediaType}>`;
    
    replyContent = `
      <div class="replyIndicatorContent">
        <div style="display: flex; align-items: center;">
          ${mediaElement}
          <div class="replyIndicatorText">
            <span class="replyIndicatorAuthor">${replyUsername}</span>
            <span class="replyIndicatorMessage" style="font-style: italic; color: rgba(255, 255, 255, 0.7); font-weight: 500; opacity: 1;">${firstFile.type === 'video' ? 'Видео' : 'Фото'}</span>
          </div>
        </div>
        <button class="replyIndicatorCancel" onclick="cancelReply()">✕</button>
      </div>
    `;
  } else {
    replyContent = `
      <div class="replyIndicatorContent">
        <div class="replyIndicatorText">
          <span class="replyIndicatorAuthor">${replyUsername}</span>
          <span class="replyIndicatorMessage">${replyText}</span>
        </div>
        <button class="replyIndicatorCancel" onclick="cancelReply()">✕</button>
      </div>
    `;
  }
  
  replyIndicator.innerHTML = replyContent;
  const inputArea = document.querySelector('.inputArea');
  const typingIndicator = document.getElementById('typing-indicator');
  
  if (inputArea && inputArea.parentNode) {
    inputArea.parentNode.insertBefore(replyIndicator, typingIndicator);
  }
  updateReplyIndicatorMargin();
  
  ensureFilePreviewOrder();
}

// ======== Скрыть индикатор ответа ========
function hideReplyIndicator() {
  const existingIndicator = document.querySelector('.replyIndicator');
  if (existingIndicator) existingIndicator.remove();
}

// ======== Обновить отступ индикатора ответа ========
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

// ======== Отменить ответ ========
function cancelReply() {
  replyingToMessageId = null;
  hideReplyIndicator();
  
  const messageInput = document.getElementById('message-input');
  messageInput.placeholder = 'Введите сообщение...';
}

// ======== Прокрутить к сообщению ========
function scrollToMessage(messageId) {
  const messageElement = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (messageElement) {
    const container = document.querySelector('.messagesContainer');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const offsetTopWithinContainer = messageRect.top - containerRect.top + currentScrollTop;
      const targetTop = Math.max(0, offsetTopWithinContainer - (container.clientHeight / 2) + (messageElement.clientHeight / 2));
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    } else {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    const contentElement = messageElement.querySelector('.messageContent');
    if (contentElement) {
      contentElement.classList.add('highlighted');
      setTimeout(() => {
        contentElement.classList.remove('highlighted');
      }, 2000);
    }
  }
}

// ======== Обеспечить правильный порядок элементов ========
function ensureFilePreviewOrder() {
  const filePreview = document.querySelector('.file-preview');
  const replyIndicator = document.querySelector('.replyIndicator');
  const inputArea = document.querySelector('.inputArea');
  
  if (filePreview && replyIndicator && inputArea && inputArea.parentNode) {
    if (replyIndicator.compareDocumentPosition(filePreview) & Node.DOCUMENT_POSITION_PRECEDING) {
      inputArea.parentNode.insertBefore(filePreview, replyIndicator);
    }
  }
}