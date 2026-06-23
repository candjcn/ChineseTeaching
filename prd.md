
# 产品需求文档 (PRD)：30 个基础汉字启蒙交互式 Web 应用

## 1. 项目概述 (Project Overview)

* **应用名称：** 30 Chinese Characters Master（30个基础汉字轻松学）
* **目标用户：** 零基础、想学习汉字读写的泰国学生（界面语言采用**泰语**作为辅助提示）
* **核心功能：** 帮助学生在 10 天内掌握 30 个核心象形文字的**音（Pinyin/音频）、形（演变图）、意（泰语翻译）、写（动态笔顺/线上手写）**，并通过间隔复习机制巩固记忆
* **技术栈：** HTML5, CSS3 (Tailwind CSS), Pure JavaScript（无重度框架，方便轻量化部署）
* **核心第三方库：** 必须集成 **Hanzi Writer (JavaScript Library)** 用于实现汉字笔顺动画与手写练习

---

## 2. 核心架构与页面流 (Architecture & Page Flow)

应用采用单页应用 (SPA) 设计，包含以下核心界面：

### 页面 A：学习主控台 (Learning Dashboard)

* **功能：** 展示学习进度与各汉字掌握状态
* **UI 布局：**
  * 顶部：应用标题 + 总体学习进度条 (Progress Bar)
  * 中部：10 个卡片（代表 10 个 Level），每个 Level 包含 3 个汉字
  * 每个卡片上显示 3 个汉字的掌握状态圆点：
    * 灰色圆点 → 未学习 (new)
    * 橙色圆点 → 学习中 (learning)
    * 绿色圆点 → 已掌握 (mastered)
  * 交互：点击某个 Level 的卡片，进入对应的学习界面

### 页面 B：复习关卡 (Review Gate)

* **触发时机：** 从 Level 2 开始，每次进入新 Level 前自动触发
* **功能：** 从已学汉字中抽取需要复习的字进行笔顺 quiz 测试
* **规则：**
  * 随机抽取 3 个需要复习的字（优先选择 status 为 learning 的、nextReviewDate 已到期的）
  * 复习形式：Hanzi Writer 的 quiz 模式（手写笔顺）
  * 写对 → 更新连胜次数、推迟下次复习日期
  * 写错 → 退回 learning 状态，重置连胜
  * **不阻止进入新内容**——复习完成后（无论对错）直接进入当天新字学习，避免挫败感
* **如果没有需要复习的字（如 Level 1），则跳过此页面**

### 页面 C：汉字互动学习卡片 (Interactive Character Card)

* **功能：** 核心教学多媒体页面，每个汉字独立展示，包含以下四个区块：
  1. **基础信息区：** 汉字（特大字号）、Pinyin（带声调）、泰语释义、**音频播放按钮**（喇叭图标）
  2. **字源演变区：** 展示该汉字从古到今 2-3 个阶段的演变（如甲骨文 → 篆书 → 现代汉字），加深形象记忆
  3. **笔顺动画区：** Hanzi Writer 渲染的米字格，支持自动播放和手动逐笔点击播放笔顺动画
  4. **手写练习区 (Interactive Canvas)：** 带有米字格的画布，支持鼠标（PC）或手指/触控笔（平板/手机）进行手写练习。Hanzi Writer 自动判断笔顺正确性。写错后提供**整体清除重写**按钮（不支持逐笔撤销）

---

## 3. 详细功能技术规格 (Technical Specifications)

### 3.1 汉字数据架构 (Data Structure)

汉字数据存放在独立的 `characters.json` 文件中（不要内联在 JS 代码里），方便未来扩展到 100/300/1000 字时只需增加数据、不改代码：

