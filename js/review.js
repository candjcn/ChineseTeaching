// review.js — 复习关卡逻辑

const Review = {
  // 获取需要复习的汉字列表
  getCharsToReview(characters, currentLevel, count = 3) {
    const today = new Date().toISOString().split('T')[0];
    const candidates = [];

    // 从比当前 level 低的所有已学汉字中筛选
    characters.forEach(c => {
      if (c.level >= currentLevel) return;
      const progress = Storage.getCharProgress(c.char);
      if (progress.status === 'new') return;

      // 优先级：learning > mastered，到期的优先
      const isOverdue = progress.nextReviewDate && progress.nextReviewDate <= today;
      const priority = (progress.status === 'learning' ? 100 : 0) + (isOverdue ? 50 : 0);

      candidates.push({
        charData: c,
        progress,
        priority,
        isOverdue
      });
    });

    // 按优先级排序，取前 count 个
    candidates.sort((a, b) => b.priority - a.priority);

    // 如果优先候选不足，随机补充
    if (candidates.length <= count) {
      return candidates.map(c => c.charData);
    }

    // 取前 count 个高优先级的
    return candidates.slice(0, count).map(c => c.charData);
  },

  // 判断某个 level 是否需要复习
  needsReview(characters, currentLevel) {
    if (currentLevel <= 1) return false;
    const reviewChars = this.getCharsToReview(characters, currentLevel);
    return reviewChars.length > 0;
  }
};
