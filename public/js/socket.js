let socket = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

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
const ADMIN_PASSWORD = 'cul6768adm';
const MODERATOR_PASSWORD = 'cul7686mod';
let customTooltip = null;

const CATEGORY_LABELS = {
  Animals: "Животные"
};

const MAX_GROUP_NAME_LENGTH = 15;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_TEXT_LENGTH = 100;

function showCustomTooltip(e, text) {
  if (!customTooltip) {
    customTooltip = document.createElement('div');
    customTooltip.className = 'custom-tooltip';
    document.body.appendChild(customTooltip);
  }
  const targetRect = e.target.getBoundingClientRect();
  customTooltip.textContent = text;
  customTooltip.style.left = `${targetRect.left + targetRect.width / 2}px`;
  customTooltip.style.top = `${targetRect.top}px`;
  customTooltip.style.transform = 'translate(-50%, -110%)';
  customTooltip.classList.add('visible');
}

function hideCustomTooltip() {
  if (customTooltip) {
    customTooltip.classList.remove('visible');
  }
}

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
          const blob = new Blob([file.data], { type: file.type });
          mediaPreview.src = URL.createObjectURL(blob);
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
        socket.emit('editMessage', { id: editingMessageId, text: newText });
        
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
        socket.emit('deleteMessage', { id: messageId });
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

