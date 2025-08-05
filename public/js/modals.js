const ADMIN_PASSWORD = 'cul6768adm';
const MODERATOR_PASSWORD = 'cul7686mod';

let customTooltip = null;

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

function closeAllModals() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  const modals = [
    document.getElementById('confirm-action-modal'),
    document.getElementById('admin-confirm-modal'),
    document.getElementById('moderator-confirm-modal'),
    document.getElementById('attach-modal')
  ];
  modals.forEach(modal => {
    if (modal) modal.style.display = 'none';
  });
}

function showConfirmModal(title, message, showCancel = true, confirmCallback = null, keepOtherModals = false) {
  if (!keepOtherModals) {
    closeAllModals();
  }
  setTimeout(() => {
    const modal = document.getElementById('confirm-action-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('cancel-action');
    const confirmBtn = document.getElementById('confirm-action');
    const overlay = document.getElementById('modal-overlay');
    
    if (!keepOtherModals) {
      overlay.style.display = 'block';
    }
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    cancelBtn.style.display = showCancel ? 'block' : 'none';
    
    const closeModal = () => {
       modal.style.display = 'none';
       if (!keepOtherModals) {
         overlay.style.display = 'none';
       }
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
    
    if (!keepOtherModals) {
      overlay.style.display = 'block';
    }
    modal.style.display = 'block';
  }, 0);
}

function showAttachModal(title = "Прикрепить файл", message = "Выберите действие для прикрепления файлов", buttons = []) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('attach-modal');
    const titleEl = document.getElementById('attach-title');
    const messageEl = document.getElementById('attach-message');
    const actionsContainer = document.getElementById('attach-actions');
    const overlay = document.getElementById('modal-overlay');
    
    overlay.style.display = 'block';
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    actionsContainer.innerHTML = '';
    
         const defaultButtons = buttons.length > 0 ? buttons : [
       {
         text: '📁 Отправить файл',
         className: 'confirm-button primary',
         action: () => {
           attachFile();
         }
       },
       {
         text: 'Отмена',
         className: 'confirm-button',
         action: () => {
           closeModal();
         }
       }
     ];
    
    defaultButtons.forEach(buttonConfig => {
      const button = document.createElement('button');
      button.textContent = buttonConfig.text;
      button.className = buttonConfig.className;
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (buttonConfig.action) {
          buttonConfig.action();
        }
        closeModal();
      });
      actionsContainer.appendChild(button);
    });
    
    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      overlay.removeEventListener('click', closeModal);
    };
    
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    overlay.removeEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }, 0);
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