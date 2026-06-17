// storage.js — localStorage 封装，管理学习进度
// 未来可替换为后端 API，只需修改此模块

const Storage = {
  PROGRESS_KEY: 'charProgress',
  LEVEL_KEY: 'levelProgress',

  // 获取所有进度数据
  getAllProgress() {
    const data = localStorage.getItem(this.PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
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
    localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(all));
  },

  // 标记汉字为"已学习"（首次进入学习卡片时调用）
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

  // 计算下次复习日期（简化版间隔重复）
  calcNextReviewDate(correctStreak) {
    const intervals = [1, 3, 7, 14, 30]; // 天数
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

  // 清除所有进度（调试用）
  clearAll() {
    localStorage.removeItem(this.PROGRESS_KEY);
    localStorage.removeItem(this.LEVEL_KEY);
  }
};
