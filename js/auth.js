// auth.js — 用户认证模块（Google 一键登录 + Firestore 云同步）

const Auth = {
  currentUser: null,
  _onLoginCallbacks: [],

  // 初始化：监听认证状态
  init() {
    auth.onAuthStateChanged(async (user) => {
      this.currentUser = user;
      this.updateUI();
      if (user) {
        await Storage.syncOnLogin(user.uid);
        // 通知回调（刷新界面数据）
        this._onLoginCallbacks.forEach(cb => cb());
      }
    });
  },

  // 注册登录后的回调
  onLogin(callback) {
    this._onLoginCallbacks.push(callback);
  },

  // Google 登录
  async signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      console.error('Login failed:', e);
    }
  },

  // 登出
  async signOut() {
    await auth.signOut();
    this.currentUser = null;
    this.updateUI();
  },

  // 是否应提示登录（学过 3 个以上汉字且未登录）
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
    const userMenu = document.getElementById('user-menu');

    if (this.currentUser) {
      loginBtn.style.display = 'none';
      userAvatar.style.display = 'block';
      userAvatar.querySelector('img').src = this.currentUser.photoURL || '';
      userAvatar.querySelector('img').alt = this.currentUser.displayName || '';
      document.getElementById('user-display-name').textContent = this.currentUser.displayName || '';
      document.getElementById('user-email').textContent = this.currentUser.email || '';
    } else {
      loginBtn.style.display = 'inline-block';
      userAvatar.style.display = 'none';
      if (userMenu) userMenu.style.display = 'none';
    }
  },

  // 切换用户菜单
  toggleMenu() {
    const menu = document.getElementById('user-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
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
