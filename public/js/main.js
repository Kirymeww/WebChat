// ======== Применение темы ========
function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  
  const singleColorThemes = [
    'ruby-fire', 'orange-sunset', 'golden-sun', 'emerald-forest', 
    'azure-sky', 'royal-indigo', 'violet-amethyst'
  ];
  const multiColorThemes = [
    'aurora-borealis', 'ocean-depths', 'tropical-sunset', 'lavender-fields',
    'spring-garden', 'copper-antique', 'arctic-aurora', 'cherry-blossom',
    'lunar-symphony', 'desert-mirage', 'neon-dreams', 'crimson-sunset'
  ];
  
  if (singleColorThemes.includes(themeName)) {
    localStorage.setItem('savedSingleColorTheme', themeName);
    localStorage.setItem('activeThemeCategory', 'single');
  } else if (multiColorThemes.includes(themeName)) {
    localStorage.setItem('savedMultiColorTheme', themeName);
    localStorage.setItem('activeThemeCategory', 'multi');
  }
  
  localStorage.setItem('savedTheme', themeName);
  
  const customSelectTrigger = document.getElementById('custom-select-trigger');
  if (customSelectTrigger) {
    const selectedOption = document.querySelector(`.custom-option[data-value="${themeName}"]`);
    if (selectedOption) {
      customSelectTrigger.querySelector('span').textContent = selectedOption.textContent;
      
      document.querySelectorAll('.custom-option.selected').forEach(el => el.classList.remove('selected'));
      selectedOption.classList.add('selected');
    }
  }
}

// ======== Сохранение имени пользователя и темы ========
function saveUsernameAndTheme(username, theme) {
  localStorage.setItem('savedUsername', username);
  localStorage.setItem('savedTheme', theme);
}

// ======== Инициализация приложения ========
function initApp() {
  const activeCategory = localStorage.getItem('activeThemeCategory');
  let savedTheme = null;
  
  if (activeCategory === 'single') {
    savedTheme = localStorage.getItem('savedSingleColorTheme');
  } else if (activeCategory === 'multi') {
    savedTheme = localStorage.getItem('savedMultiColorTheme');
  }
  
  if (!savedTheme) {
    savedTheme = localStorage.getItem('savedTheme');
  }
  
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme('violet-amethyst');
  }
}

// ======== Показать модальное окно с оверлеем ========
function showModalWithOverlay(modal) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'block';
  modal.style.display = 'block';
}

// ======== Скрыть модальное окно с оверлеем ========
function hideModalWithOverlay(modal) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  modal.style.display = 'none';
}

// ======== Настройка селектора тем ========
function setupThemeSelector() {
}

// ======== Настройка модальных окон ========
function setupModals() {
  const overlay = document.getElementById('modal-overlay');
  const confirmModal = document.getElementById('confirm-action-modal');
  const settingsModal = document.getElementById('settings-modal');
  const settingsButton = document.getElementById('settings-button');
  const settingsCloseButton = document.getElementById('settings-close-button');

  window.showModalWithOverlay = showModalWithOverlay;
  window.hideModalWithOverlay = hideModalWithOverlay;
  
  document.getElementById('confirm-action').addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  document.getElementById('cancel-action').addEventListener('click', function(e) {
    e.stopPropagation();
    hideModalWithOverlay(confirmModal);
  });
  
  confirmModal.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  if (settingsButton) {
    settingsButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.showSettingsModal) {
        window.showSettingsModal();
      } else {
        showModalWithOverlay(settingsModal);
      }
    });
  }

  if (settingsCloseButton) {
    settingsCloseButton.addEventListener('click', () => {
      hideModalWithOverlay(settingsModal);
    });
  }
  
  if (settingsModal) {
    settingsModal.addEventListener('click', e => e.stopPropagation());
  }
  
  overlay.addEventListener('click', function() {
    hideModalWithOverlay(confirmModal);
    if (settingsModal) {
      hideModalWithOverlay(settingsModal);
    }
  });
}

// ======== Анимация иконки приложения ========
function setupAppIconAnimation() {
  const appIcon = document.querySelector('.appIcon');
  if (!appIcon) return;

  appIcon.addEventListener('mouseenter', () => {
    appIcon.classList.add('fading');
    setTimeout(() => {
      appIcon.style.webkitMaskImage = "url('public/Images/amogus.png')";
      appIcon.style.maskImage = "url('public/Images/amogus.png')";
      appIcon.style.webkitMaskPosition = '4px 0';
      appIcon.style.maskPosition = '4px 0';
      appIcon.classList.remove('fading');
    }, 200);
  });
  
  appIcon.addEventListener('mouseleave', () => {
    appIcon.classList.add('fading');
    setTimeout(() => {
      appIcon.style.webkitMaskImage = "url('public/Images/frame.png')";
      appIcon.style.maskImage = "url('public/Images/frame.png')";
      appIcon.style.webkitMaskPosition = 'center';
      appIcon.style.maskPosition = 'center';
      appIcon.classList.remove('fading');
    }, 200);
  });
}

// ======== Управление локальным хранилищем ========
function loadSavedData() {
  const savedUser = localStorage.getItem('savedUser');
  if (savedUser) {
    const userInput = document.getElementById('user-input');
    if (userInput) userInput.value = savedUser;
  }
  
  const savedUsername = localStorage.getItem('savedUsername');
  if (savedUsername) {
    const usernameInput = document.getElementById('username-input');
    if (usernameInput) usernameInput.value = savedUsername;
  }
  
  const savedServerUrl = localStorage.getItem('savedServerUrl');
  if (savedServerUrl) {
    const tunnelUrlInput = document.getElementById('tunnel-url');
    if (tunnelUrlInput) tunnelUrlInput.value = savedServerUrl;
  }
  
  const savedTheme = localStorage.getItem('savedTheme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) themeSelector.value = savedTheme;
  }
}

// ======== Настройка формы входа ========
function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', function() {
    const userInput = document.getElementById('user-input');
    if (userInput && userInput.value) {
      localStorage.setItem('savedUser', userInput.value.trim());
    }
    
    const usernameInput = document.getElementById('username-input');
    if (usernameInput && usernameInput.value) {
      localStorage.setItem('savedUsername', usernameInput.value.trim());
    }
    
    const tunnelUrlInput = document.getElementById('tunnel-url');
    if (tunnelUrlInput && tunnelUrlInput.value) {
      localStorage.setItem('savedServerUrl', tunnelUrlInput.value.trim());
    }
  });
}

// ======== Инициализация при загрузке DOM ========
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupModals();
  setupThemeSelector();
  setupAppIconAnimation();
  loadSavedData();
  setupLoginForm();
  
  if (window.initNotificationSystem) {
    window.initNotificationSystem();
  }
  
  if (window.initThemeSwitcher) {
    window.initThemeSwitcher();
  }
  
  window.applyTheme = applyTheme;
}); 