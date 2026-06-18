(() => {
  'use strict';

  const PALETTE = {
    warm: [
      [200, 130, 70],
      [180, 110, 60],
      [220, 160, 100],
      [160, 140, 120],
      [140, 130, 110],
      [100, 90, 80],
    ],
  };

  const MIN_TRANSITION_MS = 3000;
  const MAX_TRANSITION_MS = 8500;
  const MIN_INTERVAL_MS = 14000;
  const MAX_INTERVAL_MS = 34000;

  const canvas = document.getElementById('network-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function radialFade(x, y, w, h, strength) {
    const dx = x - w / 2, dy = y - h / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - (dist / (Math.max(w, h) / 2)) * strength);
  }

  function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  const BOX_VERTS = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
  ];
  const BOX_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  function project3D(px, py, pz, rx, ry, rz) {
    let x = px, y = py, z = pz;
    const y1 = y * Math.cos(rx) - z * Math.sin(rx);
    const z1 = y * Math.sin(rx) + z * Math.cos(rx);
    y = y1; z = z1;
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z2 = -x * Math.sin(ry) + z * Math.cos(ry);
    x = x1; z = z2;
    const x2 = x * Math.cos(rz) - y * Math.sin(rz);
    const y2 = x * Math.sin(rz) + y * Math.cos(rz);
    return [x2, y2, z2];
  }

  // ---------- Animators ----------

  const networkAnimator = {
    name: 'network',
    create(w, h) {
      let count = Math.max(55, Math.floor((w * h) / 22000));
      const nodes = [];
      // Grid-based distribution with jitter for visually even spacing
      const aspect = w / h;
      const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
      const rows = Math.max(1, Math.ceil(count / cols));
      const cellW = w / cols;
      const cellH = h / rows;
      let placed = 0;
      for (let r = 0; r < rows && placed < count; r++) {
        for (let c = 0; c < cols && placed < count; c++) {
          const x = (c + 0.2 + Math.random() * 0.6) * cellW;
          const y = (r + 0.2 + Math.random() * 0.6) * cellH;
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.15 + Math.random() * 0.20;
          nodes.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: 1.5 + Math.random() * 2.6,
            color: PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)],
            phase: Math.random() * Math.PI * 2,
          });
          placed++;
        }
      }
      return { nodes };
    },
    resize(w, h, s) {
      for (const n of s.nodes) {
        if (n.x > w) n.x = Math.random() * w;
        if (n.y > h) n.y = Math.random() * h;
      }
    },
    update(w, h, time, dt, s) {
      for (const n of s.nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) n.x += w;
        if (n.x > w) n.x -= w;
        if (n.y < 0) n.y += h;
        if (n.y > h) n.y -= h;
      }
    },
    draw(ctx, w, h, time, s) {
      const nodes = s.nodes;
      const maxD = 180;
      const maxD2 = maxD * maxD;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const alpha = (1 - d2 / maxD2) * 0.32;
            const fade = radialFade((a.x + b.x) / 2, (a.y + b.y) / 2, w, h, 0.55);
            const pulse = 0.7 + 0.3 * Math.sin(time * 0.5 + a.phase);
            const r = (a.color[0] + b.color[0]) >> 1;
            const g = (a.color[1] + b.color[1]) >> 1;
            const bl = (a.color[2] + b.color[2]) >> 1;
            ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha * pulse * fade})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 0.25 + n.phase);
        const fade = radialFade(n.x, n.y, w, h, 0.55);
        ctx.fillStyle = `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${(0.5 + 0.25 * pulse) * fade})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };

  const cyberpunkAnimator = {
    name: 'cyberpunk',
    create(w, h) {
      const streakCount = Math.max(45, Math.floor((w * h) / 18000));
      const nodeCount = Math.max(24, Math.floor((w * h) / 45000));
      const streaks = [];
      for (let i = 0; i < streakCount; i++) {
        streaks.push({
          x: Math.random() * w, y: Math.random() * h,
          len: 30 + Math.random() * 110,
          speed: 4.0 + Math.random() * 10.0,
          width: 1 + Math.random() * 2,
          color: PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)],
          phase: Math.random() * Math.PI * 2,
        });
      }
      const nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 1 + Math.random() * 3,
          color: PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)],
          phase: Math.random() * Math.PI * 2,
        });
      }
      return { streaks, nodes };
    },
    resize(w, h, s) {
      for (const st of s.streaks) {
        if (st.x > w) st.x = Math.random() * w;
        if (st.y > h + 120) st.y = Math.random() * h;
      }
      for (const n of s.nodes) {
        if (n.x > w) n.x = Math.random() * w;
        if (n.y > h) n.y = Math.random() * h;
      }
    },
    update(w, h, time, dt, s) {
      for (const st of s.streaks) {
        st.y += st.speed;
        st.x -= st.speed * 0.18;
        if (st.y - st.len > h || st.x + st.len < 0) {
          st.y = -st.len - Math.random() * h * 0.25;
          st.x = w + Math.random() * w * 0.15;
          st.len = 30 + Math.random() * 110;
          st.speed = 4.0 + Math.random() * 10.0;
          st.color = PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)];
        }
      }
    },
    draw(ctx, w, h, time, s) {
      drawCyberGrid(ctx, w, h, time);
      drawStreaks(ctx, w, h, time, s);
      drawCyberNodes(ctx, w, h, time, s);
      drawScanlines(ctx, w, h, time);
    },
  };

  function drawCyberGrid(ctx, w, h, time) {
    const horizon = h * 0.56;
    const bottom = h + 2;
    const vanishingX = w / 2;
    const vanishingY = horizon;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    // Continuous radial lines from vanishing point with depth-based alpha gradient
    const lineCount = 32;
    
    for (let i = 0; i < lineCount; i++) {
      const spread = (i - lineCount / 2) * (w / (lineCount * 0.6));
      const bottomX = vanishingX + spread;
      
      // Draw as gradient with multiple segments
      const segments = 20;
      for (let s = 0; s < segments; s++) {
        const t1 = s / segments;
        const t2 = (s + 1) / segments;
        
        const y1 = vanishingY + (bottom - vanishingY) * t1;
        const y2 = vanishingY + (bottom - vanishingY) * t2;
        const x1 = vanishingX + (bottomX - vanishingX) * t1;
        const x2 = vanishingX + (bottomX - vanishingX) * t2;
        
        // Alpha increases from horizon (distant) to middle, then fades to bottom (close)
        const avgT = (t1 + t2) / 2;
        const fadeOut = 1 - Math.pow(avgT, 3);
        const alpha = (0.22 + avgT * avgT * 0.48) * fadeOut;
        const lineW = 0.7 + avgT * 1.2;
        
        ctx.strokeStyle = `rgba(200,130,70,${alpha})`;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    
    // Horizontal lines scrolling toward viewer with perspective
    const lineCountH = 25;
    const scrollH = (time * 0.095) % (1 / lineCountH);
    
    for (let i = 0; i < lineCountH; i++) {
      const baseT = i / lineCountH + scrollH;
      const t = baseT % 1;
      
      // Perspective: spacing increases as we get closer
      const perspT = Math.pow(t, 2.2);
      const y = vanishingY + (bottom - vanishingY) * perspT;
      
      if (y < horizon || y > bottom) continue;
      
      // Alpha increases from horizon to bottom
      const alpha = 0.040 + perspT * perspT * 0.165;
      const lineW = 0.6 + perspT * 0.9;
      
      ctx.strokeStyle = `rgba(220,160,100,${alpha})`;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  function drawScanlines(ctx, w, h, time) {
    const gap = 6;
    const offset = (time * 12.0) % gap;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let y = offset; y < h; y += gap) {
      ctx.strokeStyle = `rgba(180,110,60,${0.018 + 0.015 * Math.sin(time * 0.45 + y)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStreaks(ctx, w, h, time, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const st of s.streaks) {
      const pulse = 0.55 + 0.45 * Math.sin(time * 0.9 + st.phase);
      const alpha = 0.16 + pulse * 0.22;
      const grad = ctx.createLinearGradient(st.x, st.y, st.x + st.len * 0.35, st.y - st.len);
      grad.addColorStop(0, `rgba(${st.color[0]},${st.color[1]},${st.color[2]},0)`);
      grad.addColorStop(0.55, `rgba(${st.color[0]},${st.color[1]},${st.color[2]},${alpha})`);
      grad.addColorStop(1, `rgba(245,235,224,${alpha * 0.4})`);
      ctx.strokeStyle = grad;
      ctx.shadowBlur = 14;
      ctx.shadowColor = `rgba(${st.color[0]},${st.color[1]},${st.color[2]},0.45)`;
      ctx.lineWidth = st.width;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x + st.len * 0.35, st.y - st.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCyberNodes(ctx, w, h, time, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of s.nodes) {
      const pulse = 0.65 + 0.35 * Math.sin(time * 0.66 + n.phase);
      const alpha = 0.18 + pulse * 0.28;
      const fade = radialFade(n.x, n.y, w, h, 0.32);
      ctx.shadowBlur = 18;
      ctx.shadowColor = `rgba(${n.color[0]},${n.color[1]},${n.color[2]},0.45)`;
      ctx.fillStyle = `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${alpha * fade})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (0.8 + pulse * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const hexagonsAnimator = {
    name: 'hexagons',
    create(w, h) {
      const size = 46;
      const hexW = size * Math.sqrt(3);
      const hexH = size * 2;
      const cols = Math.ceil(w / hexW) + 3;
      const rows = Math.ceil(h / (hexH * 0.75)) + 3;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * hexW + (r % 2) * hexW / 2 - hexW;
          const y = r * hexH * 0.75 - hexH;
          cells.push({
            x, y, size,
            color: PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)],
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
      return { cells, cols, rows, hexW, hexH };
    },
    resize(w, h, s) {
      const fresh = hexagonsAnimator.create(w, h);
      s.cells = fresh.cells;
      s.cols = fresh.cols;
      s.rows = fresh.rows;
      s.hexW = fresh.hexW;
      s.hexH = fresh.hexH;
    },
    update() {},
    draw(ctx, w, h, time, s) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const cell of s.cells) {
        const dist = Math.sqrt((cell.x - w / 2) ** 2 + (cell.y - h / 2) ** 2);
        const radial = radialFade(cell.x, cell.y, w, h, 0.55);
        const wave = Math.sin(time * 0.66 - dist * 0.012 + cell.phase);
        const pulse = 0.5 + 0.5 * wave;
        const brightness = radial * pulse;
        const alpha = 0.12 + brightness * 0.48;

        ctx.shadowBlur = brightness > 0.55 ? 14 : 0;
        if (brightness > 0.55) {
          ctx.shadowColor = `rgba(${cell.color[0]},${cell.color[1]},${cell.color[2]},${brightness * 0.55})`;
        }
        ctx.strokeStyle = `rgba(${cell.color[0]},${cell.color[1]},${cell.color[2]},${alpha})`;
        ctx.lineWidth = 1;
        hexPath(ctx, cell.x, cell.y, cell.size * 0.94);
        ctx.stroke();

        if (brightness > 0.72) {
          ctx.fillStyle = `rgba(${cell.color[0]},${cell.color[1]},${cell.color[2]},${(brightness - 0.72) * 0.55})`;
          hexPath(ctx, cell.x, cell.y, cell.size * 0.55);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };

  const matrixAnimator = {
    name: 'matrix',
    create(w, h) {
      const fontSize = 16;
      const cols = Math.ceil(w / fontSize);
      const columns = [];
      for (let i = 0; i < cols; i++) {
        columns.push({
          x: i * fontSize,
          y: Math.random() * h - h,
          speed: 3.2 + Math.random() * 8.8,
          length: 8 + Math.floor(Math.random() * 20),
          color: PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)],
          charIdx: Math.floor(Math.random() * 96),
        });
      }
      return { columns, fontSize };
    },
    resize(w, h, s) {
      const fresh = matrixAnimator.create(w, h);
      s.columns = fresh.columns;
      s.fontSize = fresh.fontSize;
    },
    update(w, h, time, dt, s) {
      for (const col of s.columns) {
        col.y += col.speed;
        if (col.y - col.length * s.fontSize > h) {
          col.y = -Math.random() * h * 0.4;
          col.speed = 3.2 + Math.random() * 8.8;
          col.color = PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)];
        }
      }
    },
    draw(ctx, w, h, time, s) {
      const fs = s.fontSize;
      ctx.save();
      ctx.font = `${fs}px 'Courier New', monospace`;
      ctx.textBaseline = 'top';
      ctx.globalCompositeOperation = 'lighter';
      for (const col of s.columns) {
        const xFade = radialFade(col.x, h / 2, w, h, 0.7);
        for (let i = 0; i < col.length; i++) {
          const y = col.y - i * fs;
          if (y < -fs || y > h + fs) continue;
          const t = i / col.length;
          let alpha = (1 - t) * 0.75 * xFade;
          const code = 0x30A0 + ((col.charIdx + i * 7 + Math.floor(time * 1.2)) % 96);
          const ch = String.fromCharCode(code);
          if (i === 0) {
            ctx.fillStyle = `rgba(${col.color[0]},${col.color[1]},${col.color[2]},${Math.min(0.9, alpha * 1.2)})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = `rgba(${col.color[0]},${col.color[1]},${col.color[2]},0.5)`;
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(${col.color[0]},${col.color[1]},${col.color[2]},${alpha * 0.7})`;
          }
          ctx.fillText(ch, col.x, y);
        }
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    },
  };

  const boxesAnimator = {
    name: 'boxes',
    create(w, h) {
      const count = 22;
      const boxes = [];
      for (let i = 0; i < count; i++) {
        boxes.push({
          wx: (Math.random() - 0.5) * w * 1.3,
          wy: (Math.random() - 0.5) * h * 1.1,
          wz: 120 + Math.random() * 520,
          size: 18 + Math.random() * 62,
          rx: Math.random() * Math.PI * 2,
          ry: Math.random() * Math.PI * 2,
          rz: Math.random() * Math.PI * 2,
          drx: (Math.random() - 0.5) * 0.016,
          dry: (Math.random() - 0.5) * 0.016,
          drz: (Math.random() - 0.5) * 0.011,
          driftX: (Math.random() - 0.5) * 0.35,
          driftY: (Math.random() - 0.5) * 0.35,
          color: PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)],
          phase: Math.random() * Math.PI * 2,
          nextJitter: Math.random() * 3,
          jitterTimer: 0,
          scalePulse: 0.9 + Math.random() * 0.2,
          pulseSpeed: 0.3 + Math.random() * 0.8,
        });
      }
      return { boxes };
    },
    resize(w, h, s) {
      const halfW = w * 0.55, halfH = h * 0.55;
      for (const b of s.boxes) {
        if (Math.abs(b.wx) > halfW) b.wx = (Math.random() - 0.5) * w * 0.9;
        if (Math.abs(b.wy) > halfH) b.wy = (Math.random() - 0.5) * h * 0.75;
      }
    },
    update(w, h, time, dt, s) {
      for (const b of s.boxes) {
        b.rx += b.drx;
        b.ry += b.dry;
        b.rz += b.drz;
        b.wx += b.driftX;
        b.wy += b.driftY;
        
        // Random jitter in rotation and movement
        b.jitterTimer += dt;
        if (b.jitterTimer > b.nextJitter) {
          const jitterX = (Math.random() - 0.5) * 0.8;
          const jitterY = (Math.random() - 0.5) * 0.8;
          b.driftX += jitterX;
          b.driftY += jitterY;
          b.drx += (Math.random() - 0.5) * 0.02;
          b.dry += (Math.random() - 0.5) * 0.02;
          b.drz += (Math.random() - 0.5) * 0.01;
          
          // Occasionally change color
          if (Math.random() < 0.15) {
            b.color = PALETTE.warm[Math.floor(Math.random() * PALETTE.warm.length)];
          }
          
          b.jitterTimer = 0;
          b.nextJitter = 1 + Math.random() * 4;
        }
        
        // Random scale pulsing
        b.scalePulse = 0.78 + 0.44 * Math.sin(time * b.pulseSpeed + b.phase);
        
        // Boundaries with bounce
        const boundX = w * 0.75, boundY = h * 0.65;
        if (Math.abs(b.wx) > boundX) {
          b.driftX *= -0.9;
          b.wx = Math.sign(b.wx) * boundX;
        }
        if (Math.abs(b.wy) > boundY) {
          b.driftY *= -0.9;
          b.wy = Math.sign(b.wy) * boundY;
        }
        
        // Clamp rotation speeds
        const maxRot = 0.03;
        b.drx = Math.max(-maxRot, Math.min(maxRot, b.drx));
        b.dry = Math.max(-maxRot, Math.min(maxRot, b.dry));
        b.drz = Math.max(-maxRot, Math.min(maxRot, b.drz));
      }
    },
    draw(ctx, w, h, time, s) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cx = w / 2, cy = h / 2;
      const persp = 800;
      for (const b of s.boxes) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 0.42 + b.phase);
        const size = b.size * b.scalePulse;
        const projected = [];
        for (const v of BOX_VERTS) {
          const [x, y, z] = project3D(v[0] * size, v[1] * size, v[2] * size, b.rx, b.ry, b.rz);
          const sc = persp / (persp + z + b.wz);
          const px = cx + (b.wx + x) * sc;
          const py = cy + (b.wy + y) * sc;
          projected.push([px, py, sc]);
        }
        const radial = radialFade(cx + b.wx, cy + b.wy, w, h, 0.65);
        const alphaBase = (0.45 + pulse * 0.45) * radial;
        ctx.strokeStyle = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},${alphaBase})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},${0.7 * radial})`;
        for (const [a, bb] of BOX_EDGES) {
          ctx.beginPath();
          ctx.moveTo(projected[a][0], projected[a][1]);
          ctx.lineTo(projected[bb][0], projected[bb][1]);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };

  const ANIMATORS = [
    networkAnimator,
    cyberpunkAnimator,
    hexagonsAnimator,
    matrixAnimator,
    boxesAnimator,
  ];

  // ---------- Controller ----------

  let currentItem = null;
  let nextItem = null;
  let transitionStart = 0;
  let currentTransitionDuration = MIN_TRANSITION_MS;
  let scheduleTimeout = null;
  let currentTransition = null;
  let history = [];
  let usedTransitions = [];

  const offA = document.createElement('canvas');
  const offCtxA = offA.getContext('2d');
  const offB = document.createElement('canvas');
  const offCtxB = offB.getContext('2d');

  function spawn(anim) {
    return { anim, state: anim.create(W, H) };
  }

  function pickNext() {
    let idx;
    do {
      idx = Math.floor(Math.random() * ANIMATORS.length);
    } while (history.includes(idx));
    return idx;
  }

  function clearSchedule() {
    if (scheduleTimeout) {
      clearTimeout(scheduleTimeout);
      scheduleTimeout = null;
    }
  }

  function scheduleNext() {
    clearSchedule();
    const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
    scheduleTimeout = setTimeout(beginTransition, delay);
  }

  function pickNextTransition() {
    if (usedTransitions.length >= TRANSITIONS.length) {
      usedTransitions = [];
    }
    let idx;
    do {
      idx = Math.floor(Math.random() * TRANSITIONS.length);
    } while (usedTransitions.includes(idx));
    usedTransitions.push(idx);
    return idx;
  }

  function beginTransition() {
    if (nextItem) return;
    const idx = pickNext();
    nextItem = spawn(ANIMATORS[idx]);
    transitionStart = performance.now();
    
    currentTransitionDuration = MIN_TRANSITION_MS + Math.random() * (MAX_TRANSITION_MS - MIN_TRANSITION_MS);
    currentTransition = TRANSITIONS[pickNextTransition()];
  }

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    
    offA.width = W * DPR;
    offA.height = H * DPR;
    offB.width = W * DPR;
    offB.height = H * DPR;
    
    if (currentItem) currentItem.anim.resize(W, H, currentItem.state);
    if (nextItem) nextItem.anim.resize(W, H, nextItem.state);
  }

  // Glitch slice transition
  function glitchTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    offCtxA.save();
    offCtxA.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxA.clearRect(0, 0, w, h);
    animA.draw(offCtxA, w, h, time, stateA);
    offCtxA.restore();
    
    offCtxB.save();
    offCtxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxB.clearRect(0, 0, w, h);
    animB.draw(offCtxB, w, h, time, stateB);
    offCtxB.restore();
    
    ctx.save();
    ctx.drawImage(offA, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
    
    const sliceCount = 3 + Math.floor(t * 8);
    for (let i = 0; i < sliceCount; i++) {
      const y = (i / sliceCount) * h;
      const sliceH = h / sliceCount;
      const offsetX = (Math.random() - 0.5) * 200 * (1 - t);
      
      if (Math.random() < t) {
        ctx.drawImage(
          offB,
          0, y * dpr, w * dpr, sliceH * dpr,
          offsetX, y, w, sliceH
        );
      }
    }
    
    const barCount = Math.floor(t * 1);
    for (let i = 0; i < barCount; i++) {
      const y = Math.random() * h;
      const barH = 1 + Math.random() * 10;
      ctx.fillStyle = `rgba(255, 248, 235, ${0.12 + Math.random() * 0.10})`;
      ctx.fillRect(0, y, w, barH);
    }
    
    ctx.restore();
  }

  // Exclusion blend transition
  function exclusionTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    offCtxA.save();
    offCtxA.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxA.clearRect(0, 0, w, h);
    animA.draw(offCtxA, w, h, time, stateA);
    offCtxA.restore();
    
    offCtxB.save();
    offCtxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxB.clearRect(0, 0, w, h);
    animB.draw(offCtxB, w, h, time, stateB);
    offCtxB.restore();
    
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(offA, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
    
    ctx.globalCompositeOperation = 'exclusion';
    ctx.globalAlpha = 0.5 + t * 0.5;
    ctx.drawImage(offB, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
    
    ctx.restore();
  }

  // Vertical columns melt transition
  function meltColumnsTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    offCtxA.save();
    offCtxA.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxA.clearRect(0, 0, w, h);
    animA.draw(offCtxA, w, h, time, stateA);
    offCtxA.restore();
    
    offCtxB.save();
    offCtxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxB.clearRect(0, 0, w, h);
    animB.draw(offCtxB, w, h, time, stateB);
    offCtxB.restore();
    
    const colWidth = 40;
    const colCount = Math.ceil(w / colWidth);
    
    ctx.save();
    for (let i = 0; i < colCount; i++) {
      const x = i * colWidth;
      const phase = (i / colCount) * Math.PI * 2;
      const delay = (Math.sin(phase) + 1) / 2;
      const localT = Math.max(0, Math.min(1, (t - delay * 0.3) / 0.7));
      
      const offsetY = -h * 0.35 * (1 - localT) + h * 0.35 * localT;
      
      ctx.drawImage(
        offA,
        x * dpr, 0, colWidth * dpr, h * dpr,
        x, -offsetY, colWidth, h
      );
      ctx.drawImage(
        offB,
        x * dpr, 0, colWidth * dpr, h * dpr,
        x, offsetY - h, colWidth, h
      );
    }
    ctx.restore();
  }

  // Sinusoidal warp transition
  function warpTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    offCtxA.save();
    offCtxA.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxA.clearRect(0, 0, w, h);
    animA.draw(offCtxA, w, h, time, stateA);
    offCtxA.restore();
    
    offCtxB.save();
    offCtxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxB.clearRect(0, 0, w, h);
    animB.draw(offCtxB, w, h, time, stateB);
    offCtxB.restore();
    
    const stripH = 8;
    const stripCount = Math.ceil(h / stripH);
    const blendAlpha = Math.min(1, t * 1.5);
    
    ctx.save();
    for (let i = 0; i < stripCount; i++) {
      const y = i * stripH;
      const phase = (i / stripCount) * Math.PI * 4 + time * 0.9;
      const offsetX = Math.sin(phase) * 30 * (1 - Math.abs(t - 0.5) * 2);
      
      ctx.globalAlpha = 1 - blendAlpha;
      ctx.drawImage(
        offA,
        0, y * dpr, w * dpr, stripH * dpr,
        offsetX, y, w, stripH
      );
      
      ctx.globalAlpha = blendAlpha;
      ctx.drawImage(
        offB,
        0, y * dpr, w * dpr, stripH * dpr,
        -offsetX, y, w, stripH
      );
    }
    ctx.restore();
  }

  // Pixelation dissolve transition
  function pixelateTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    offCtxA.save();
    offCtxA.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxA.clearRect(0, 0, w, h);
    animA.draw(offCtxA, w, h, time, stateA);
    offCtxA.restore();
    
    offCtxB.save();
    offCtxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtxB.clearRect(0, 0, w, h);
    animB.draw(offCtxB, w, h, time, stateB);
    offCtxB.restore();
    
    const blockSize = 8 + Math.sin(t * Math.PI) * 24;
    const blockCount = Math.ceil(w / blockSize);
    const blockCountY = Math.ceil(h / blockSize);
    
    ctx.save();
    for (let y = 0; y < blockCountY; y++) {
      for (let x = 0; x < blockCount; x++) {
        const bx = x * blockSize;
        const by = y * blockSize;
        
        const threshold = (x + y) / (blockCount + blockCountY);
        const alpha = Math.max(0, Math.min(1, (t - threshold) * 3 + 0.5));
        
        if (alpha < 1) {
          ctx.globalAlpha = 1 - alpha;
          ctx.drawImage(
            offA,
            bx * dpr, by * dpr, blockSize * dpr, blockSize * dpr,
            bx, by, blockSize, blockSize
          );
        }
        if (alpha > 0) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            offB,
            bx * dpr, by * dpr, blockSize * dpr, blockSize * dpr,
            bx, by, blockSize, blockSize
          );
        }
      }
    }
    ctx.restore();
  }

  const TRANSITIONS = [
    glitchTransition,
    exclusionTransition,
    meltColumnsTransition,
    warpTransition,
    pixelateTransition,
  ];

  let lastNow = performance.now();
  let time = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    time += dt;

    if (currentItem) currentItem.anim.update(W, H, time, dt, currentItem.state);
    if (nextItem) nextItem.anim.update(W, H, time, dt, nextItem.state);

    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (nextItem) {
      const raw = Math.min(1, (now - transitionStart) / currentTransitionDuration);
      const t = easeInOut(raw);
      
      currentTransition(
        ctx, W, H, DPR, t,
        currentItem.anim, currentItem.state,
        nextItem.anim, nextItem.state,
        time
      );

      if (raw >= 1) {
        currentItem = nextItem;
        const idx = ANIMATORS.indexOf(currentItem.anim);
        history.push(idx);
        if (history.length > 2) history.shift();
        nextItem = null;
        currentTransition = null;
        scheduleNext();
      }
    } else if (currentItem) {
      ctx.globalAlpha = 1;
      currentItem.anim.draw(ctx, W, H, time, currentItem.state);
    }

    // Smooth mouse tracking for radial gradient with velocity-based radius
    const dx = mouseX - lastMouseX;
    const dy = mouseY - lastMouseY;
    const velocity = Math.sqrt(dx * dx + dy * dy);
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    
    smoothX += (mouseX - smoothX) * 0.14;
    smoothY += (mouseY - smoothY) * 0.14;
    
    // Map velocity to radius (100-550 range)
    const targetRadius = Math.min(550, Math.max(100, 100 + velocity * 2.5));
    
    if (velocity > 0.5) {
      // Mouse is moving, reset timer and zoom in
      velocityTimer = 0;
      isZoomingOut = false;
      smoothRadius += (targetRadius - smoothRadius) * 0.1;
    } else {
      // Mouse is still, start the delay timer
      velocityTimer += 1/60;
      
      if (velocityTimer > 0.3) { // 0.3s delay before zoom out
        isZoomingOut = true;
      }
      
      if (isZoomingOut) {
        // Ease out zoom (slower interpolation)
        smoothRadius += (targetRadius - smoothRadius) * 0.03;
      }
    }

    // Smooth fade-in animation with easing
    const fadeSpeed = 0.05;
    if (fadeProgress < fadeTarget) {
      fadeProgress = Math.min(fadeTarget, fadeProgress + fadeSpeed);
    } else if (fadeProgress > fadeTarget && Date.now() - lastMouseActivity > 2000) {
      // Fade out after 2 seconds of no mouse activity
      fadeProgress = Math.max(fadeTarget, fadeProgress - fadeSpeed * 0.5);
    }

    // Draw mouse-following radial gradient overlay (amber glow)
    const gradient = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, smoothRadius);
    gradient.addColorStop(0, `rgba(200, 130, 70, ${0.15 * fadeProgress})`);
    gradient.addColorStop(0.7, `rgba(200, 130, 70, ${0.06 * fadeProgress})`);
    gradient.addColorStop(1, 'rgba(200, 130, 70, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();

    requestAnimationFrame(frame);
  }

  const startIdx = pickNext();
  history.push(startIdx);
  window.addEventListener('resize', resize);
  resize();
  currentItem = spawn(ANIMATORS[startIdx]);
  scheduleNext();
  
  // Mouse tracking for radial gradient
  const radialOverlay = document.createElement('div');
  radialOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    animation: radialFadeIn 9s ease-in forwards;
  `;
  document.body.insertBefore(radialOverlay, document.querySelector('.bg-container'));
  
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let smoothX = mouseX;
  let smoothY = mouseY;
  let smoothRadius = 350;
  let lastMouseX = mouseX;
  let lastMouseY = mouseY;
  let velocityTimer = 0;
  let isZoomingOut = false;
  let fadeProgress = 0;
  let fadeTarget = 0;
  let lastMouseActivity = Date.now();
  
  function triggerFadeIn() {
    fadeTarget = 1;
    lastMouseActivity = Date.now();
  }
  
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    triggerFadeIn();
  });
  
  requestAnimationFrame(frame);
})();
