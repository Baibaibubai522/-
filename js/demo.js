// 演示数据（仅当 URL 带 ?demo=1 时载入，用于本地预览与截图）
import * as db from './db.js';
import { compressPhoto } from './image.js';

function makePhoto(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 900);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 900);

  const circles = [[300, 250, 150], [880, 610, 200], [540, 670, 90], [980, 190, 120], [180, 700, 110]];
  for (const [x, y, r] of circles) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
  }

  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85));
}

export async function seedDemo() {
  const existing = await db.listSubjects();
  if (existing.length) return;

  const createdAt = new Date().toISOString();
  await db.saveSubject({
    id: 's1',
    code: '对象A',
    avatar: 'boy',
    note: '大班男孩 · 同伴交往',
    sort: 0,
    createdAt
  });

  const now = new Date();
  const at = (dayOffset, hour, minute) => {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const samples = [
    { id: 'r1', dimension: 'peer', description: '主动邀请同伴一起搭桥，说“我们一起搭吧”，还商量谁拿长积木、谁搭桥面。', observedAt: at(0, 9, 42), colors: ['#DCE9DC', '#A9C6B4'] },
    { id: 'r2', dimension: 'rule', description: '洗手排队时让弟弟先站，提醒后面的同伴不要挤。洗完手后主动把水龙头关紧。', observedAt: at(0, 9, 15), colors: ['#DCE4F2', '#AFC0DA'] },
    { id: 'r3', dimension: 'learn', description: '反复试了四次，把斜坡垫高，让小车跑得更远。每次失败后都会停下来看看，再换一种办法。', observedAt: at(0, 8, 50), colors: ['#EFE3D2', '#D6BE9E'] },
    { id: 'r4', dimension: 'task', description: '按图示独立完成拼图，拼错两次自己拆开重来，最后把四块拼图全部放对，用时约八分钟。', observedAt: at(1, 15, 20), colors: ['#E6DDF0', '#C2B2D8'] },
    { id: 'r5', dimension: 'rule', description: '进餐后把碗勺放到指定位置，桌面保持干净。看到地上掉了饭粒，蹲下来捡起来放进垃圾桶。', observedAt: at(1, 11, 58), colors: ['#DCE9DC', '#A9C6B4'] },
    { id: 'r6', dimension: 'learn', description: '观察蚂蚁搬食物十几分钟，问“它们怎么知道回家的路”，并蹲下来跟着蚂蚁走了一段。', observedAt: at(2, 14, 10), colors: ['#EFE3D2', '#D6BE9E'] },
    { id: 'r7', dimension: 'peer', description: '同伴搭歪时，他说“没关系，我们再来一次”，并伸手扶住积木，两人一起把桥搭好。', observedAt: at(3, 10, 5), colors: ['#E8DFD2', '#CDB79E'] }
  ];

  for (const sample of samples) {
    const blob = await makePhoto(sample.colors);
    if (!blob) continue;
    const processed = await compressPhoto(blob);
    const photoId = `p-${sample.id}`;
    await db.savePhoto({
      id: photoId,
      blob: processed.blob,
      thumb: processed.thumb,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes
    });
    await db.saveRecord({
      id: sample.id,
      subjectId: 's1',
      subjectCode: '对象A',
      observedAt: sample.observedAt,
      dimension: sample.dimension,
      description: sample.description,
      photoId,
      photoBytes: processed.bytes,
      createdAt: sample.observedAt,
      updatedAt: sample.observedAt
    });
  }
}
