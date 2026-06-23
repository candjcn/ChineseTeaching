// auth.js — 用户认证模块（Google 一键登录 + Firestore 云同步）

const Auth = {
  currentUser: null,
  _onLoginCallbacks: [],

  // 初始化：监听认证状态
  init() {
    // 检查是否有 redirect 登录结果
    auth.getRedirectResult().then((result) => {
      if (result && result.user) {
        console.log('[Auth] redirect login success:', result.user.email);
      }
    }).catch((e) => {
      console.error('[Auth] redirect result error:', e.code, e.message);
    });

    auth.onAuthStateChanged((user) => {
      console.log('[Auth] state changed:', user ? user.email : 'null');
      this.currentUser = user;
      this.updateUI();
      if (user) {
        Storage.syncOnLogin(user.uid).then(() => {
          this._onLoginCallbacks.forEach(cb => cb());
        }).catch(e => console.warn('[Auth] sync error:', e));
      }
    });
  },

  // 注册登录后的回调
  onLogin(callback) {
    this._onLoginCallbacks.push(callback);
  },

  // Google 登录（先尝试弹窗，失败则用重定向）
  signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
      console.log('[Auth] popup login success:', result.user.email);
    }).catch((e) => {
      console.warn('[Auth] popup failed, trying redirect:', e.code, e.message);
      // 弹窗失败时自动回退到重定向方式
      auth.signInWithRedirect(provider);
    });
  },

  // 登出
  signOut() {
    auth.signOut().then(() => {
      this.currentUser = null;
      this.updateUI();
    });
  },

  // 是否应提示登录
  shouldPromptLogin() {
    if (this.currentUser) return false;
    const all = Storage.getAllProgress();
    const learnedCount = Object.values(all).filter(
      p => p.status === 'learning' || p.status === 'mastered'
    ).length;
    return learnedCount >= 3;
  },

  // 更新导航栏 UI
  updateUI() {
    const loginBtn = document.getElementById('login-btn');
    const userAvatar = document.getElementById('user-avatar');

    if (!loginBtn || !userAvatar) return;

    if (this.currentUser) {
      loginBtn.style.display = 'none';
      userAvatar.style.display = 'block';
      const img = userAvatar.querySelector('img');
      if (img) {
        img.src = this.currentUser.photoURL || '';
        img.alt = this.currentUser.displayName || '';
      }
      const nameEl = document.getElementById('user-display-name');
      const emailEl = document.getElementById('user-email');
      if (nameEl) nameEl.textContent = this.currentUser.displayName || '';
      if (emailEl) emailEl.textContent = this.currentUser.email || '';
    } else {
      loginBtn.style.display = 'inline-block';
      userAvatar.style.display = 'none';
      const userMenu = document.getElementById('user-menu');
      if (userMenu) userMenu.style.display = 'none';
    }
  },

  // 切换用户菜单
  toggleMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
  },

  // 显示登录弹窗
  showLoginPrompt() {
    document.getElementById('login-modal').style.display = 'flex';
  },

  // 关闭登录弹窗
  hideLoginPrompt() {
    document.getElementById('login-modal').style.display = 'none';
  },
};