function createNotificationToast(message) {
  if (document.getElementById('login-form') && document.getElementById('login-form').style.display !== 'none') {
    return;
  }
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 300px;
        background-color: var(--card-background);
        border-left: 3px solid var(--accent-color);
        padding: 12px 15px;
        border-radius: 6px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        z-index: 1000;
        color: var(--text-color);
        opacity: 0.9;
        transition: opacity 0.3s ease;
      }
      .notification-toast.mobile {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
    `;
    document.head.appendChild(style);
  }

  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.zIndex = '1000';
    toastContainer.style.top = '20px';
    toastContainer.style.right = '20px';
    document.body.appendChild(toastContainer);
  }

  const existingToasts = document.querySelectorAll('.notification-toast');
  existingToasts.forEach(t => {
    if (t.textContent === message) t.remove();
  });

  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.textContent = message;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    toast.classList.add('mobile');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
  } else {
    const countToasts = document.querySelectorAll('.notification-toast:not(.mobile)').length;
    toast.style.position = 'fixed';
    toast.style.top = `${20 + countToasts * 70}px`;
    toast.style.right = '20px';
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);

  return toast;
}

function createUserActivityToast(message, avatarUrl) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'notification-toast user-activity';

    const avatar = document.createElement('img');
    avatar.src = 'public/' + avatarUrl;
    avatar.className = 'toast-avatar';
    avatar.onerror = function() {
      this.src = 'public/Images/user.png';
      console.error('Не удалось загрузить аватар:', avatarUrl);
    };
    toast.appendChild(avatar);

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

let attachedFiles = [];
const MAX_FILE_SIZE = 25 * 1024 * 1024; 
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
  'video/mp4'
];

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
    console.error('Ошибка при выборе файлов:', e);
    showConfirmModal('Ошибка', 'Не удалось выбрать файлы. Попробуйте еще раз.', false);
  });
  
  input.addEventListener('change', (e) => {
    console.log('Файлы выбраны:', e.target.files);
    
    if (!e.target.files || e.target.files.length === 0) {
      console.log('Файлы не выбраны');
      return;
    }
    
    const files = Array.from(e.target.files);
    const validFiles = [];
    const invalidFiles = [];
    
    console.log('Обрабатываем файлы:', files.length);
    
    for (let file of files) {
      console.log('Проверяем файл:', file.name, file.type, file.size);
      
      if (file.size > MAX_FILE_SIZE) {
        showConfirmModal('Файл слишком большой', `Файл "${file.name}" превышает максимальный размер 25MB.`, false);
        return;
      }
      
      if (ALLOWED_FILE_TYPES.includes(file.type)) {
        validFiles.push(file);
        console.log('Файл добавлен:', file.name);
      } else {
        invalidFiles.push(file.name);
        console.log('Файл отклонен:', file.name, file.type);
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
      console.log('Добавляем файлы в attachedFiles:', validFiles.length);
      attachedFiles = attachedFiles.concat(validFiles);
      updateFilePreview();
    }
    
    input.value = '';
  });
  
  input.addEventListener('cancel', () => {
    console.log('Выбор файлов отменен');
  });
  
  try {
    input.click();
  } catch (error) {
    console.error('Ошибка при открытии диалога выбора файлов:', error);
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
    console.error('Не удалось создать URL для скачивания файла');
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
  
  if (file.url) {
    img.src = file.url;
  } else if (file.data) {
    const blob = new Blob([file.data], { type: file.type });
    img.src = URL.createObjectURL(blob);
  } else if (file instanceof File) {
    img.src = URL.createObjectURL(file);
  } else {
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
  
  if (file.data) {
    const blob = new Blob([file.data], { type: file.type });
    video.src = URL.createObjectURL(blob);
  } else if (file instanceof File) {
    video.src = URL.createObjectURL(file);
  } else {
    console.error('Не удалось создать URL для видео');
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
  
  if (isMobile) {
    preview.style.cssText = `
      background: var(--card-background);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px;
      margin: 8px 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;
  } else {
    preview.style.cssText = `
      background: var(--card-background);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 15px;
      margin: 8px 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;
  }
  
  const title = document.createElement('div');
  title.textContent = `📎 Прикреплено файлов: ${attachedFiles.length}`;
  title.style.cssText = `
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--text-color);
    font-size: ${isMobile ? '14px' : '15px'};
  `;
  preview.appendChild(title);
  
  attachedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${isMobile ? '8px 10px' : '10px 12px'};
      margin-bottom: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid var(--border-color);
      transition: all 0.2s ease;
    `;
    
    fileItem.addEventListener('mouseenter', () => {
      fileItem.style.background = 'rgba(255, 255, 255, 0.1)';
      fileItem.style.borderColor = 'var(--accent-color)';
    });
    
    fileItem.addEventListener('mouseleave', () => {
      fileItem.style.background = 'rgba(255, 255, 255, 0.05)';
      fileItem.style.borderColor = 'var(--border-color)';
    });
    
    const fileInfo = document.createElement('div');
    fileInfo.style.cssText = `
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
    `;
    
            const fileIcon = document.createElement('span');
        fileIcon.textContent = getFileIcon(file.type);
        fileIcon.style.cssText = `
          font-size: ${isMobile ? '16px' : '18px'};
          margin-right: ${isMobile ? '8px' : '10px'};
          flex-shrink: 0;
        `;
    
          const fileName = document.createElement('span');
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
        color: var(--text-color);
        font-size: ${isMobile ? '12px' : '14px'};
        font-weight: 500;
        max-width: ${isMobile ? '120px' : '200px'};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
    
    const fileSize = document.createElement('div');
    fileSize.textContent = formatFileSize(file.size);
    fileSize.style.cssText = `
      color: var(--text-secondary);
      font-size: ${isMobile ? '11px' : '12px'};
      margin-top: 2px;
    `;
    
    const fileDetails = document.createElement('div');
    fileDetails.appendChild(fileName);
    fileDetails.appendChild(fileSize);
    
    fileInfo.appendChild(fileIcon);
    fileInfo.appendChild(fileDetails);
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '✕';
    removeBtn.style.cssText = `
      background: rgba(255, 82, 82, 0.1);
      border: 1px solid rgba(255, 82, 82, 0.3);
      color: #ff5252;
      cursor: pointer;
      font-size: ${isMobile ? '12px' : '14px'};
      padding: ${isMobile ? '4px 8px' : '6px 10px'};
      border-radius: 6px;
      transition: all 0.2s ease;
      margin-left: 10px;
    `;
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = 'rgba(255, 82, 82, 0.2)';
      removeBtn.style.borderColor = '#ff5252';
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = 'rgba(255, 82, 82, 0.1)';
      removeBtn.style.borderColor = 'rgba(255, 82, 82, 0.3)';
    });
    removeBtn.addEventListener('click', () => {
      attachedFiles.splice(index, 1);
      updateFilePreview();
    });
    
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(removeBtn);
    preview.appendChild(fileItem);
  });
  
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Очистить все';
  clearBtn.style.cssText = `
    background: var(--accent-color);
    color: white;
    border: none;
    padding: ${isMobile ? '8px 16px' : '10px 20px'};
    border-radius: 8px;
    cursor: pointer;
    font-size: ${isMobile ? '13px' : '14px'};
    font-weight: 600;
    width: 100%;
    transition: all 0.2s ease;
    margin-top: 8px;
  `;
  clearBtn.addEventListener('mouseenter', () => {
    clearBtn.style.opacity = '0.8';
  });
  clearBtn.addEventListener('mouseleave', () => {
    clearBtn.style.opacity = '1';
  });
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
        socket.emit('editMessage', { id: editingMessageId, text: newText });
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
        socket.emit('chatMessage', finalMessageData);
        
        attachedFiles = [];
        updateFilePreview();
        messageInput.value = '';
        messageInput.placeholder = 'Введите сообщение...';
        messageInput.focus();
        if (replyingToMessageId) {
          cancelReply();
        }
        socket.emit('stopTyping');
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
            console.error('Ошибка загрузки файла:', file.name);
            loadedFiles++;
            if (loadedFiles === totalFiles) {
              sendMessageWithFiles();
            }
          };
          reader.readAsArrayBuffer(file);
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
    
    socket.emit('chatMessage', messageData);
    
    for (let i = 1; i < parts.length; i++) {
      const additionalMessageData = { text: parts[i] };
      socket.emit('chatMessage', additionalMessageData);
    }
    
    attachedFiles = [];
    updateFilePreview();
    messageInput.value = '';
    messageInput.placeholder = 'Введите сообщение...';
    messageInput.focus();
    if (replyingToMessageId) {
      cancelReply();
    }
    socket.emit('stopTyping');
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
    socket.emit('typing');
  }
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping');
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
      console.log('Чат уже инициализирован, обновляем данные');
      
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
      console.log('Кнопка прикрепления файлов нажата (click)');
      attachFile();
    });
    
    attachButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      console.log('Кнопка прикрепления файлов нажата (touchstart)');
    });
    
    attachButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Кнопка прикрепления файлов отпущена (touchend)');
      attachFile();
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
          socket.emit('updateGroupName', newName);
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
    
    console.log('Chat initialized successfully');
  } catch (error) {
    console.error('Error initializing chat:', error);
    showConfirmModal("Ошибка инициализации", "Произошла ошибка при инициализации чата", false);
  }
}