```json
[
  {
    "id": 1,
    "char": "一",
    "pinyin": "yī",
    "thai": "หนึ่ง",
    "level": 1,
    "group": 1,
    "audio": "audio/一.mp3",
    "etymology": ["etymology/一_oracle.jpg", "etymology/一_seal.jpg"]
  },
  {
    "id": 2,
    "char": "二",
    "pinyin": "èr",
    "thai": "สอง",
    "level": 1,
    "group": 1,
    "audio": "audio/二.mp3",
    "etymology": ["etymology/二_oracle.jpg", "etymology/二_seal.jpg"]
  },
  {
    "id": 3,
    "char": "三",
    "pinyin": "sān",
    "thai": "สาม",
    "level": 1,
    "group": 1,
    "audio": "audio/三.mp3",
    "etymology": ["etymology/三_oracle.jpg", "etymology/三_seal.jpg"]
  },
  {
    "id": 4,
    "char": "十",
    "pinyin": "shí",
    "thai": "สิบ",
    "level": 2,
    "group": 2,
    "audio": "audio/十.mp3",
    "etymology": ["etymology/十_oracle.jpg", "etymology/十_seal.jpg"]
  },
  {
    "id": 5,
    "char": "八",
    "pinyin": "bā",
    "thai": "แปด",
    "level": 2,
    "group": 2,
    "audio": "audio/八.mp3",
    "etymology": ["etymology/八_oracle.jpg", "etymology/八_seal.jpg"]
  },
  {
    "id": 6,
    "char": "六",
    "pinyin": "liù",
    "thai": "หก",
    "level": 2,
    "group": 2,
    "audio": "audio/六.mp3",
    "etymology": ["etymology/六_oracle.jpg", "etymology/六_seal.jpg"]
  },
  {
    "id": 7,
    "char": "日",
    "pinyin": "rì",
    "thai": "พระอาทิตย์ / วัน",
    "level": 3,
    "group": 3,
    "audio": "audio/日.mp3",
    "etymology": ["etymology/日_oracle.jpg", "etymology/日_seal.jpg"]
  },
  {
    "id": 8,
    "char": "月",
    "pinyin": "yuè",
    "thai": "พระจันทร์ / เดือน",
    "level": 3,
    "group": 3,
    "audio": "audio/月.mp3",
    "etymology": ["etymology/月_oracle.jpg", "etymology/月_seal.jpg"]
  },
  {
    "id": 9,
    "char": "山",
    "pinyin": "shān",
    "thai": "ภูเขา",
    "level": 3,
    "group": 3,
    "audio": "audio/山.mp3",
    "etymology": ["etymology/山_oracle.jpg", "etymology/山_seal.jpg"]
  },
  {
    "id": 10,
    "char": "水",
    "pinyin": "shuǐ",
    "thai": "น้ำ",
    "level": 4,
    "group": 4,
    "audio": "audio/水.mp3",
    "etymology": ["etymology/水_oracle.jpg", "etymology/水_seal.jpg"]
  },
  {
    "id": 11,
    "char": "火",
    "pinyin": "huǒ",
    "thai": "ไฟ",
    "level": 4,
    "group": 4,
    "audio": "audio/火.mp3",
    "etymology": ["etymology/火_oracle.jpg", "etymology/火_seal.jpg"]
  },
  {
    "id": 12,
    "char": "土",
    "pinyin": "tǔ",
    "thai": "ดิน",
    "level": 4,
    "group": 4,
    "audio": "audio/土.mp3",
    "etymology": ["etymology/土_oracle.jpg", "etymology/土_seal.jpg"]
  },
  {
    "id": 13,
    "char": "木",
    "pinyin": "mù",
    "thai": "ต้นไม้ / ไม้",
    "level": 5,
    "group": 5,
    "audio": "audio/木.mp3",
    "etymology": ["etymology/木_oracle.jpg", "etymology/木_seal.jpg"]
  },
  {
    "id": 14,
    "char": "人",
    "pinyin": "rén",
    "thai": "คน",
    "level": 5,
    "group": 5,
    "audio": "audio/人.mp3",
    "etymology": ["etymology/人_oracle.jpg", "etymology/人_seal.jpg"]
  },
  {
    "id": 15,
    "char": "口",
    "pinyin": "kǒu",
    "thai": "ปาก",
    "level": 5,
    "group": 5,
    "audio": "audio/口.mp3",
    "etymology": ["etymology/口_oracle.jpg", "etymology/口_seal.jpg"]
  },
  {
    "id": 16,
    "char": "大",
    "pinyin": "dà",
    "thai": "ใหญ่",
    "level": 6,
    "group": 6,
    "audio": "audio/大.mp3",
    "etymology": ["etymology/大_oracle.jpg", "etymology/大_seal.jpg"]
  },
  {
    "id": 17,
    "char": "小",
    "pinyin": "xiǎo",
    "thai": "เล็ก",
    "level": 6,
    "group": 6,
    "audio": "audio/小.mp3",
    "etymology": ["etymology/小_oracle.jpg", "etymology/小_seal.jpg"]
  },
  {
    "id": 18,
    "char": "中",
    "pinyin": "zhōng",
    "thai": "กลาง",
    "level": 6,
    "group": 6,
    "audio": "audio/中.mp3",
    "etymology": ["etymology/中_oracle.jpg", "etymology/中_seal.jpg"]
  },
  {
    "id": 19,
    "char": "上",
    "pinyin": "shàng",
    "thai": "บน / ขึ้น",
    "level": 7,
    "group": 7,
    "audio": "audio/上.mp3",
    "etymology": ["etymology/上_oracle.jpg", "etymology/上_seal.jpg"]
  },
  {
    "id": 20,
    "char": "下",
    "pinyin": "xià",
    "thai": "ล่าง / ลง",
    "level": 7,
    "group": 7,
    "audio": "audio/下.mp3",
    "etymology": ["etymology/下_oracle.jpg", "etymology/下_seal.jpg"]
  },
  {
    "id": 21,
    "char": "门",
    "pinyin": "mén",
    "thai": "ประตู",
    "level": 7,
    "group": 7,
    "audio": "audio/门.mp3",
    "etymology": ["etymology/门_oracle.jpg", "etymology/门_seal.jpg"]
  },
  {
    "id": 22,
    "char": "我",
    "pinyin": "wǒ",
    "thai": "ฉัน",
    "level": 8,
    "group": 8,
    "audio": "audio/我.mp3",
    "etymology": ["etymology/我_oracle.jpg", "etymology/我_seal.jpg"]
  },
  {
    "id": 23,
    "char": "你",
    "pinyin": "nǐ",
    "thai": "คุณ",
    "level": 8,
    "group": 8,
    "audio": "audio/你.mp3",
    "etymology": ["etymology/你_oracle.jpg", "etymology/你_seal.jpg"]
  },
  {
    "id": 24,
    "char": "他",
    "pinyin": "tā",
    "thai": "เขา (ผู้ชาย)",
    "level": 8,
    "group": 8,
    "audio": "audio/他.mp3",
    "etymology": ["etymology/他_oracle.jpg", "etymology/他_seal.jpg"]
  },
  {
    "id": 25,
    "char": "父",
    "pinyin": "fù",
    "thai": "พ่อ",
    "level": 9,
    "group": 9,
    "audio": "audio/父.mp3",
    "etymology": ["etymology/父_oracle.jpg", "etymology/父_seal.jpg"]
  },
  {
    "id": 26,
    "char": "母",
    "pinyin": "mǔ",
    "thai": "แม่",
    "level": 9,
    "group": 9,
    "audio": "audio/母.mp3",
    "etymology": ["etymology/母_oracle.jpg", "etymology/母_seal.jpg"]
  },
  {
    "id": 27,
    "char": "子",
    "pinyin": "zǐ",
    "thai": "ลูก",
    "level": 9,
    "group": 9,
    "audio": "audio/子.mp3",
    "etymology": ["etymology/子_oracle.jpg", "etymology/子_seal.jpg"]
  },
  {
    "id": 28,
    "char": "去",
    "pinyin": "qù",
    "thai": "ไป",
    "level": 10,
    "group": 10,
    "audio": "audio/去.mp3",
    "etymology": ["etymology/去_oracle.jpg", "etymology/去_seal.jpg"]
  },
  {
    "id": 29,
    "char": "来",
    "pinyin": "lái",
    "thai": "มา",
    "level": 10,
    "group": 10,
    "audio": "audio/来.mp3",
    "etymology": ["etymology/来_oracle.jpg", "etymology/来_seal.jpg"]
  },
  {
    "id": 30,
    "char": "心",
    "pinyin": "xīn",
    "thai": "หัวใจ",
    "level": 10,
    "group": 10,
    "audio": "audio/心.mp3",
    "etymology": ["etymology/心_oracle.jpg", "etymology/心_seal.jpg"]
  }
]
```

