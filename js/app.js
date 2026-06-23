// app.js — 主应用逻辑

let characterData = [];
let currentLevel = 1;
let currentCharIndex = 0;
let currentLevelChars = [];
let writerAnimation = null;
let writerQuiz = null;

// 复习状态
let reviewChars = [];
let reviewIndex = 0;
let reviewResults = [];
let writerReviewQuiz = null;

// ===== 初始化 =====
async function init() {
  try {
    const resp = await fetch('data/characters.json');
    characterData = await resp.json();
  } catch (e) {
    console.error('Failed to load character data:', e);
    return;
  }

  // 初始化认证
  Auth.init();
  Auth.onLogin(() => {
    // 登录后刷新 dashboard
    if (document.getElementById('dashboard').classList.contains('active')) {
      renderDashboard();
    }
  });

  showDashboard();
}

// ===== 页面切换 =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0);
}

// ===== Dashboard =====
function showDashboard() {
  showPage('dashboard');
  renderDashboard();
}

function renderDashboard() {
  const grid = document.getElementById('level-grid');
  const progressBar = document.getElementById('overall-progress');
  const progressText = document.getElementById('progress-text');

  const overallProgress = Storage.getOverallProgress(characterData);
  progressBar.style.width = overallProgress + '%';
  progressText.textContent = overallProgress + '%';

  // 获取所有 level
  const levels = [...new Set(characterData.map(c => c.level))].sort((a, b) => a - b);

  grid.innerHTML = levels.map(level => {
    const chars = characterData.filter(c => c.level === level);
    const groupName = chars[0].groupName;
    const levelProgress = Storage.getLevelProgress(level, characterData);
    const isCompleted = levelProgress.learned === levelProgress.total && levelProgress.total > 0;

    const statusDots = chars.map(c => {
      const p = Storage.getCharProgress(c.char);
      return `<span class="status-dot ${p.status}" title="${c.char} - ${p.status}"></span>`;
    }).join('');

    return `
      <div class="level-card ${isCompleted ? 'completed' : ''}" onclick="enterLevel(${level})">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-sm text-gray-500 font-semibold">Day ${level}</div>
            <div class="text-base font-bold mt-1">${groupName}</div>
          </div>
          <div class="flex gap-1.5">${statusDots}</div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex gap-2 text-3xl char-display">
            ${chars.map(c => `<span>${c.char}</span>`).join('')}
          </div>
        </div>
        <div class="mt-3">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${levelProgress.total > 0 ? (levelProgress.learned / levelProgress.total * 100) : 0}%"></div>
          </div>
          <div class="text-xs text-gray-400 mt-1">${levelProgress.learned}/${levelProgress.total} ตัวอักษร</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 进入 Level =====
function enterLevel(level) {
  currentLevel = level;
  currentLevelChars = characterData.filter(c => c.level === level);
  currentCharIndex = 0;

  // 检查是否需要复习
  if (Review.needsReview(characterData, level)) {
    startReview(level);
  } else {
    showLearning();
  }
}

// ===== 复习关卡 =====
function startReview(level) {
  reviewChars = Review.getCharsToReview(characterData, level);
  reviewIndex = 0;
  reviewResults = [];
  showPage('review-page');
  renderReviewChar();
}

function renderReviewChar() {
  if (reviewIndex >= reviewChars.length) {
    showReviewSummary();
    return;
  }

  const charData = reviewChars[reviewIndex];
  const container = document.getElementById('review-content');

  container.innerHTML = `
    <div class="review-card">
      <div class="text-sm text-gray-500 mb-2">ทบทวน ${reviewIndex + 1}/${reviewChars.length}</div>
      <div class="text-lg mb-4 font-semibold">เขียนตัวอักษรนี้ให้ถูกต้อง</div>
      <div class="pinyin mb-2">${charData.pinyin}</div>
      <div class="thai-meaning mb-6">${charData.thai}</div>
      <div class="flex justify-center mb-4">
        <div class="grid-container" style="width:250px;height:250px;">
          <svg class="grid-lines" viewBox="0 0 250 250">
            <line x1="125" y1="0" x2="125" y2="250"/>
            <line x1="0" y1="125" x2="250" y2="125"/>
            <line x1="0" y1="0" x2="250" y2="250"/>
            <line x1="250" y1="0" x2="0" y2="250"/>
          </svg>
          <div id="review-quiz-target"></div>
        </div>
      </div>
      <div id="review-feedback" class="mt-4"></div>
    </div>
  `;

  // 清理旧的 writer
  if (writerReviewQuiz) {
    document.getElementById('review-quiz-target').innerHTML = '';
  }

  writerReviewQuiz = HanziWriter.create('review-quiz-target', charData.char, {
    width: 250,
    height: 250,
    padding: 5,
    showOutline: false,
    showCharacter: false,
    strokeColor: '#2c2c2c',
    highlightColor: '#c0392b',
    drawingWidth: 20,
    showHintAfterMisses: 3
  });

  writerReviewQuiz.quiz({
    onComplete: function(summary) {
      const correct = summary.totalMistakes === 0;
      reviewResults.push({ charData, correct, mistakes: summary.totalMistakes });
      Storage.recordQuizResult(charData.char, correct);

      const feedback = document.getElementById('review-feedback');
      if (correct) {
        feedback.innerHTML = `
          <div class="success-check">&#10003;</div>
          <div class="text-green-600 font-bold text-lg mt-2">ถูกต้อง!</div>
        `;
      } else {
        feedback.innerHTML = `
          <div class="review-result">&#10007;</div>
          <div class="text-red-600 font-bold text-lg mt-2">ผิด ${summary.totalMistakes} ขีด ลองใหม่นะ!</div>
        `;
      }

      setTimeout(() => {
        reviewIndex++;
        renderReviewChar();
      }, 1500);
    }
  });
}

function showReviewSummary() {
  const container = document.getElementById('review-content');
  const correctCount = reviewResults.filter(r => r.correct).length;

  container.innerHTML = `
    <div class="review-card">
      <div class="text-2xl font-bold mb-4">สรุปการทบทวน</div>
      <div class="text-5xl mb-4">${correctCount === reviewResults.length ? '&#127881;' : '&#128170;'}</div>
      <div class="text-lg mb-6">ถูก ${correctCount}/${reviewResults.length} ตัวอักษร</div>
      <div class="space-y-2 mb-6">
        ${reviewResults.map(r => `
          <div class="flex items-center justify-center gap-3">
            <span class="char-display text-2xl">${r.charData.char}</span>
            <span class="${r.correct ? 'text-green-600' : 'text-red-500'} font-bold">
              ${r.correct ? '&#10003; ถูกต้อง' : '&#10007; ผิด ' + r.mistakes + ' ขีด'}
            </span>
          </div>
        `).join('')}
      </div>
      <button class="nav-btn nav-btn-next" onclick="showLearning()">
        เรียนต่อ &#8594;
      </button>
    </div>
  `;
}

// ===== 学习页面 =====
function showLearning() {
  showPage('learning-page');
  renderLearning();
}

function renderLearning() {
  const charData = currentLevelChars[currentCharIndex];

  // 标记为学习中
  Storage.markAsLearning(charData.char);

  // 渲染字符 tabs
  const tabs = document.getElementById('char-tabs');
  tabs.innerHTML = currentLevelChars.map((c, i) => {
    const p = Storage.getCharProgress(c.char);
    const activeClass = i === currentCharIndex ? 'active' : '';
    const learnedClass = p.status !== 'new' ? 'learned' : '';
    return `<button class="char-tab char-display ${activeClass} ${learnedClass}" onclick="switchChar(${i})">${c.char}</button>`;
  }).join('');

  // 渲染 Level 标题
  document.getElementById('learning-level-title').textContent = `Day ${currentLevel} — ${charData.groupName}`;

  // 基础信息区
  document.getElementById('char-display').textContent = charData.char;
  document.getElementById('char-pinyin').textContent = charData.pinyin;
  document.getElementById('char-thai').textContent = charData.thai;

  // 字源演变区 — 时间轴
  renderEtymologyTimeline(charData);

  // 笔顺动画区
  const animTarget = document.getElementById('animation-target');
  animTarget.innerHTML = '';
  if (writerAnimation) writerAnimation = null;

  writerAnimation = HanziWriter.create('animation-target', charData.char, {
    width: 250,
    height: 250,
    padding: 5,
    strokeAnimationSpeed: 0.8,
    delayBetweenStrokes: 300,
    showOutline: true,
    strokeColor: '#2c2c2c',
    outlineColor: '#ddd'
  });

  // 手写练习区
  const quizTarget = document.getElementById('quiz-target');
  quizTarget.innerHTML = '';
  if (writerQuiz) writerQuiz = null;

  initQuizWriter(charData);

  // 更新导航按钮
  updateNavButtons();
}

function initQuizWriter(charData) {
  const quizTarget = document.getElementById('quiz-target');
  quizTarget.innerHTML = '';

  writerQuiz = HanziWriter.create('quiz-target', charData.char, {
    width: 250,
    height: 250,
    padding: 5,
    showOutline: false,
    showCharacter: false,
    strokeColor: '#2c2c2c',
    highlightColor: '#c0392b',
    drawingWidth: 20,
    showHintAfterMisses: 3
  });

  document.getElementById('quiz-feedback').innerHTML = '';
  document.getElementById('quiz-feedback').className = 'mt-3 text-center';

  writerQuiz.quiz({
    onComplete: function(summary) {
      const correct = summary.totalMistakes === 0;
      Storage.recordQuizResult(charData.char, correct);

      const feedback = document.getElementById('quiz-feedback');
      if (correct) {
        feedback.innerHTML = `<div class="success-check">&#10003;</div><div class="text-green-600 font-bold">ยอดเยี่ยม! เขียนถูกทุกขีด!</div>`;
      } else {
        feedback.innerHTML = `<div class="text-orange-500 font-bold">เขียนเสร็จแล้ว! ผิด ${summary.totalMistakes} ขีด ลองเขียนใหม่อีกครั้ง</div>`;
      }

      // 更新 tabs 状态
      renderCharTabs();
    }
  });
}