function setupChatEvents() {
  if (!socket) return;

  socket.off('error');
  socket.off('connect_error');
  socket.off('disconnect');
  socket.off('welcome');
  socket.off('message');
  socket.off('messageEdited');
  socket.off('messageDeleted');
  socket.off('groupNameUpdated');
  socket.off('avatarChanged');
  socket.off('userJoined');
  socket.off('userLeft');
  socket.off('userTyping');
  socket.off('userStoppedTyping');

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    showConfirmModal("Ошибка соединения", "Произошла ошибка при работе с сервером", false);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Connection error in chat:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    if (reason === 'io server disconnect') {
      showConfirmModal("Соединение разорвано", "Сервер разорвал соединение. Возможно, вы были отключены администратором.", false);
    } else if (reason === 'transport close') {
      showConfirmModal("Соединение потеряно", "Потеряно соединение с сервером. Проверьте интернет-соединение.", false);
    }
  });
  
  socket.on('welcome', (userData) => {
    console.log('Received welcome event with data:', userData);
    
    if (!userData || !userData.user || !userData.user.id) {
      console.error('Invalid welcome data received:', userData);
      showConfirmModal(
        "Ошибка входа", 
        "Получены некорректные данные от сервера при входе. Попробуйте перезагрузить страницу.", 
        false
      );
      return;
    }
    
  });
  
  socket.on('message', (message) => {
    const messagesContainer = document.querySelector('.messagesContainer');
    const isMyMsg = message.user.id === currentUser.id || message.user.username.toLowerCase() === currentUser.username.toLowerCase();
    const messageElement = createMessageElement(message, isMyMsg);
    messagesContainer.appendChild(messageElement);
    
    updateTypingIndicator();
    
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  });
  
  socket.on('messageEdited', (message) => {
    updateMessageText(message.id, message.text, true);
  });
  
  socket.on('messageDeleted', (data) => {
    if (replyingToMessageId === data.id) {
      cancelReply();
    }
    document.querySelectorAll('.messageReply[data-reply-to]').forEach(replyBlock => {
      if (replyBlock.getAttribute('data-reply-to') == data.id) {
        replyBlock.remove();
      }
    });
    removeMessage(data.id);
  });
  
  socket.on('groupNameUpdated', (data) => {
    document.getElementById('group-name').textContent = data.name;
    createNotificationToast(`Название группы изменено на "${data.name}"`);
  });
  
  socket.on('avatarChanged', (data) => {
    console.log('Получено событие avatarChanged:', data);
    
    const userElement = document.querySelector(`.userItem[id="user-${data.userId}"]`);
    if (userElement) {
      const avatarElement = userElement.querySelector('.userAvatar');
      if (avatarElement) {
        avatarElement.src = 'public/' + data.newAvatar;
      }
    }
    
    const messageAvatars = document.querySelectorAll(`.messageWrapper .userAvatar[alt="${data.username}"]`);
    messageAvatars.forEach(avatar => {
      avatar.src = 'public/' + data.newAvatar;
    });
    
    if (data.userId === currentUser.id || data.username.toLowerCase() === currentUser.username.toLowerCase()) {
      document.getElementById('current-user-avatar').src = 'public/' + data.newAvatar;
      currentUser.avatar = data.newAvatar;
    }
  });
  
  socket.on('userJoined', (user) => {
    const existingUser = document.getElementById(`user-${user.id}`);
    if (existingUser) {
      const avatarElement = existingUser.querySelector('.userAvatar');
      if (avatarElement) {
        avatarElement.src = 'public/' + user.avatar;
      }
      
      const messages = document.querySelectorAll(`.messageWrapper:not(.myMessage) .userAvatar[alt="${user.username}"]`);
      messages.forEach(avatar => {
        avatar.src = 'public/' + user.avatar;
      });
      
      if (user.id === currentUser.id) {
        document.getElementById('current-user-avatar').src = 'public/' + user.avatar;
        currentUser.avatar = user.avatar;
      }
      
      createUserActivityToast(`${user.username} вернулся(ась) в чат`, user.avatar);
    } else {
      addUserToList(user);
      createUserActivityToast(`${user.username} присоединился(ась) к чату`, user.avatar);
    }
  });
  
  socket.on('userLeft', (user) => {
    removeUser(user.id);
    createUserActivityToast(`${user.username} покинул(а) чат`, user.avatar);
    
    typingUsers.delete(user.id);
    updateTypingIndicator();
  });
  
  socket.on('userTyping', (user) => {
    if (user.id !== currentUser.id) {
      typingUsers.add(user.id);
      updateTypingIndicator();
    }
  });
  
  socket.on('userStoppedTyping', (user) => {
    typingUsers.delete(user.id);
    updateTypingIndicator();
  });
  
  const currentUserAvatar = document.getElementById('current-user-avatar');
  if (currentUserAvatar) {
    currentUserAvatar.style.cursor = 'pointer';
    currentUserAvatar.title = 'Нажмите, чтобы изменить аватарку';
    
    currentUserAvatar.addEventListener('click', showAvatarSelector);
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
  console.log("Информационное окно отключено");
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

function completeLogin(username, tunnelUrl, isAdmin = false, isModerator = false) {
  let formattedUrl = tunnelUrl.trim();
  
  if (!formattedUrl.match(/^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+(:[0-9]+)?(\/.*)?$/)) {
    showConfirmModal(
      "Некорректный URL", 
      "Введенный URL имеет некорректный формат. Пример правильного формата: example.ngrok.io", 
      false
    );
    return;
  }
  
  const mainSocket = initializeSocket(formattedUrl);
  
  if (mainSocket) {
    showConfirmModal(
      `Подтвердите действие на ${formattedUrl}`,
      `Вы хотите подключиться к серверу как ${username}?`,
      true,
      () => {
        let userId = null;
        joinChat(mainSocket, username, userId, isAdmin, isModerator);
      }
    );
  }
}

function joinChat(socket, username, userId, isAdmin = false, isModerator = false) {
  const userData = {
    username: username,
    isAdmin: isAdmin,
    isModerator: isModerator
  };
  
  if (userId) {
    userData.id = userId;
  }
  
  console.log("Отправляем данные пользователя:", userData);
  
  socket.once('welcome', (data) => {
    console.log("Получено приветствие от сервера:", data);
    
    initChat(data);
  });
  
  socket.emit('join', userData);
  
  setTimeout(() => {
    if (document.getElementById('login-form').style.display !== 'none') {
      console.log("Не получено подтверждение входа, возможно проблема с подключением");
      showConfirmModal(
        "Проблема с подключением", 
        "Не удалось войти в чат. Проверьте URL сервера и попробуйте снова.", 
        false
      );
    }
  }, 5000);
}

function initializeSocket(ngrokUrl, isTemp = false) {
  try {
    if (typeof io === 'undefined') {
      console.error('Socket.IO library is not loaded');
      if (!isTemp) {
        showConfirmModal(
          "Ошибка инициализации", 
          "Библиотека Socket.IO не загружена. Проверьте подключение к интернету и перезагрузите страницу.", 
          false
        );
      }
      return null;
    }
    
    if (!ngrokUrl || ngrokUrl.trim() === '') {
      console.error('Empty URL provided');
      if (!isTemp) {
        showConfirmModal("Ошибка подключения", "Не указан URL сервера", false);
      }
      return null;
    }
    
    let socketUrl = ngrokUrl.trim();
    
    if (socketUrl.endsWith('/')) {
      socketUrl = socketUrl.slice(0, -1);
    }
    
    if (!socketUrl.startsWith('http://') && !socketUrl.startsWith('https://')) {
      socketUrl = `https://${socketUrl}`;
    }
    
    console.log(`Connecting to socket at ${socketUrl}`);
    
    if (socket && !isTemp) {
      socket.disconnect();
    }
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RETRY_ATTEMPTS,
      reconnectionDelay: 1000,
      timeout: 10000 
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      connectionAttempts = 0;
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      connectionAttempts++;
      
      if (connectionAttempts <= MAX_RETRY_ATTEMPTS) {
        console.log(`Retrying connection (${connectionAttempts}/${MAX_RETRY_ATTEMPTS})...`);
        setTimeout(() => {
          newSocket.connect();
        }, 2000);
      } else {
        if (!isTemp) {
          showConfirmModal(
            "Ошибка подключения", 
            `Не удалось подключиться к серверу по адресу ${socketUrl}. Проверьте URL и убедитесь, что сервер запущен.`, 
            false
          );
        }
      }
    });
    
    if (!isTemp) {
      socket = newSocket;
      setupChatEvents();
    }
    
    return newSocket;
  } catch (error) {
    console.error('Failed to initialize socket:', error);
    if (!isTemp) {
      showConfirmModal("Ошибка инициализации", "Произошла ошибка при инициализации соединения", false);
    }
    return null;
  }
}

