/*
 * brush.js — 毛笔/硬笔 书写引擎 (BrushPen)
 * 纯 Canvas 实现，无依赖。用 <script src="js/brush.js"></script> 引入，
 * 全局暴露 window.BrushPen。
 *
 * 核心：把指针轨迹渲染成「变宽 + 起收笔出锋」的墨迹。
 *   - 宽度 = f(速度, 压力)：慢则粗、快则细；有真实压感(笔)则叠加。
 *   - 起笔/收笔自动收尖（笔锋）。
 *   - 路径与宽度都做平滑，避免抖动。
 *
 * 用法：
 *   const pen = new BrushPen(canvasEl, { baseWidth: 26 });
 *   绑定 pointer 事件后调用 pen.start/move/end（见 demo / 集成片段）。
 */
(function (global) {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  const DEFAULTS = {
    mode: 'brush',        // 'brush' 毛笔(有锋, 速度敏感) | 'pen' 硬笔(基本等宽)
    color: '#1a1a1a',
    baseWidth: 26,        // 中性速度下的笔画宽度(px)
    minWidth: 2,          // 最细(快速甩笔/出锋尖端)
    maxWidth: 40,         // 最粗(重顿)
    speedInfluence: 0.7,  // 速度对粗细的影响 0~1（毛笔感主要来自这里）
    pressureInfluence: 0.5, // 真实压感的影响 0~1（手指无压感时自动忽略）
    smoothing: 0.55,      // 路径平滑 0~1
    widthSmoothing: 0.5,  // 宽度平滑 0~1
    taperStart: 14,       // 起笔收尖长度(px)
    taperEnd: 22,         // 收笔出锋长度(px)
    vMax: 2.2,            // 速度归一化上限(px/ms)，越小越容易"甩细"
    inkBleed: 0.0         // 0~1 轻微墨晕(阴影模糊)，0 关闭
  };

  class BrushPen {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opt = Object.assign({}, DEFAULTS, opts);
      // committed 离屏画布：已完成的笔画
      this.committed = document.createElement('canvas');
      this.cctx = this.committed.getContext('2d');
      this.strokes = [];        // 已完成笔画的原始点（用于撤销重绘）
      this.raw = null;          // 当前笔画原始点
      this._sx = 0; this._sy = 0; // 平滑后位置
      this._syncSize();
    }

    setOption(k, v) { this.opt[k] = v; }
    setOptions(o) { Object.assign(this.opt, o); }

    _syncSize() {
      // 适配高 DPI：canvas.width/height 由外部按 dpr 设好；这里只同步离屏尺寸
      this.committed.width = this.canvas.width;
      this.committed.height = this.canvas.height;
    }

    clear() {
      this.strokes = [];
      this.raw = null;
      this.cctx.clearRect(0, 0, this.committed.width, this.committed.height);
      this._blit();
    }

    undo() {
      if (this.strokes.length === 0) return;
      this.strokes.pop();
      this.cctx.clearRect(0, 0, this.committed.width, this.committed.height);
      for (const s of this.strokes) this._renderStroke(this.cctx, s);
      this._blit();
    }

    isEmpty() { return this.strokes.length === 0; }

    // 丢弃当前还没提交的笔画（用于 HanziWriter 判错时）
    cancelStroke() {
      this.raw = null;
      this._blit();
    }

    // 提交当前笔画（等价于 end，用于 HanziWriter 判对时语义更清晰）
    commitStroke() { this.end(); }

    // 把已完成画布拷到可见画布，再叠当前笔画
    _blit() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.committed, 0, 0);
    }

    start(x, y, pressure, size, time) {
      this._sx = x; this._sy = y;
      this.raw = [{ x, y, p: pressure || 0, s: size || 0, t: time || performance.now() }];
      this._blit();
    }

    move(x, y, pressure, size, time) {
      if (!this.raw) return;
      // 位置 EMA 平滑
      const a = 1 - this.opt.smoothing;
      this._sx = lerp(this._sx, x, a);
      this._sy = lerp(this._sy, y, a);
      const last = this.raw[this.raw.length - 1];
      // 太近的点跳过，避免抖动堆积
      if (dist(this._sx, this._sy, last.x, last.y) < 0.6) return;
      this.raw.push({ x: this._sx, y: this._sy, p: pressure || 0, s: size || 0, t: time || performance.now() });
      // 实时：committed + 当前笔画
      this._blit();
      this._renderStroke(this.ctx, this.raw);
    }

    end() {
      if (!this.raw) return;
      if (this.raw.length >= 2) {
        this.strokes.push(this.raw);
        this._renderStroke(this.cctx, this.raw);
      } else if (this.raw.length === 1) {
        // 单点：画一个小墨点
        const r = this.opt.baseWidth * 0.35;
        this._dot(this.cctx, this.raw[0].x, this.raw[0].y, r);
        this.strokes.push(this.raw);
      }
      this.raw = null;
      this._blit();
    }

    // ---- 把一串原始点算成 {x,y,w} 并渲染成变宽墨带 ----
    _computeWidths(pts) {
      const o = this.opt;
      const usablePressure = pts.some(q => q.p > 0 && q.p !== 0.5);
      const out = [];
      let prevW = null;
      // 累计弧长，用于起/收笔出锋
      let arc = [0];
      for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + dist(pts[i].x, pts[i].y, pts[i - 1].x, pts[i - 1].y));
      const total = arc[arc.length - 1] || 1;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        // 瞬时速度
        let v = 0;
        if (i > 0) {
          const dt = Math.max(8, p.t - pts[i - 1].t); // ms，下限避免爆炸
          v = dist(p.x, p.y, pts[i - 1].x, pts[i - 1].y) / dt;
        }
        const vNorm = clamp(v / o.vMax, 0, 1);
        // 速度因子：快 → 细
        let speedFactor = o.mode === 'pen'
          ? 1 - vNorm * 0.15
          : 1 - vNorm * o.speedInfluence;
        // 压力因子：有真实压感才用；手指用接触面积 size 兜底
        let pFactor = 1;
        if (o.mode === 'brush') {
          if (usablePressure) {
            pFactor = lerp(1, clamp(p.p, 0, 1) * 1.6, o.pressureInfluence);
          } else if (p.s > 0) {
            const sNorm = clamp(p.s / 40, 0, 1); // 接触直径粗略归一
            pFactor = lerp(1, 0.7 + sNorm * 0.9, o.pressureInfluence * 0.6);
          }
        }
        let w = o.baseWidth * speedFactor * pFactor;
        w = clamp(w, o.minWidth, o.maxWidth);
        // 宽度 EMA 平滑
        if (prevW !== null) w = lerp(prevW, w, 1 - o.widthSmoothing);
        prevW = w;

        // 起笔出锋：弧长 < taperStart 时收尖
        if (o.mode === 'brush' && arc[i] < o.taperStart) {
          const k = arc[i] / o.taperStart; // 0→1
          w *= 0.15 + 0.85 * easeOut(k);
        }
        // 收笔出锋：距末端 < taperEnd 时收尖
        const fromEnd = total - arc[i];
        if (o.mode === 'brush' && fromEnd < o.taperEnd) {
          const k = fromEnd / o.taperEnd; // 1→0
          w *= 0.08 + 0.92 * easeOut(k);
        }
        out.push({ x: p.x, y: p.y, w: Math.max(w, 0.4) });
      }
      return out;
    }

    _renderStroke(ctx, rawPts) {
      if (!rawPts || rawPts.length === 0) return;
      const pts = this._computeWidths(rawPts);
      ctx.save();
      ctx.fillStyle = this.opt.color;
      if (this.opt.inkBleed > 0) {
        ctx.shadowColor = this.opt.color;
        ctx.shadowBlur = this.opt.inkBleed * 3;
      }
      if (pts.length === 1) { this._dot(ctx, pts[0].x, pts[0].y, pts[0].w / 2); ctx.restore(); return; }

      // 逐段填充梯形墨带 + 端点圆补，形成连续可变宽度的笔画
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        let dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        const nx = -dy, ny = dx; // 法线
        const aw = a.w / 2, bw = b.w / 2;
        ctx.beginPath();
        ctx.moveTo(a.x + nx * aw, a.y + ny * aw);
        ctx.lineTo(b.x + nx * bw, b.y + ny * bw);
        ctx.lineTo(b.x - nx * bw, b.y - ny * bw);
        ctx.lineTo(a.x - nx * aw, a.y - ny * aw);
        ctx.closePath();
        ctx.fill();
        // 圆补关节，转弯处不出现棱角
        ctx.beginPath();
        ctx.arc(b.x, b.y, bw, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _dot(ctx, x, y, r) {
      ctx.save();
      ctx.fillStyle = this.opt.color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(r, 0.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  global.BrushPen = BrushPen;
})(typeof window !== 'undefined' ? window : this);