function renderCharTabs() {
  const tabs = document.getElementById('char-tabs');
  tabs.innerHTML = currentLevelChars.map((c, i) => {
    const p = Storage.getCharProgress(c.char);
    const activeClass = i === currentCharIndex ? 'active' : '';
    const learnedClass = p.status !== 'new' ? 'learned' : '';
    return `<button class="char-tab char-display ${activeClass} ${learnedClass}" onclick="switchChar(${i})">${c.char}</button>`;
  }).join('');
}

// ===== 字源时间轴 =====
let etymologyRevealedCount = 0;

function renderEtymologyTimeline(charData) {
  const container = document.getElementById('etymology-section');
  const stages = charData.etymology.stages;
  etymologyRevealedCount = 1; // 默认显示第一个阶段

  container.innerHTML = `
    <div class="etymology-timeline">
      <div class="timeline-stages" id="timeline-stages">
        ${stages.map((stage, i) => `
          <div class="timeline-stage ${i === 0 ? 'revealed' : 'hidden-stage'}" data-index="${i}">
            <div class="timeline-dot ${i === 0 ? 'active' : ''}"></div>
            ${i < stages.length - 1 ? '<div class="timeline-connector"></div>' : ''}
            <div class="timeline-content">
              <div class="timeline-period">${stage.period}</div>
              <div class="timeline-image-box">
                ${stage.image
                  ? `<img src="${stage.image}" alt="${stage.name}" class="timeline-img" onerror="this.parentElement.innerHTML='<span class=\\'char-display timeline-char-fallback\\'>${charData.char}</span>'">`
                  : `<span class="char-display timeline-char-modern">${charData.char}</span>`
                }
              </div>
              <div class="timeline-label">${stage.name}</div>
              <div class="timeline-label-th">${stage.nameTh}</div>
              <p class="timeline-desc">${stage.description}</p>
              <p class="timeline-desc-zh">${stage.descriptionZh}</p>
            </div>
          </div>
        `).join('')}
      </div>
      ${stages.length > 1 ? `
        <div class="text-center mt-4">
          <button id="btn-reveal-next" class="quiz-btn quiz-btn-primary" onclick="revealNextStage()">
            ดูขั้นตอนถัดไป &#8594;
          </button>
          <button id="btn-reveal-reset" class="quiz-btn quiz-btn-danger" onclick="resetTimeline()" style="display:none; margin-left:8px;">
            &#8634; ดูใหม่
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function revealNextStage() {
  const stages = document.querySelectorAll('.timeline-stage');
  if (etymologyRevealedCount < stages.length) {
    const stage = stages[etymologyRevealedCount];
    stage.classList.remove('hidden-stage');
    stage.classList.add('revealed');
    stage.querySelector('.timeline-dot').classList.add('active');

    // Animate connector
    const prevStage = stages[etymologyRevealedCount - 1];
    const connector = prevStage.querySelector('.timeline-connector');
    if (connector) connector.classList.add('filled');

    etymologyRevealedCount++;

    // Scroll stage into view
    stage.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    // If all revealed, switch button
    if (etymologyRevealedCount >= stages.length) {
      document.getElementById('btn-reveal-next').style.display = 'none';
      document.getElementById('btn-reveal-reset').style.display = '';
    }
  }
}

function resetTimeline() {
  const charData = currentLevelChars[currentCharIndex];
  renderEtymologyTimeline(charData);
}

// 播放笔顺动画
function playAnimation() {
  if (writerAnimation) {
    writerAnimation.animateCharacter();
  }
}

// 清除手写重写
function clearQuiz() {
  const charData = currentLevelChars[currentCharIndex];
  initQuizWriter(charData);
}

// 播放音频
function playAudio() {
  const charData = currentLevelChars[currentCharIndex];
  const audio = new Audio(charData.audio);
  audio.play().catch(e => {
    // fallback: Web Speech API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(charData.char);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  });
}

// 切换汉字
function switchChar(index) {
  currentCharIndex = index;
  renderLearning();
}

// 上一个/下一个汉字
function prevChar() {
  if (currentCharIndex > 0) {
    currentCharIndex--;
    renderLearning();
  }
}

function nextChar() {
  if (currentCharIndex < currentLevelChars.length - 1) {
    currentCharIndex++;
    renderLearning();
  }
}

// 完成当前 Level，回到 Dashboard
function finishLevel() {
  showDashboard();
}

// 更新导航按钮显示
function updateNavButtons() {
  const prevBtn = document.getElementById('btn-prev-char');
  const nextBtn = document.getElementById('btn-next-char');
  const finishBtn = document.getElementById('btn-finish-level');

  prevBtn.style.display = currentCharIndex > 0 ? '' : 'none';
  nextBtn.style.display = currentCharIndex < currentLevelChars.length - 1 ? '' : 'none';
  finishBtn.style.display = currentCharIndex === currentLevelChars.length - 1 ? '' : 'none';
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);