function closeAllModals() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  const modals = [
    document.getElementById('confirm-action-modal'),
    document.getElementById('admin-confirm-modal'),
    document.getElementById('moderator-confirm-modal')
  ];
  modals.forEach(modal => {
    if (modal) modal.style.display = 'none';
  });
}

function showAdminConfirmModal(confirmCallback) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('admin-confirm-modal');
    const passwordInput = document.getElementById('admin-password-input');
    const cancelBtn = document.getElementById('admin-cancel-action');
    const confirmBtn = document.getElementById('admin-confirm-action');
    const overlay = document.getElementById('modal-overlay');

    overlay.style.display = 'block';

    passwordInput.value = '';

    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      cancelBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', handleConfirm);
      passwordInput.removeEventListener('keydown', keydownHandler);
      overlay.removeEventListener('click', closeModal);
    };

    const handleConfirm = () => {
      const password = passwordInput.value;
      if (password === ADMIN_PASSWORD) {
        if (confirmCallback) {
          confirmCallback();
        }
        closeModal();
      } else {
        closeModal();
        showConfirmModal("Неверный пароль", "Вы ввели неверный пароль администратора.", false);
      }
    };
    
    const keydownHandler = (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    };

    cancelBtn.removeEventListener('click', closeModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    passwordInput.removeEventListener('keydown', keydownHandler);
    overlay.removeEventListener('click', closeModal);

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    passwordInput.addEventListener('keydown', keydownHandler);
    overlay.addEventListener('click', closeModal);

    overlay.style.display = 'block';
    modal.style.display = 'block';
    passwordInput.focus();
  }, 0);
}