**扩展说明：** 未来增加汉字时，只需在此 JSON 中追加数据并增加 level/group 编号，前端代码会自动根据数据生成对应的 Dashboard 卡片和学习页面，无需修改代码逻辑。

### 3.2 学习进度数据结构 (Progress Data)

使用 localStorage 存储每个汉字的学习进度，数据结构如下：

```javascript
// localStorage key: "charProgress"
// 每个汉字一条记录
{
  "山": {
    "status": "learning",       // "new" | "learning" | "mastered"
    "correctStreak": 2,         // 连续答对次数
    "quizHistory": [
      { "date": "2026-06-17", "correct": true },
      { "date": "2026-06-18", "correct": true }
    ],
    "nextReviewDate": "2026-06-20"
  }
}
```

**掌握判定规则：**
* 连续答对 3 次 → 标记为 mastered
* 答错 1 次 → 退回 learning，连胜重置为 0

**复习间隔计算：**

```javascript
function getNextReviewDate(correctStreak) {
  const intervals = [1, 3, 7, 14, 30]; // 天数
  const idx = Math.min(correctStreak, intervals.length - 1);
  return intervals[idx];
  // 未来可替换为 SM-2 算法，只需修改此函数
}
```

### 3.3 Hanzi Writer 集成要点

通过 CDN 引入：`https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js`

