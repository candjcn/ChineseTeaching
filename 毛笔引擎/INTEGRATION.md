# 把毛笔笔锋接到现有书写练习区

思路：**HanziWriter 继续负责笔顺校验**（它判断每一笔对不对），
**BrushPen 负责把你手指划过的轨迹渲染成有笔锋的墨迹**。
最终格子里呈现的是“你自己写出来的毛笔字”，而笔顺仍然被严格校验。

只改 3 个地方。

---

## 1) `index.html`：引入引擎 + 加一层墨迹画布

在 `js/app.js` **之前**引入 brush.js：

```html
<!-- 放在 <script src="js/app.js"></script> 前面 -->
<script src="js/brush.js"></script>
```

在书写练习区，把 `#quiz-target` 那个 `.grid-container` 里补一层画布
（`.grid-container` 已经是 `position:relative`，直接叠加即可）：

```html
<div class="grid-container" style="width:250px;height:250px;">
  <svg class="grid-lines" viewBox="0 0 250 250"> ... 原样不动 ... </svg>
  <div id="quiz-target"></div>
  <!-- 新增：毛笔墨迹层，盖在最上面但不拦截手势 -->
  <canvas id="quiz-ink" style="position:absolute;inset:0;width:100%;height:100%;
          pointer-events:none;z-index:3;"></canvas>
</div>
```

> `pointer-events:none` 很关键：手势仍然落到 HanziWriter 的 SVG 上做校验，
> 我们只是“跟着画墨”。

---

## 2) `js/app.js`：替换 `initQuizWriter`

把原来的 `initQuizWriter(charData)` 整个换成下面这版。
改动点：① 隐藏 HanziWriter 自己那条等宽线和等宽成品笔画；
② 打开淡描红轮廓辅助；③ 用 BrushPen 实时画墨；
④ 用 `onCorrectStroke / onMistake` 决定这一笔的墨迹是留下还是丢弃。

```javascript
let quizPen = null;
let quizInkBound = false;

function initQuizWriter(charData) {
  const quizTarget = document.getElementById('quiz-target');
  quizTarget.innerHTML = '';

  // —— 毛笔墨迹层 ——
  const inkCanvas = document.getElementById('quiz-ink');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  inkCanvas.width = 250 * dpr;
  inkCanvas.height = 250 * dpr;
  if (!quizPen) {
    quizPen = new BrushPen(inkCanvas, {
      baseWidth: 24 * dpr, minWidth: 2 * dpr, maxWidth: 38 * dpr,
      taperStart: 12 * dpr, taperEnd: 20 * dpr,
      speedInfluence: 0.7, smoothing: 0.55
    });
  }
  quizPen.clear();

  // 一次性绑定手势：监听容器，不打断 HanziWriter
  if (!quizInkBound) {
    const container = inkCanvas.parentElement;
    const toCanvas = (e) => {
      const r = inkCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
    };
    let drawing = false;
    container.addEventListener('pointerdown', (e) => {
      drawing = true;
      const p = toCanvas(e);
      quizPen.start(p.x, p.y, e.pressure, Math.max(e.width||0, e.height||0)*dpr, e.timeStamp);
    });
    container.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of evs) {
        const p = toCanvas(ce);
        quizPen.move(p.x, p.y, ce.pressure, Math.max(ce.width||0, ce.height||0)*dpr, ce.timeStamp);
      }
    });
    const lift = () => { drawing = false; };   // 提笔后等 HanziWriter 判定
    container.addEventListener('pointerup', lift);
    container.addEventListener('pointercancel', lift);
    quizInkBound = true;
  }

  // —— HanziWriter：只做校验，墨迹交给 BrushPen ——
  writerQuiz = HanziWriter.create('quiz-target', charData.char, {
    width: 250, height: 250, padding: 5,
    showOutline: true, outlineColor: '#ece5d6',   // 淡描红轮廓，帮助找字形
    showCharacter: false,
    drawingColor: 'rgba(0,0,0,0)',   // 藏掉那条等宽拖拽线
    strokeColor: 'rgba(0,0,0,0)',    // 藏掉等宽成品笔画（改由毛笔墨迹呈现）
    highlightColor: '#c0392b',
    drawingWidth: 4,
    showHintAfterMisses: 3
  });

  document.getElementById('quiz-feedback').innerHTML = '';
  document.getElementById('quiz-feedback').className = 'mt-3 text-center';

  writerQuiz.quiz({
    onCorrectStroke: () => { quizPen.commitStroke(); },  // 这一笔对 → 留下墨迹
    onMistake:       () => { quizPen.cancelStroke(); },  // 这一笔错 → 抹掉墨迹
    onComplete: function (summary) {
      const correct = summary.totalMistakes === 0;
      Storage.recordQuizResult(charData.char, correct);
      const feedback = document.getElementById('quiz-feedback');
      if (correct) {
        feedback.innerHTML = `<div class="success-check">&#10003;</div><div class="text-green-600 font-bold">ยอดเยี่ยม! เขียนถูกทุกขีด!</div>`;
      } else {
        feedback.innerHTML = `<div class="text-orange-500 font-bold">เขียนเสร็จแล้ว! ผิด ${summary.totalMistakes} ขีด ลองเขียนใหม่อีกครั้ง</div>`;
      }
      renderCharTabs();
    }
  });
}
```

---

## 3) `js/app.js`：`clearQuiz` 顺便清掉墨迹

```javascript
function clearQuiz() {
  if (quizPen) quizPen.clear();   // 新增
  initQuizWriter(charData);       // 你原来的逻辑
}
```

---

## 调参

`brush_demo.html` 里滑出你满意的那组数值后，把它填进
`new BrushPen(inkCanvas, { ... })` 的初始化参数即可（注意带 `*dpr` 的几个是像素量纲，
按 demo 数值乘 `dpr`；`speedInfluence / smoothing` 不用乘）。

## 想要“自由临摹”模式（不校验笔顺，纯练美感）

`brush_demo.html` 的 `stage` 那段（两层 canvas + 指针事件 + drawPaper 引导字）
就是一个独立临摹组件，把它做成一个 tab，用 `charData.char` 当引导字即可，
和现在的笔顺测验并列，给用户“先描红、再默写”的节奏。