function showModeratorConfirmModal(confirmCallback) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('moderator-confirm-modal');
    const passwordInput = document.getElementById('moderator-password-input');
    const cancelBtn = document.getElementById('moderator-cancel-action');
    const confirmBtn = document.getElementById('moderator-confirm-action');
    const overlay = document.getElementById('modal-overlay');

    overlay.style.display = 'block';

    passwordInput.value = '';

    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      cancelBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', handleConfirm);
      passwordInput.removeEventListener('keydown', keydownHandler);
      overlay.removeEventListener('click', closeModal);
    };

    const handleConfirm = () => {
      const password = passwordInput.value;
      if (password === MODERATOR_PASSWORD) {
        if (confirmCallback) {
          confirmCallback();
        }
        closeModal();
      } else {
        closeModal();
        showConfirmModal("Неверный пароль", "Вы ввели неверный пароль модератора.", false);
      }
    };
    
    const keydownHandler = (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    };

    cancelBtn.removeEventListener('click', closeModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    passwordInput.removeEventListener('keydown', keydownHandler);
    overlay.removeEventListener('click', closeModal);

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    passwordInput.addEventListener('keydown', keydownHandler);
    overlay.addEventListener('click', closeModal);

    overlay.style.display = 'block';
    modal.style.display = 'block';
    passwordInput.focus();
  }, 0);
}