**笔顺动画组件：**
```javascript
var writer = HanziWriter.create('character-animation-div', '木', {
  width: 250,
  height: 250,
  padding: 5,
  strokeAnimationSpeed: 1,
  showOutline: true
});
// 控制按钮调用：writer.animateCharacter();
```

**手写练习组件：**
```javascript
var quizWriter = HanziWriter.create('character-quiz-div', '木', {
  width: 250,
  height: 250,
  showOutline: true,
  showLines: true  // 显示米字格辅助线
});
quizWriter.quiz({
  onComplete: function(summaryData) {
    // 练习完成回调：更新进度数据
  }
});
```

**手写区域尺寸要求：** 最小 250x250px，在移动端应响应式占满可用宽度（至少 80vw），确保手指/触控笔书写体验。

**清除重写：** 提供"清除"按钮，点击后清空整个画布并重新开始 quiz，不支持逐笔撤销。

### 3.4 音频方案 (Audio Solution)

**方案：** 使用 **edge-tts**（微软 Edge 神经网络语音引擎）预先批量生成 30 个 mp3 文件，打包进项目的 `audio/` 目录。

**生成脚本（开发阶段使用）：**
```python
# generate_audio.py
# 依赖安装：pip install edge-tts
import asyncio
import edge_tts

chars = list("一二三十八六日月山水火土木人口大小中上下门我你他父母子去来心")

async def main():
    for ch in chars:
        tts = edge_tts.Communicate(ch, "zh-CN-XiaoxiaoNeural")
        await tts.save(f"audio/{ch}.mp3")
        print(f"Generated audio/{ch}.mp3")

asyncio.run(main())
```

**前端播放：** 点击喇叭图标时，使用 `<audio>` 标签或 `new Audio()` 播放对应的本地 mp3 文件。不依赖浏览器 TTS，确保所有设备播放效果一致。

