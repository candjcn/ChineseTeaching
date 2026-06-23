// storage.js — localStorage + Firestore 双写封装，管理学习进度

const Storage = {
  PROGRESS_KEY: 'charProgress',
  LEVEL_KEY: 'levelProgress',
  _uid: null,

  // 获取所有进度数据
  getAllProgress() {
    const data = localStorage.getItem(this.PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
  },

  // 保存所有进度（同时写 localStorage 和 Firestore）
  _saveAll(all) {
    localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(all));
    if (this._uid) {
      this._saveToCloud(this._uid, all);
    }
  },

  // 获取单个汉字的进度
  getCharProgress(char) {
    const all = this.getAllProgress();
    return all[char] || {
      status: 'new',
      correctStreak: 0,
      quizHistory: [],
      nextReviewDate: null
    };
  },

  // 保存单个汉字的进度
  saveCharProgress(char, progress) {
    const all = this.getAllProgress();
    all[char] = progress;
    this._saveAll(all);
  },

  // 标记汉字为"已学习"
  markAsLearning(char) {
    const progress = this.getCharProgress(char);
    if (progress.status === 'new') {
      progress.status = 'learning';
      this.saveCharProgress(char, progress);
    }
  },

  // 记录 quiz 结果
  recordQuizResult(char, correct) {
    const progress = this.getCharProgress(char);
    const today = new Date().toISOString().split('T')[0];

    progress.quizHistory.push({ date: today, correct });

    if (correct) {
      progress.correctStreak++;
      if (progress.correctStreak >= 3) {
        progress.status = 'mastered';
      } else {
        progress.status = 'learning';
      }
    } else {
      progress.correctStreak = 0;
      progress.status = 'learning';
    }

    progress.nextReviewDate = this.calcNextReviewDate(progress.correctStreak);
    this.saveCharProgress(char, progress);
    return progress;
  },

  // 计算下次复习日期
  calcNextReviewDate(correctStreak) {
    const intervals = [1, 3, 7, 14, 30];
    const idx = Math.min(correctStreak, intervals.length - 1);
    const days = intervals[idx];
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  },

  // 获取某个 level 是否已完成
  isLevelCompleted(level, characters) {
    const levelChars = characters.filter(c => c.level === level);
    return levelChars.every(c => {
      const p = this.getCharProgress(c.char);
      return p.status === 'learning' || p.status === 'mastered';
    });
  },

  // 获取总体进度百分比
  getOverallProgress(characters) {
    const all = this.getAllProgress();
    let learned = 0;
    characters.forEach(c => {
      const p = all[c.char];
      if (p && (p.status === 'learning' || p.status === 'mastered')) {
        learned++;
      }
    });
    return Math.round((learned / characters.length) * 100);
  },

  // 获取某个 level 的进度
  getLevelProgress(level, characters) {
    const levelChars = characters.filter(c => c.level === level);
    let learned = 0;
    levelChars.forEach(c => {
      const p = this.getCharProgress(c.char);
      if (p.status === 'learning' || p.status === 'mastered') {
        learned++;
      }
    });
    return { learned, total: levelChars.length };
  },

  // 清除所有进度
  clearAll() {
    localStorage.removeItem(this.PROGRESS_KEY);
    localStorage.removeItem(this.LEVEL_KEY);
  },

  // ---- Firestore 云同步 ----

  async _loadFromCloud(uid) {
    try {
      const snap = await db.collection('chinese_users').doc(uid).get();
      return snap.exists ? snap.data().charProgress || {} : null;
    } catch (e) {
      console.warn('Cloud load failed:', e);
      return null;
    }
  },

  _saveToCloud(uid, data) {
    db.collection('chinese_users').doc(uid).set(
      { charProgress: data },
      { merge: true }
    ).catch(e => console.warn('Cloud save failed:', e));
  },

  // 合并本地和云端数据（取最优值）
  _mergeData(local, cloud) {
    if (!cloud) return local;
    if (!local) return cloud;

    const merged = { ...cloud };

    for (const [char, localProgress] of Object.entries(local)) {
      const cloudProgress = merged[char];
      if (!cloudProgress) {
        merged[char] = localProgress;
      } else {
        // 取更高成就的
        if (localProgress.status === 'mastered' ||
            (localProgress.status === 'learning' && cloudProgress.status === 'new')) {
          merged[char] = localProgress;
        } else if (localProgress.correctStreak > cloudProgress.correctStreak) {
          merged[char] = localProgress;
        }
        // 合并 quiz history
        const allHistory = [...(cloudProgress.quizHistory || []), ...(localProgress.quizHistory || [])];
        // 去重（按 date + correct 组合）
        const seen = new Set();
        merged[char].quizHistory = allHistory.filter(h => {
          const key = h.date + ':' + h.correct;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    return merged;
  },

  // 登录后调用：合并本地与云端数据
  async syncOnLogin(uid) {
    this._uid = uid;
    const local = this.getAllProgress();
    const cloud = await this._loadFromCloud(uid);
    const merged = this._mergeData(local, cloud);
    localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(merged));
    // 写回云端
    try {
      await db.collection('chinese_users').doc(uid).set({ charProgress: merged });
    } catch (e) {
      console.warn('Cloud sync failed:', e);
    }
  },
};