function showConfirmModal(title, message, showCancel = true, confirmCallback = null) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('confirm-action-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('cancel-action');
    const confirmBtn = document.getElementById('confirm-action');
    const overlay = document.getElementById('modal-overlay');
    
    overlay.style.display = 'block';
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    cancelBtn.style.display = showCancel ? 'block' : 'none';
    
    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      cancelBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', handleConfirm);
      overlay.removeEventListener('click', closeModal);
    };
    
    const handleConfirm = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (confirmCallback) {
        confirmCallback();
      }
      closeModal();
    };
    
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    cancelBtn.removeEventListener('click', closeModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    overlay.removeEventListener('click', closeModal);
    
    overlay.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }, 0);
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
    console.log('Соединение с интернетом восстановлено');
    createNotificationToast('Соединение с интернетом восстановлено');
    
    if (socket) {
      socket.connect();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('Соединение с интернетом потеряно');
    createNotificationToast('Соединение с интернетом потеряно');
    showConfirmModal(
      "Нет подключения к интернету", 
      "Проверьте ваше интернет-соединение для продолжения работы чата.", 
      false
    );
  });
  
  setupLoginForm();
  
  document.addEventListener('click', function(e) {
    if (activeMessageMenu && !e.target.closest('.message-context-menu') && !e.target.closest('.message-actions')) {
      closeMessageMenu();
    }
  });
});

function updateUserAvatar(newAvatarSrc) {
  if (!socket || !currentUser.username) return;
  
  const avatarPathForServer = newAvatarSrc.replace('public/', '');
  
  socket.emit('updateAvatar', {
    avatar: avatarPathForServer
  });
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
  let currentAvatars = [];
  let pagination = null;
  
  const AVATARS_PER_PAGE = 28;
  let currentPage = 1;

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

  function renderAvatars(avatars) {
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
    const totalPages = Math.ceil(avatars.length / AVATARS_PER_PAGE);
    let nonEmptyPages = [];
    for (let i = 1; i <= totalPages; i++) {
      const pageStart = (i - 1) * AVATARS_PER_PAGE;
      const pageEnd = pageStart + AVATARS_PER_PAGE;
      if (avatars.slice(pageStart, pageEnd).length > 0) {
        nonEmptyPages.push(i);
      }
    }
    if (nonEmptyPages.length === 0) nonEmptyPages = [1];
    if (!nonEmptyPages.includes(currentPage)) currentPage = nonEmptyPages[0] || 1;
    const startIdx = (currentPage - 1) * AVATARS_PER_PAGE;
    const endIdx = startIdx + AVATARS_PER_PAGE;
    const pageAvatars = avatars.slice(startIdx, endIdx);
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
        selectedAvatarSrc = avatarSrc;
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
        selectedAvatarSrc = avatarSrc;
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
            renderAvatars(currentAvatars);
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
  
  if (socket) {
    socket.emit('getAvatarCategories');
    socket.once('avatarCategories', (receivedCategories) => {
      console.log('Категории аватарок:', receivedCategories);
      const animals = receivedCategories['Animals'] || [];
      renderAvatars(animals);
    });
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
    if (selectedAvatarSrc !== null) {
      updateUserAvatar('public/' + selectedAvatarSrc);
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