### 3.5 字源演变图资源 (Etymology Images)

**来源：** 从以下开源数据集获取每个汉字的甲骨文/篆书演变图片：

* **首选：** [character-Evolution-Dataset](https://github.com/RomanticGodVAN/character-Evolution-Dataset) — 229,170 张图片，覆盖甲骨文、金文、篆书、隶书等 6 个历史时期
* **备选：** [zdic-net/zdic_img](https://github.com/zdic-net/zdic_img) — 汉典官方甲骨文/金文图片仓库
* **SVG 备选：** [peterolson/chinese-lexicon](https://github.com/peterolson/chinese-lexicon) — SVG 格式字源图，Web 缩放效果好

**使用方式：** 每个汉字选取 2-3 个阶段（甲骨文 → 篆书 → 现代汉字），图片存放在项目的 `etymology/` 目录中。避免展示过多阶段导致初学者信息过载。

---

## 4. UI/UX 设计规范 (Design & Layout)

* **配色方案：** 米白色或浅灰色背景（模仿纸张感），搭配墨黑色汉字与醒目的红色/蓝色笔顺提示线
* **自适应设计 (Responsive)：** 界面必须优先适配 **iPad/平板电脑**，因为目标学生更习惯用触控笔在屏幕上直接练习书写。同时兼顾手机和 PC
* **字体：** 汉字部分使用标准楷体 (Kaiti)，以便学生模仿规范书写体
* **完成反馈：** 手写 quiz 完成（写对）时，提供视觉庆祝动效（如绿色对勾 + 简短动画），增强成就感

---

## 5. 用户完整学习流程 (User Flow)

```
用户打开应用
  → Dashboard（看到 10 个 Level 卡片 + 各字掌握状态圆点）
  → 点击 Level 4
  → 【复习关卡】（Level 2 起触发）
     → 从已学汉字中抽 3 个需要复习的字
     → 逐个进行手写笔顺 quiz
     → 写对 ✓ → 更新连胜、推迟复习日期
     → 写错 ✗ → 退回 learning、连胜归零
     → 复习完成，无论对错均可继续
  → 【新字学习】进入 Level 4 的 3 个新字
     → 查看字源演变图
     → 点击喇叭听发音
     → 观看笔顺动画（自动/手动播放）
     → 手写练习（写错可清除重写）
  → 完成后返回 Dashboard，进度自动保存到 localStorage
```

---

## 6. 项目文件结构 (Project Structure)

```
ChineseTeaching/
├── index.html              # 主页面（SPA）
├── css/
│   └── style.css           # 自定义样式（Tailwind 之外的补充）
├── js/
│   ├── app.js              # 主应用逻辑、页面路由
│   ├── review.js           # 复习关卡逻辑
│   └── storage.js          # localStorage 存取封装（未来可替换为后端）
├── data/
│   └── characters.json     # 汉字数据（独立文件，方便扩展）
├── audio/                  # 预生成的 mp3 发音文件（30 个）
├── etymology/              # 字源演变图片（每字 2-3 张）
├── generate_audio.py       # 音频生成脚本（开发工具，不部署）
└── prd.md                  # 本文档
```

---

## 7. 扩展性设计要点 (Scalability Notes)

当前版本为 30 字 / 10 个 Level。设计上已为未来扩展做好准备：

| 设计点 | 当前（30 字） | 未来（100-1000 字） | 扩展方式 |
|--------|--------------|--------------------|---------| 
| 汉字数据 | 30 条 JSON | 追加数据即可 | characters.json 加数据，不改代码 |
| Level/分组 | 10 个 Level | 自动根据数据生成 | Dashboard 动态渲染，不硬编码 |
| 复习算法 | 固定间隔表 | SM-2 算法 | 只需替换 getNextReviewDate 函数 |
| 数据存储 | localStorage | 云端数据库 | 只需替换 storage.js 模块 |
| 音频文件 | 30 个 mp3 | 批量生成更多 | 运行 generate_audio.py 即可 |
