(() => {
  'use strict';

  const PALETTE = {
    warm: [
      [235, 165, 95],
      [225, 145, 85],
      [245, 175, 105],
      [215, 140, 80],
      [205, 150, 90],
      [195, 145, 85],
      [220, 160, 95],
      [210, 135, 75],
    ],
    cool: [
      [140, 200, 200],
      [120, 190, 190],
      [130, 195, 195],
    ],
  };

  const COLOR_SPECTRUM = [
    ...PALETTE.warm,
    [230, 160, 100],
    [220, 150, 90],
    [210, 155, 95],
    ...PALETTE.cool,
  ];

  function rgba(color, alpha) {
    return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  }

  function pickSpectrumColor(randomness = Math.random()) {
    const skewed = Math.pow(randomness, 1.6);
    const idx = Math.floor(skewed * (COLOR_SPECTRUM.length - 1));
    return COLOR_SPECTRUM[idx];
  }

  const CYBER_GRID_COLOR = pickSpectrumColor(0.3);
  const CYBER_GRID_BRIGHT_COLOR = pickSpectrumColor(0.4);
  const SCANLINE_COLOR = pickSpectrumColor(0.68);
  const MOUSE_GLOW_COLOR = [245, 150, 20];

  const TRANSITION_MS = 7000;
  const RADIAL_START_DELAY_MS = 3600;
  const RADIAL_FADE_IN_MS = 1000;
  const MIN_INTERVAL_MS = 14000;
  const MAX_INTERVAL_MS = 34000;

  const OVERSIZE = 1.4;
  const canvas = document.getElementById('network-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

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
            color: pickSpectrumColor(Math.random()),
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

  function resetCyberStreak(st, w, h) {
    st.len = 30 + Math.random() * 110;
    st.speed = 4.0 + Math.random() * 10.0;
    st.color = pickSpectrumColor(0.6 + Math.random() * 0.4);

    if (Math.random() < 0.75) {
      st.y = -st.len - Math.random() * h * 0.45;
      st.x = Math.random() * (w + st.len * 0.35) - st.len * 0.15;
    } else {
      st.x = w + Math.random() * w * 0.25;
      st.y = Math.random() * h;
    }
  }

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
          color: pickSpectrumColor(0.6 + Math.random() * 0.4),
          phase: Math.random() * Math.PI * 2,
        });
      }
      const nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 1 + Math.random() * 3,
          color: pickSpectrumColor(Math.random()),
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
        st.y += st.speed * dt;
        st.x -= st.speed * 0.18 * dt;
        if (st.y - st.len > h || st.x + st.len < 0) {
          resetCyberStreak(st, w, h);
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
        
        ctx.strokeStyle = rgba(CYBER_GRID_COLOR, alpha);
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
      
      ctx.strokeStyle = rgba(CYBER_GRID_BRIGHT_COLOR, alpha);
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
      ctx.strokeStyle = rgba(SCANLINE_COLOR, 0.018 + 0.015 * Math.sin(time * 0.45 + y));
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
      grad.addColorStop(0, rgba(st.color, 0));
      grad.addColorStop(0.55, rgba(st.color, alpha));
      grad.addColorStop(1, rgba(st.color, alpha * 0.4));
      ctx.strokeStyle = grad;
      ctx.shadowBlur = 14;
      ctx.shadowColor = rgba(st.color, 0.45);
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
      ctx.shadowColor = rgba(n.color, 0.45);
      ctx.fillStyle = rgba(n.color, alpha * fade);
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
            color: pickSpectrumColor(Math.random()),
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
          ctx.shadowColor = rgba(cell.color, brightness * 0.55);
        }
        ctx.strokeStyle = rgba(cell.color, alpha);
        ctx.lineWidth = 1;
        hexPath(ctx, cell.x, cell.y, cell.size * 0.94);
        ctx.stroke();

        if (brightness > 0.72) {
          ctx.fillStyle = rgba(cell.color, (brightness - 0.72) * 0.55);
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
          speed: 35 + Math.random() * 45,
          length: 8 + Math.floor(Math.random() * 20),
          color: pickSpectrumColor(0.68 + Math.random() * 0.32),
          charIdx: Math.floor(Math.random() * 96),
          charTimer: 0,
          charRate: 3 + Math.random() * 6,
          charOffset: 0,
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
        col.y += col.speed * dt;
        col.charTimer += dt;
        if (col.charTimer >= col.charRate) {
          col.charTimer -= col.charRate;
          col.charOffset = (col.charOffset + 1 + Math.floor(Math.random() * 5)) % 96;
          col.charRate = 0.06 + Math.random() * 0.18;
        }
        if (col.y - col.length * s.fontSize > h) {
          col.y = -Math.random() * h * 0.4;
          col.speed = 35 + Math.random() * 45;
          col.color = pickSpectrumColor(0.68 + Math.random() * 0.32);
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
          const code = 0x30A0 + ((col.charIdx + col.charOffset + i * 3 + Math.floor(time * 6)) % 96);
          const ch = String.fromCharCode(code);
          if (i === 0) {
            ctx.fillStyle = rgba(col.color, Math.min(0.9, alpha * 1.2));
            ctx.shadowBlur = 8;
            ctx.shadowColor = rgba(col.color, 0.5);
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = rgba(col.color, alpha * 0.7);
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
      const count = 20;
      const boxes = [];
      for (let i = 0; i < count; i++) {
        boxes.push({
          wx: (Math.random() - 0.5) * w * 2.2,
          wy: (Math.random() - 0.5) * h * 2.0,
          wz: 160 + Math.random() * 520,
          size: 22 + Math.random() * 46,
          rx: Math.random() * Math.PI * 2,
          ry: Math.random() * Math.PI * 2,
          rz: Math.random() * Math.PI * 2,
          drx: (Math.random() - 0.5) * 0.04,
          dry: (Math.random() - 0.5) * 0.04,
          drz: (Math.random() - 0.5) * 0.03,
          driftX: (Math.random() - 0.5) * 10,
          driftY: (Math.random() - 0.5) * 10,
          color: pickSpectrumColor(Math.random()),
          phase: Math.random() * Math.PI * 2,
          nextJitter: Math.random() * 3,
          jitterTimer: 0,
          scalePulse: 0.94 + Math.random() * 0.08,
          pulseSpeed: 0.3 + Math.random() * 0.8,
        });
      }
      return { boxes };
    },
    resize(w, h, s) {
      const halfW = w * 1.1, halfH = h * 1.0;
      for (const b of s.boxes) {
        if (Math.abs(b.wx) > halfW) b.wx = (Math.random() - 0.5) * w * 1.8;
        if (Math.abs(b.wy) > halfH) b.wy = (Math.random() - 0.5) * h * 1.6;
      }
    },
    update(w, h, time, dt, s) {
      for (const b of s.boxes) {
        b.rx += b.drx * dt;
        b.ry += b.dry * dt;
        b.rz += b.drz * dt;
        b.wx += b.driftX * dt;
        b.wy += b.driftY * dt;
        
        // Random jitter in rotation and movement
        b.jitterTimer += dt;
        if (b.jitterTimer > b.nextJitter) {
          const jitterX = (Math.random() - 0.5) * 0.35;
          const jitterY = (Math.random() - 0.5) * 0.35;
          b.driftX += jitterX;
          b.driftY += jitterY;
          b.drx += (Math.random() - 0.5) * 0.006;
          b.dry += (Math.random() - 0.5) * 0.006;
          b.drz += (Math.random() - 0.5) * 0.004;
          
          // Occasionally change color
          if (Math.random() < 0.08) {
            b.color = pickSpectrumColor(Math.random());
          }
          
          b.jitterTimer = 0;
          b.nextJitter = 1 + Math.random() * 4;
        }
        
        // Random scale pulsing
        b.scalePulse = 0.92 + 0.10 * Math.sin(time * b.pulseSpeed + b.phase);
        
        // Boundaries with bounce
        const boundX = w * 1.2, boundY = h * 1.1;
        if (Math.abs(b.wx) > boundX) {
          b.driftX *= -0.9;
          b.wx = Math.sign(b.wx) * boundX;
        }
        if (Math.abs(b.wy) > boundY) {
          b.driftY *= -0.9;
          b.wy = Math.sign(b.wy) * boundY;
        }
        
        // Clamp rotation speeds
        const maxRot = 0.08;
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
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.42 + b.phase);
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
        const alphaBase = (0.22 + pulse * 0.28) * radial;
        ctx.strokeStyle = rgba(b.color, alphaBase);
        ctx.lineWidth = 1.35;
        ctx.shadowBlur = 12;
        ctx.shadowColor = rgba(b.color, 0.58 * radial);
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
  let scheduleTimeout = null;
  let currentTransition = null;
  let history = [];

  function spawn(anim) {
    return { anim, state: anim.create(W, H) };
  }

  const offA = document.createElement('canvas');
  const offCtxA = offA.getContext('2d');
  const offB = document.createElement('canvas');
  const offCtxB = offB.getContext('2d');

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
    return TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
  }

  function beginTransition() {
    if (nextItem) return;
    const idx = pickNext();
    nextItem = spawn(ANIMATORS[idx]);
    transitionStart = performance.now();
    currentTransition = pickNextTransition();
  }

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = Math.ceil(window.innerWidth * OVERSIZE);
    H = Math.ceil(window.innerHeight * OVERSIZE);
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

  function fadeTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const fadeOut = 1 - Math.pow(1 - t, 2.2);
    const fadeIn = Math.pow(t, 2.0);

    ctx.save();
    ctx.globalAlpha = 1 - fadeOut;
    animA.draw(ctx, w, h, time, stateA);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fadeIn;
    animB.draw(ctx, w, h, time, stateB);
    ctx.restore();

    ctx.restore();
  }

  function drawTransitionFrame(targetCtx, w, h, dpr, anim, state, time) {
    targetCtx.save();
    targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetCtx.clearRect(0, 0, w, h);
    anim.draw(targetCtx, w, h, time, state);
    targetCtx.restore();
  }

  function warpTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    drawTransitionFrame(offCtxA, w, h, dpr, animA, stateA, time);
    drawTransitionFrame(offCtxB, w, h, dpr, animB, stateB, time);

    const stripH = 10;
    const stripCount = Math.ceil(h / stripH);
    const blendAlpha = Math.min(1, t * 1.6);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < stripCount; i++) {
      const y = i * stripH;
      const sh = Math.min(stripH, h - y);
      const phase = i * 0.45 + time * 0.7;
      const offsetX = Math.sin(phase) * 42 * (1 - Math.abs(t - 0.5) * 2);

      ctx.globalAlpha = 1 - blendAlpha;
      ctx.drawImage(offA, 0, y * dpr, w * dpr, sh * dpr, offsetX, y, w, sh);

      ctx.globalAlpha = blendAlpha;
      ctx.drawImage(offB, 0, y * dpr, w * dpr, sh * dpr, -offsetX, y, w, sh);
    }

    ctx.restore();
  }

  function blockDissolveTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    drawTransitionFrame(offCtxA, w, h, dpr, animA, stateA, time);
    drawTransitionFrame(offCtxB, w, h, dpr, animB, stateB, time);

    const block = 18 + (1 - t) * 34;
    const cols = Math.ceil(w / block);
    const rows = Math.ceil(h / block);
    const revealSpeed = 2.1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const bx = x * block;
        const by = y * block;
        const bw = Math.min(block, w - bx);
        const bh = Math.min(block, h - by);
        const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const threshold = noise - Math.floor(noise);
        const alpha = Math.max(0, Math.min(1, (t * revealSpeed - threshold) * 2));

        ctx.globalAlpha = 1 - alpha;
        ctx.drawImage(offA, bx * dpr, by * dpr, bw * dpr, bh * dpr, bx, by, bw, bh);

        ctx.globalAlpha = alpha;
        ctx.drawImage(offB, bx * dpr, by * dpr, bw * dpr, bh * dpr, bx, by, bw, bh);
      }
    }

    ctx.restore();
  }

  function radialDissolveTransition(ctx, w, h, dpr, t, animA, stateA, animB, stateB, time) {
    drawTransitionFrame(offCtxA, w, h, dpr, animA, stateA, time);
    drawTransitionFrame(offCtxB, w, h, dpr, animB, stateB, time);

    const cx = w * (0.5 + Math.sin(time * 0.4) * 0.08);
    const cy = h * (0.5 + Math.cos(time * 0.35) * 0.08);
    const radius = Math.hypot(w, h) * Math.max(0.02, t * 1.15);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(offA, 0, 0, w * dpr, h * dpr, 0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = Math.min(1, t * 1.2);
    ctx.drawImage(offB, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
    ctx.restore();

    ctx.restore();
  }

  const TRANSITIONS = [
    fadeTransition,
    warpTransition,
    blockDissolveTransition,
    radialDissolveTransition,
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
      const raw = Math.min(1, (now - transitionStart) / TRANSITION_MS);

      currentTransition(
        ctx, W, H, DPR, raw,
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

    const SPRING_TENSION = 0.035;
    const SPRING_DAMPING = 0.82;

    velX += (mouseX - smoothX) * SPRING_TENSION;
    velY += (mouseY - smoothY) * SPRING_TENSION;
    velX *= SPRING_DAMPING;
    velY *= SPRING_DAMPING;
    smoothX += velX;
    smoothY += velY;

    const glowSpeed = Math.sqrt(velX * velX + velY * velY);
    const distanceRatio = Math.min(1, glowSpeed / 30);
    const targetRadius = 120 + Math.pow(distanceRatio, 0.5) * 180;
    smoothRadius += (targetRadius - smoothRadius) * 0.09;
    smoothRadius = Math.max(100, Math.min(380, smoothRadius));

    // Smooth fade-in animation with easing
    const fadeSpeed = 0.08;
    const idleTime = Date.now() - lastMouseActivity;
    
    if (idleTime > 4000) {
      fadeTarget = 0;
    }
    
    fadeProgress += (fadeTarget - fadeProgress) * fadeSpeed;
    if (fadeProgress < 0.01) fadeProgress = 0;

    const radialReady = Math.max(0, Math.min(1, (now - startupTime - RADIAL_START_DELAY_MS) / RADIAL_FADE_IN_MS));
    const radialFade = fadeProgress * radialReady;

    // Only draw gradient if visible
    if (radialFade > 0.01) {
      const gradient = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, smoothRadius);
      gradient.addColorStop(0, rgba(MOUSE_GLOW_COLOR, 0.15 * radialFade));
      gradient.addColorStop(0.7, rgba(MOUSE_GLOW_COLOR, 0.06 * radialFade));
      gradient.addColorStop(1, rgba(MOUSE_GLOW_COLOR, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    requestAnimationFrame(frame);
  }

  const startupTime = performance.now();
  const startIdx = pickNext();
  history.push(startIdx);
  window.addEventListener('resize', () => { resize(); });
  resize();
  currentItem = spawn(ANIMATORS[startIdx]);
  scheduleNext();

  let mouseX = W / 2;
  let mouseY = H / 2;
  let smoothX = mouseX;
  let smoothY = mouseY;
  let velX = 0;
  let velY = 0;
  let smoothRadius = 350;
  let fadeProgress = 0;
  let fadeTarget = 0;
  let lastMouseActivity = Date.now();
  
  function triggerFadeIn() {
    fadeTarget = 1;
    lastMouseActivity = Date.now();
  }
  
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.offsetWidth / rect.width;
    const scaleY = canvas.offsetHeight / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
    triggerFadeIn();
  });
  
  requestAnimationFrame(frame);
})();
