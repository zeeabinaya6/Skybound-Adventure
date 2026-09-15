/**
 * SKYBOUND ADVENTURE
 * Pure Vanilla JavaScript 2D Platformer
 * No frameworks, no external libraries, 100% self-contained
 */

(function () {
  'use strict';

  // ===================================================
  // 1. CANVAS & CONTEXT SETUP
  // ===================================================
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const VIEW_W = 1024;
  const VIEW_H = 576;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  // DOM Elements
  const hud = document.getElementById('hud');
  const hudScore = document.getElementById('hud-score');
  const hudCoins = document.getElementById('hud-coins');
  const hudLives = document.getElementById('hud-lives');
  const hudLevel = document.getElementById('hud-level');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');

  const mainMenu = document.getElementById('main-menu');
  const btnStart = document.getElementById('btn-start');
  const btnHowTo = document.getElementById('btn-how-to');

  const howToPlay = document.getElementById('how-to-play');
  const btnBackHowTo = document.getElementById('btn-back-how-to');

  const gameOverScreen = document.getElementById('game-over-screen');
  const gameOverScore = document.getElementById('game-over-score');
  const gameOverCoins = document.getElementById('game-over-coins');
  const btnRestart = document.getElementById('btn-restart');
  const btnMenuFromOver = document.getElementById('btn-menu-from-over');

  const winScreen = document.getElementById('win-screen');
  const winScore = document.getElementById('win-score');
  const winCoins = document.getElementById('win-coins');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnMenuFromWin = document.getElementById('btn-menu-from-win');

  const levelBanner = document.getElementById('level-banner');
  const bannerTitle = document.getElementById('banner-title');
  const bannerDesc = document.getElementById('banner-desc');

  // ===================================================
  // 2. AUDIO SYNTHESIZER (WEB AUDIO API)
  // ===================================================
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, endFreq = null, volume = 0.2) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type || 'sine';
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + duration);
      }

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  const Sound = {
    jump() {
      playTone(220, 'sine', 0.15, 480, 0.18);
    },
    coin() {
      playTone(987, 'triangle', 0.1, 1318, 0.2);
    },
    stomp() {
      playTone(350, 'square', 0.12, 120, 0.22);
    },
    hurt() {
      playTone(180, 'sawtooth', 0.25, 60, 0.25);
    },
    portal() {
      playTone(440, 'triangle', 0.4, 880, 0.2);
      setTimeout(() => playTone(660, 'sine', 0.4, 1320, 0.2), 150);
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        setTimeout(() => playTone(n, 'triangle', 0.3, n * 1.05, 0.22), idx * 120);
      });
    },
    gameOver() {
      const notes = [440, 415.3, 392, 349.2];
      notes.forEach((n, idx) => {
        setTimeout(() => playTone(n, 'sawtooth', 0.3, n * 0.9, 0.2), idx * 140);
      });
    },
    bossHit() {
      playTone(140, 'square', 0.2, 50, 0.3);
    }
  };

  btnSoundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSoundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  });

  // ===================================================
  // 3. GAME STATE & VARIABLES
  // ===================================================
  const GameState = {
    MENU: 'MENU',
    HOWTO: 'HOWTO',
    PLAYING: 'PLAYING',
    TRANSITION: 'TRANSITION',
    GAMEOVER: 'GAMEOVER',
    WIN: 'WIN'
  };

  let currentState = GameState.MENU;
  let score = 0;
  let coinsCollected = 0;
  let lives = 3;
  let currentLevelIdx = 0;
  let gameTime = 0;

  // Keyboard input state
  const keys = {
    left: false,
    right: false,
    up: false,
    space: false
  };

  window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
      keys.space = true;
      keys.up = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
      keys.space = false;
      keys.up = false;
    }
  });

  // ===================================================
  // 4. PARTICLE ENGINE
  // ===================================================
  class ParticleSystem {
    constructor() {
      this.particles = [];
    }

    add(x, y, color, vx, vy, size, life, shape = 'circle') {
      this.particles.push({
        x, y, color, vx, vy, size,
        maxLife: life,
        life,
        shape
      });
    }

    spawnBurst(x, y, color, count = 10, speed = 3) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
        const spd = (Math.random() * 0.7 + 0.3) * speed;
        this.add(
          x, y, color,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd - 1,
          Math.random() * 4 + 3,
          20 + Math.random() * 15,
          Math.random() > 0.5 ? 'star' : 'circle'
        );
      }
    }

    spawnDust(x, y) {
      for (let i = 0; i < 4; i++) {
        this.add(
          x + (Math.random() - 0.5) * 16,
          y,
          'rgba(255, 255, 255, 0.7)',
          (Math.random() - 0.5) * 1.5,
          -Math.random() * 1.2,
          Math.random() * 3 + 2,
          15
        );
      }
    }

    update() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // subtle gravity
        p.life--;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    draw(ctx, camX) {
      for (const p of this.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        const screenX = p.x - camX;
        const screenY = p.y;

        if (p.shape === 'star') {
          // Draw little diamond/star
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - p.size);
          ctx.lineTo(screenX + p.size, screenY);
          ctx.lineTo(screenX, screenY + p.size);
          ctx.lineTo(screenX - p.size, screenY);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  const particles = new ParticleSystem();

  // ===================================================
  // 5. CAMERA
  // ===================================================
  const camera = {
    x: 0,
    y: 0,
    width: VIEW_W,
    height: VIEW_H,
    update(targetX, levelWidth) {
      // Smooth follow target with horizontal centering
      const desiredX = targetX - this.width * 0.4;
      this.x += (desiredX - this.x) * 0.1;
      // Clamp within level boundary
      if (this.x < 0) this.x = 0;
      if (this.x > levelWidth - this.width) {
        this.x = Math.max(0, levelWidth - this.width);
      }
    }
  };

  // ===================================================
  // 6. PLAYER CHARACTER
  // ===================================================
  class Player {
    constructor() {
      this.width = 36;
      this.height = 46;
      this.reset(100, 300);
    }

    reset(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.maxSpeed = 3.4;      // Kecepatan jalan nyaman (~3.4 px/frame)
      this.accel = 0.35;        // Efek akselerasi halus
      this.friction = 0.70;     // Efek deselerasi halus dan berhenti tepat
      this.jumpPower = -11.6;   // Seimbang dengan kecepatan jalan
      this.gravity = 0.52;      // Gravitasi seimbang
      this.onGround = false;
      this.facingRight = true;
      this.invulnerableTimer = 0;
      this.animFrame = 0;
      this.coyoteCounter = 0;
    }

    update(platforms) {
      // Horizontal Movement dengan akselerasi dan deselerasi halus
      let moveDir = 0;
      if (keys.left) moveDir -= 1;
      if (keys.right) moveDir += 1;

      if (moveDir !== 0) {
        // Akselerasi bertahap hingga maxSpeed
        this.vx += moveDir * this.accel;
        if (this.vx > this.maxSpeed) this.vx = this.maxSpeed;
        if (this.vx < -this.maxSpeed) this.vx = -this.maxSpeed;
        this.facingRight = moveDir > 0;
        this.animFrame += Math.abs(this.vx) * 0.055;

        if (this.onGround && Math.random() < 0.15) {
          particles.spawnDust(this.x + this.width / 2, this.y + this.height);
        }
      } else {
        // Deselerasi halus ketika tombol dilepas - berhenti stabil tanpa meluncur terus
        this.vx *= this.friction;
        if (Math.abs(this.vx) < 0.15) {
          this.vx = 0;
        }
        this.animFrame = 0;
      }

      // Coyote time for jump responsiveness
      if (this.onGround) {
        this.coyoteCounter = 8;
      } else if (this.coyoteCounter > 0) {
        this.coyoteCounter--;
      }

      // Jumping seimbang
      if ((keys.space || keys.up) && this.coyoteCounter > 0 && this.vy >= 0) {
        this.vy = this.jumpPower;
        this.onGround = false;
        this.coyoteCounter = 0;
        Sound.jump();
        particles.spawnDust(this.x + this.width / 2, this.y + this.height);
      }

      // Apply Gravity
      this.vy += this.gravity;
      if (this.vy > 12) this.vy = 12; // Terminal velocity yang seimbang

      // Invulnerability flash timer
      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer--;
      }

      // Horizontal Collision
      this.x += this.vx;
      this.checkHorizontalCollision(platforms);

      // Vertical Collision
      this.y += this.vy;
      this.onGround = false;
      this.checkVerticalCollision(platforms);
    }

    checkHorizontalCollision(platforms) {
      for (const plat of platforms) {
        if (!plat.solid) continue;
        if (
          this.x < plat.x + plat.w &&
          this.x + this.width > plat.x &&
          this.y < plat.y + plat.h - 4 &&
          this.y + this.height > plat.y + 6
        ) {
          if (this.vx > 0) {
            this.x = plat.x - this.width;
            this.vx = 0;
          } else if (this.vx < 0) {
            this.x = plat.x + plat.w;
            this.vx = 0;
          }
        }
      }
    }

    checkVerticalCollision(platforms) {
      for (const plat of platforms) {
        if (
          this.x + this.width > plat.x + 2 &&
          this.x < plat.x + plat.w - 2
        ) {
          // Landing on top of platform
          if (
            this.vy >= 0 &&
            this.y + this.height >= plat.y &&
            this.y + this.height <= plat.y + Math.max(16, this.vy + 8)
          ) {
            this.y = plat.y - this.height;
            this.vy = 0;
            this.onGround = true;

            // Carry on moving platforms
            if (plat.isMoving && plat.dx) {
              this.x += plat.dx;
            }
          }
          // Hitting ceiling
          else if (
            plat.solid &&
            this.vy < 0 &&
            this.y <= plat.y + plat.h &&
            this.y >= plat.y + plat.h - 14
          ) {
            this.y = plat.y + plat.h;
            this.vy = 0;
          }
        }
      }
    }

    draw(ctx, camX) {
      // Invulnerability flickering
      if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
        return;
      }

      const drawX = Math.round(this.x - camX);
      const drawY = Math.round(this.y);

      ctx.save();
      ctx.translate(drawX + this.width / 2, drawY + this.height / 2);

      // Flip when facing left
      if (!this.facingRight) {
        ctx.scale(-1, 1);
      }

      // Jump stretch/squash
      let scaleY = 1;
      let scaleX = 1;
      if (!this.onGround) {
        if (this.vy < 0) {
          scaleY = 1.12;
          scaleX = 0.9;
        } else {
          scaleY = 0.95;
          scaleX = 1.05;
        }
      }
      ctx.scale(scaleX, scaleY);

      const runCycle = Math.sin(this.animFrame) * 6;

      // 1. Shadow beneath
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Backpack (drawn behind adventurer)
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(-17, -8, 7, 18);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-16, -6, 5, 6);

      // 3. Legs / Boots (animated running)
      ctx.fillStyle = '#451a03'; // Brown boots
      if (this.onGround && Math.abs(this.vx) > 0.5) {
        ctx.fillRect(-8 + runCycle, 14, 6, 8);
        ctx.fillRect(2 - runCycle, 14, 6, 8);
      } else {
        ctx.fillRect(-7, 14, 6, 8);
        ctx.fillRect(1, 14, 6, 8);
      }

      // 4. Body / Shirt (Cyan Adventure Tunic)
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(-10, -5, 20, 20, [4, 4, 3, 3]);
      ctx.fill();

      // Belt
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-10, 10, 20, 4);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-2, 9, 5, 6); // Gold buckle

      // 5. Head / Face (Warm skin tone)
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -11, 11, 0, Math.PI * 2);
      ctx.fill();

      // Rosy cheek
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(4, -9, 3, 0, Math.PI * 2);
      ctx.fill();

      // Eye (Tracks direction)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(3, -12, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // White eye glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -13, 1, 0, Math.PI * 2);
      ctx.fill();

      // 6. Explorer Safari Hat
      ctx.fillStyle = '#d97706'; // Hat base
      ctx.beginPath();
      ctx.arc(0, -18, 12, Math.PI, 0); // Hat dome
      ctx.fill();

      // Hat Brim
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(0, -18, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hat Ribbon
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-11, -20, 22, 3);

      ctx.restore();
    }
  }

  // ===================================================
  // 7. LEVEL ENTITIES: COINS, ENEMIES, PLATFORMS, BOSS
  // ===================================================
  class Coin {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 22;
      this.height = 22;
      this.collected = false;
      this.bobOffset = Math.random() * Math.PI * 2;
    }

    update() {
      this.bobOffset += 0.08;
    }

    draw(ctx, camX) {
      if (this.collected) return;
      const screenX = this.x - camX;
      const screenY = this.y + Math.sin(this.bobOffset) * 4;

      // 3D spinning effect
      const spinScale = Math.abs(Math.cos(this.bobOffset * 0.7));

      ctx.save();
      ctx.translate(screenX + this.width / 2, screenY + this.height / 2);
      ctx.scale(Math.max(0.15, spinScale), 1);

      // Gold Coin Body
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Inner Gold Ring
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Center Star / Symbol
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  class Enemy {
    constructor(type, x, y, range = 120, speed = 1.6) {
      this.type = type; // 'slime', 'beetle', 'wisp'
      this.x = x;
      this.y = y;
      this.startX = x;
      this.range = range;
      this.speed = speed;
      this.dir = 1;
      this.width = 34;
      this.height = 28;
      this.defeated = false;
      this.animTick = Math.random() * 10;
    }

    update() {
      if (this.defeated) return;

      this.x += this.speed * this.dir;
      if (this.x > this.startX + this.range) {
        this.dir = -1;
      } else if (this.x < this.startX) {
        this.dir = 1;
      }

      this.animTick += 0.12;
    }

    draw(ctx, camX) {
      if (this.defeated) return;
      const screenX = Math.round(this.x - camX);
      const screenY = Math.round(this.y);

      ctx.save();
      ctx.translate(screenX + this.width / 2, screenY + this.height / 2);
      if (this.dir < 0) ctx.scale(-1, 1);

      const squash = Math.sin(this.animTick) * 0.15;

      if (this.type === 'slime') {
        // Cute Forest Cloud Slime
        ctx.scale(1 + squash, 1 - squash);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(0, 4, 14, Math.PI, 0);
        ctx.quadraticCurveTo(14, 14, 0, 14);
        ctx.quadraticCurveTo(-14, 14, -14, 4);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(4, 2, 4, 0, Math.PI * 2);
        ctx.arc(10, 2, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(5, 2, 2, 0, Math.PI * 2);
        ctx.arc(11, 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 'beetle') {
        // Cloud Ruins Spiky Beetle
        ctx.scale(1 + squash, 1 - squash);
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(0, 0, 14, Math.PI, 0);
        ctx.lineTo(14, 12);
        ctx.lineTo(-14, 12);
        ctx.closePath();
        ctx.fill();

        // Spikes on back
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-6, -14);
        ctx.lineTo(-2, -6);
        ctx.lineTo(-10, -6);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(6, -14);
        ctx.lineTo(10, -6);
        ctx.lineTo(2, -6);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(8, 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dark Sky Shadow Wisp
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 13 + squash * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f3e8ff';
        ctx.beginPath();
        ctx.arc(4, -2, 4, 0, Math.PI * 2);
        ctx.arc(10, -2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ===================================================
  // 8. LEVEL 3 BOSS: SKY GUARDIAN
  // ===================================================
  class Boss {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.startX = x;
      this.width = 72;
      this.height = 76;
      this.hp = 3;
      this.maxHp = 3;
      this.speed = 1.4;
      this.dir = -1;
      this.patrolRange = 260;
      this.defeated = false;
      this.hitCooldown = 0;
      this.floatTimer = 0;
    }

    update(player) {
      if (this.defeated) return;

      if (this.hitCooldown > 0) this.hitCooldown--;
      this.floatTimer += 0.08;

      // Boss patrol movement
      this.x += this.speed * this.dir;
      if (this.x < this.startX - this.patrolRange) {
        this.dir = 1;
      } else if (this.x > this.startX + 20) {
        this.dir = -1;
      }
    }

    takeDamage() {
      if (this.hitCooldown > 0 || this.defeated) return false;
      this.hp--;
      this.hitCooldown = 40;
      Sound.bossHit();
      particles.spawnBurst(this.x + this.width / 2, this.y + this.height / 2, '#f59e0b', 24, 6);

      if (this.hp <= 0) {
        this.defeated = true;
        Sound.win();
        particles.spawnBurst(this.x + this.width / 2, this.y + this.height / 2, '#a855f7', 40, 8);
        particles.spawnBurst(this.x + this.width / 2, this.y + this.height / 2, '#fbbf24', 40, 8);
        return true;
      }
      this.speed += 0.3; // Sedikit lebih cepat saat terluka
      return true;
    }

    draw(ctx, camX) {
      if (this.defeated) return;
      const screenX = Math.round(this.x - camX);
      const hoverY = Math.sin(this.floatTimer) * 8;
      const screenY = Math.round(this.y + hoverY);

      ctx.save();
      ctx.translate(screenX + this.width / 2, screenY + this.height / 2);

      // Hit flashing
      if (this.hitCooldown > 0 && Math.floor(this.hitCooldown / 4) % 2 === 0) {
        ctx.filter = 'brightness(2) saturate(2)';
      }

      // Boss Body (Ancient Sky Golem)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-32, -30, 64, 60, [16, 16, 10, 10]);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      // Glowing Rune Center Core
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 2, 12, 0, Math.PI * 2);
      ctx.fill();

      // Golden Crown
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(-24, -30);
      ctx.lineTo(-14, -44);
      ctx.lineTo(-4, -34);
      ctx.lineTo(4, -44);
      ctx.lineTo(14, -34);
      ctx.lineTo(24, -44);
      ctx.lineTo(24, -30);
      ctx.closePath();
      ctx.fill();

      // Glowing Eyes
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-12, -14, 5, 0, Math.PI * 2);
      ctx.arc(12, -14, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // BOSS HEALTH BAR (HUD OVER HEAD)
      const barW = 80;
      const barH = 10;
      const barX = screenX + (this.width - barW) / 2;
      const barY = screenY - 26;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(barX, barY, barW, barH);

      const healthPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(barX, barY, barW * healthPct, barH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SKY GUARDIAN', barX + barW / 2, barY - 6);
    }
  }

  // ===================================================
  // 9. PORTAL AT LEVEL END
  // ===================================================
  class Portal {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 48;
      this.height = 70;
      this.rotation = 0;
    }

    update() {
      this.rotation += 0.05;
      if (Math.random() < 0.3) {
        particles.add(
          this.x + this.width / 2 + (Math.random() - 0.5) * 20,
          this.y + this.height / 2 + (Math.random() - 0.5) * 30,
          '#a855f7',
          (Math.random() - 0.5) * 1.5,
          -Math.random() * 2,
          Math.random() * 3 + 2,
          25,
          'star'
        );
      }
    }

    draw(ctx, camX) {
      const screenX = Math.round(this.x - camX);
      const screenY = Math.round(this.y);

      ctx.save();
      ctx.translate(screenX + this.width / 2, screenY + this.height / 2);

      // Portal Frame / Oval Aura
      const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 32);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#c084fc');
      grad.addColorStop(0.7, '#7e22ce');
      grad.addColorStop(1, 'rgba(126, 34, 206, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Swirling rings
      ctx.rotate(this.rotation);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 28, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ===================================================
  // 10. LEVEL DEFINITIONS
  // ===================================================
  const LEVELS = [
    // -------------------------------------------------
    // LEVEL 1: FOREST SKY (Easy & Gentle)
    // -------------------------------------------------
    {
      id: 1,
      name: '1 — FOREST SKY',
      width: 2400,
      height: VIEW_H,
      bgColor: '#38bdf8',
      spawn: { x: 100, y: 380 },
      platforms: [
        // Ground islands
        { x: 0, y: 460, w: 500, h: 120, solid: true, type: 'grass' },
        { x: 600, y: 460, w: 450, h: 120, solid: true, type: 'grass' },
        { x: 1150, y: 460, w: 400, h: 120, solid: true, type: 'grass' },
        { x: 1650, y: 460, w: 750, h: 120, solid: true, type: 'grass' },

        // Stepping platforms
        { x: 260, y: 340, w: 120, h: 26, solid: true, type: 'wood' },
        { x: 440, y: 280, w: 120, h: 26, solid: true, type: 'wood' },
        { x: 700, y: 330, w: 130, h: 26, solid: true, type: 'wood' },
        { x: 920, y: 250, w: 140, h: 26, solid: true, type: 'wood' },
        { x: 1240, y: 350, w: 120, h: 26, solid: true, type: 'wood' },
        { x: 1440, y: 270, w: 130, h: 26, solid: true, type: 'wood' },
        { x: 1800, y: 360, w: 120, h: 26, solid: true, type: 'wood' }
      ],
      spikes: [
        { x: 740, y: 436, w: 32, h: 24 },
        { x: 1300, y: 436, w: 32, h: 24 },
        { x: 1860, y: 436, w: 32, h: 24 }
      ],
      coins: [
        { x: 180, y: 410 },
        { x: 310, y: 290 },
        { x: 500, y: 230 },
        { x: 650, y: 410 },
        { x: 760, y: 280 },
        { x: 980, y: 200 },
        { x: 1200, y: 410 },
        { x: 1300, y: 300 },
        { x: 1500, y: 220 },
        { x: 1720, y: 410 },
        { x: 1860, y: 310 },
        { x: 2050, y: 410 }
      ],
      enemies: [
        { type: 'slime', x: 280, y: 432, range: 120, speed: 1.0 },
        { type: 'slime', x: 800, y: 432, range: 140, speed: 1.1 },
        { type: 'slime', x: 1350, y: 432, range: 120, speed: 1.1 }
      ],
      portal: { x: 2250, y: 390 }
    },

    // -------------------------------------------------
    // LEVEL 2: CLOUD RUINS (Moving Platforms & Spikes)
    // -------------------------------------------------
    {
      id: 2,
      name: '2 — CLOUD RUINS',
      width: 2700,
      height: VIEW_H,
      bgColor: '#f97316', // Sunset Sky
      spawn: { x: 100, y: 380 },
      platforms: [
        { x: 0, y: 460, w: 420, h: 120, solid: true, type: 'ruins' },
        { x: 520, y: 460, w: 340, h: 120, solid: true, type: 'ruins' },

        // Moving Platforms over big chasms
        {
          x: 900, y: 380, w: 120, h: 26, solid: true, type: 'stone',
          isMoving: true, minX: 900, maxX: 1140, speed: 1.4, dir: 1, dx: 0
        },
        { x: 1200, y: 440, w: 380, h: 120, solid: true, type: 'ruins' },
        {
          x: 1640, y: 400, w: 120, h: 26, solid: true, type: 'stone',
          isMoving: true, minX: 1640, maxX: 1880, speed: 1.6, dir: 1, dx: 0
        },
        { x: 1950, y: 460, w: 750, h: 120, solid: true, type: 'ruins' },

        // Raised ruins platforms
        { x: 220, y: 340, w: 110, h: 24, solid: true, type: 'stone' },
        { x: 620, y: 320, w: 120, h: 24, solid: true, type: 'stone' },
        { x: 1300, y: 300, w: 130, h: 24, solid: true, type: 'stone' },
        { x: 1470, y: 220, w: 120, h: 24, solid: true, type: 'stone' },
        { x: 2100, y: 340, w: 120, h: 24, solid: true, type: 'stone' },
        { x: 2280, y: 260, w: 120, h: 24, solid: true, type: 'stone' }
      ],
      spikes: [
        { x: 280, y: 436, w: 32, h: 24 },
        { x: 680, y: 436, w: 32, h: 24 },
        { x: 1260, y: 416, w: 32, h: 24 },
        { x: 1420, y: 416, w: 32, h: 24 },
        { x: 2160, y: 436, w: 32, h: 24 }
      ],
      coins: [
        { x: 160, y: 410 },
        { x: 275, y: 290 },
        { x: 580, y: 410 },
        { x: 680, y: 270 },
        { x: 1020, y: 330 },
        { x: 1240, y: 380 },
        { x: 1360, y: 250 },
        { x: 1530, y: 170 },
        { x: 1760, y: 350 },
        { x: 2040, y: 410 },
        { x: 2160, y: 290 },
        { x: 2340, y: 210 },
        { x: 2500, y: 410 }
      ],
      enemies: [
        { type: 'beetle', x: 220, y: 432, range: 120, speed: 1.2 },
        { type: 'slime', x: 580, y: 432, range: 120, speed: 1.1 },
        { type: 'beetle', x: 1320, y: 412, range: 140, speed: 1.3 },
        { type: 'beetle', x: 2100, y: 432, range: 160, speed: 1.4 }
      ],
      portal: { x: 2580, y: 390 }
    },

    // -------------------------------------------------
    // LEVEL 3: DARK SKY & SKY GUARDIAN BOSS
    // -------------------------------------------------
    {
      id: 3,
      name: '3 — DARK SKY (BOSS)',
      width: 2900,
      height: VIEW_H,
      bgColor: '#1e1b4b', // Midnight Nebula
      spawn: { x: 100, y: 380 },
      platforms: [
        { x: 0, y: 460, w: 450, h: 120, solid: true, type: 'dark' },
        { x: 550, y: 460, w: 360, h: 120, solid: true, type: 'dark' },
        {
          x: 960, y: 380, w: 120, h: 26, solid: true, type: 'stone',
          isMoving: true, minX: 960, maxX: 1200, speed: 1.6, dir: 1, dx: 0
        },
        { x: 1280, y: 460, w: 400, h: 120, solid: true, type: 'dark' },
        // Boss Arena Island (Spacious for battle!)
        { x: 1800, y: 460, w: 1050, h: 120, solid: true, type: 'dark' },

        // Sky platforms
        { x: 240, y: 320, w: 110, h: 24, solid: true, type: 'stone' },
        { x: 640, y: 330, w: 110, h: 24, solid: true, type: 'stone' },
        { x: 1360, y: 320, w: 120, h: 24, solid: true, type: 'stone' },
        { x: 1520, y: 240, w: 120, h: 24, solid: true, type: 'stone' },
        // Stepping stones in Boss Arena
        { x: 2000, y: 330, w: 120, h: 24, solid: true, type: 'stone' },
        { x: 2350, y: 330, w: 120, h: 24, solid: true, type: 'stone' }
      ],
      spikes: [
        { x: 260, y: 436, w: 32, h: 24 },
        { x: 700, y: 436, w: 32, h: 24 },
        { x: 1400, y: 436, w: 32, h: 24 }
      ],
      coins: [
        { x: 160, y: 410 },
        { x: 290, y: 270 },
        { x: 620, y: 410 },
        { x: 690, y: 280 },
        { x: 1080, y: 330 },
        { x: 1340, y: 410 },
        { x: 1420, y: 270 },
        { x: 1580, y: 190 },
        { x: 1950, y: 410 },
        { x: 2060, y: 280 },
        { x: 2410, y: 280 }
      ],
      enemies: [
        { type: 'wisp', x: 240, y: 432, range: 130, speed: 1.3 },
        { type: 'wisp', x: 620, y: 432, range: 140, speed: 1.4 },
        { type: 'wisp', x: 1340, y: 432, range: 140, speed: 1.5 }
      ],
      hasBoss: true,
      bossData: { x: 2300, y: 384 },
      portal: { x: 2750, y: 390 }
    }
  ];

  // Active level instances
  const player = new Player();
  let currentLevel = null;
  let activeCoins = [];
  let activeEnemies = [];
  let activeBoss = null;
  let activePortal = null;

  // ===================================================
  // 11. LOAD LEVEL & TRANSITIONS
  // ===================================================
  function loadLevel(levelIdx) {
    currentLevelIdx = levelIdx;
    const lvl = LEVELS[levelIdx];
    currentLevel = lvl;

    // Reset player position
    player.reset(lvl.spawn.x, lvl.spawn.y);

    // Setup coins
    activeCoins = lvl.coins.map(c => new Coin(c.x, c.y));

    // Setup enemies
    activeEnemies = lvl.enemies.map(e => new Enemy(e.type, e.x, e.y, e.range, e.speed));

    // Setup boss if Level 3
    if (lvl.hasBoss) {
      activeBoss = new Boss(lvl.bossData.x, lvl.bossData.y);
    } else {
      activeBoss = null;
    }

    // Setup portal
    activePortal = new Portal(lvl.portal.x, lvl.portal.y);

    // Update HUD
    updateHUD();

    // Show Level Banner
    showBanner(`LEVEL ${lvl.id}`, lvl.name);
  }

  function showBanner(title, desc) {
    bannerTitle.textContent = title;
    bannerDesc.textContent = desc;
    levelBanner.classList.add('show');
    setTimeout(() => {
      levelBanner.classList.remove('show');
    }, 2200);
  }

  function updateHUD() {
    hudScore.textContent = score;
    hudCoins.textContent = coinsCollected;
    hudLives.textContent = lives;
    hudLevel.textContent = currentLevel ? currentLevel.name : '';
  }

  // ===================================================
  // 12. DRAWING BACKGROUND & ENVIRONMENT
  // ===================================================
  function drawBackground(ctx, camX, level) {
    const w = VIEW_W;
    const h = VIEW_H;

    if (level.id === 1) {
      // 1. Daytime Forest Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.6, '#bae6fd');
      skyGrad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Sun
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(850 - camX * 0.05, 90, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Distant Parallax Clouds
      drawCloud(ctx, 150 - camX * 0.15, 80, 130, 45);
      drawCloud(ctx, 450 - camX * 0.15, 130, 170, 55);
      drawCloud(ctx, 800 - camX * 0.15, 70, 150, 50);
      drawCloud(ctx, 1300 - camX * 0.15, 110, 190, 60);
      drawCloud(ctx, 1800 - camX * 0.15, 90, 160, 50);

      // Distant Floating Mountains
      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.moveTo(100 - camX * 0.25, 480);
      ctx.lineTo(260 - camX * 0.25, 340);
      ctx.lineTo(420 - camX * 0.25, 480);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(500 - camX * 0.25, 480);
      ctx.lineTo(720 - camX * 0.25, 310);
      ctx.lineTo(940 - camX * 0.25, 480);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(1100 - camX * 0.25, 480);
      ctx.lineTo(1350 - camX * 0.25, 330);
      ctx.lineTo(1600 - camX * 0.25, 480);
      ctx.fill();

    } else if (level.id === 2) {
      // 2. Sunset Cloud Ruins Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#f97316');
      skyGrad.addColorStop(0.5, '#fb923c');
      skyGrad.addColorStop(0.85, '#fdba74');
      skyGrad.addColorStop(1, '#fed7aa');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Sunset Sun
      ctx.fillStyle = '#fffbeb';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(880 - camX * 0.05, 140, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Sunset Clouds
      drawCloud(ctx, 200 - camX * 0.15, 90, 160, 50, '#ffedd5');
      drawCloud(ctx, 600 - camX * 0.15, 140, 200, 65, '#fed7aa');
      drawCloud(ctx, 1100 - camX * 0.15, 80, 180, 55, '#ffedd5');
      drawCloud(ctx, 1600 - camX * 0.15, 120, 210, 60, '#fed7aa');

      // Floating Ancient Pillar Silhouettes
      ctx.fillStyle = '#c2410c';
      for (let i = 0; i < 6; i++) {
        const px = i * 450 + 100 - camX * 0.3;
        ctx.fillRect(px, 320, 45, 160);
        ctx.fillRect(px - 10, 310, 65, 14); // Pillar capital
      }

    } else {
      // 3. Dark Sky Midnight Nebula
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#090724');
      skyGrad.addColorStop(0.5, '#1e1b4b');
      skyGrad.addColorStop(1, '#312e81');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Mystic Glowing Moon
      ctx.fillStyle = '#e0e7ff';
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.arc(860 - camX * 0.04, 90, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Twinkling Stars
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 35; s++) {
        const starX = (s * 97 + 30 - camX * 0.08) % (w + 200);
        const starY = (s * 43) % 250 + 20;
        const starR = (s % 3 === 0) ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(starX, starY, starR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mystic Purple Clouds
      drawCloud(ctx, 250 - camX * 0.15, 120, 180, 55, 'rgba(129, 140, 248, 0.35)');
      drawCloud(ctx, 850 - camX * 0.15, 80, 220, 65, 'rgba(192, 132, 252, 0.3)');
      drawCloud(ctx, 1450 - camX * 0.15, 140, 200, 60, 'rgba(129, 140, 248, 0.35)');
    }
  }

  function drawCloud(ctx, x, y, width, height, color = 'rgba(255, 255, 255, 0.85)') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, height / 2);
    ctx.arc(x + width * 0.35, y, height * 0.55, 0, Math.PI * 2);
    ctx.arc(x + width * 0.65, y + 4, height * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ===================================================
  // 13. DRAWING PLATFORMS & OBSTACLES
  // ===================================================
  function drawPlatforms(ctx, camX, platforms, level) {
    for (const plat of platforms) {
      const screenX = Math.round(plat.x - camX);
      const screenY = Math.round(plat.y);

      // Skip off-screen rendering
      if (screenX + plat.w < -20 || screenX > VIEW_W + 20) continue;

      ctx.save();

      if (plat.type === 'grass') {
        // Lush Forest Island Ground
        ctx.fillStyle = '#854d0e'; // Earth dirt
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, plat.w, plat.h, [14, 14, 0, 0]);
        ctx.fill();

        // Lush Grass Top layer
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, plat.w, 16, [14, 14, 4, 4]);
        ctx.fill();

        // Little grass hanging fringe
        ctx.fillStyle = '#16a34a';
        for (let gx = screenX + 10; gx < screenX + plat.w - 10; gx += 20) {
          ctx.beginPath();
          ctx.moveTo(gx, screenY + 16);
          ctx.lineTo(gx + 6, screenY + 24);
          ctx.lineTo(gx + 12, screenY + 16);
          ctx.fill();
        }

      } else if (plat.type === 'ruins') {
        // Ancient Stone Blocks
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, plat.w, plat.h, [8, 8, 0, 0]);
        ctx.fill();

        // Top decorative border
        ctx.fillStyle = '#a8a29e';
        ctx.fillRect(screenX, screenY, plat.w, 14);

        // Stone seam lines
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 2;
        for (let sx = screenX + 40; sx < screenX + plat.w - 10; sx += 60) {
          ctx.beginPath();
          ctx.moveTo(sx, screenY + 14);
          ctx.lineTo(sx, screenY + plat.h);
          ctx.stroke();
        }

      } else if (plat.type === 'dark') {
        // Dark Obsidian / Rune Ground
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, plat.w, plat.h, [12, 12, 0, 0]);
        ctx.fill();

        // Glowing Purple Rune Top
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(screenX, screenY, plat.w, 12);
        ctx.fillStyle = '#818cf8';
        ctx.fillRect(screenX, screenY, plat.w, 3);

      } else if (plat.type === 'stone') {
        // Floating Stone Platform
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, plat.w, plat.h, 8);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(screenX + 2, screenY + 2, plat.w - 4, 6);

        // Moving platform gear/arrows indicator
        if (plat.isMoving) {
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('◀ ▶', screenX + plat.w / 2, screenY + 18);
        }

      } else {
        // Wooden Plank Platform
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.roundRect(screenX, screenY, plat.w, plat.h, 6);
        ctx.fill();

        ctx.fillStyle = '#d97706';
        ctx.fillRect(screenX + 2, screenY + 2, plat.w - 4, 6);
      }

      ctx.restore();
    }
  }

  function drawSpikes(ctx, camX, spikes) {
    for (const spike of spikes) {
      const screenX = Math.round(spike.x - camX);
      const screenY = Math.round(spike.y);

      ctx.save();
      // Metallic Cartoon Spike
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(screenX, screenY + spike.h);
      ctx.lineTo(screenX + spike.w / 2, screenY);
      ctx.lineTo(screenX + spike.w, screenY + spike.h);
      ctx.closePath();
      ctx.fill();

      // Sharp white shine edge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(screenX + spike.w / 2, screenY);
      ctx.lineTo(screenX + spike.w * 0.75, screenY + spike.h);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ===================================================
  // 14. GAME LOOP & LOGIC
  // ===================================================
  function updateMovingPlatforms(platforms) {
    for (const plat of platforms) {
      if (plat.isMoving) {
        plat.dx = plat.speed * plat.dir;
        plat.x += plat.dx;

        if (plat.x > plat.maxX) {
          plat.dir = -1;
        } else if (plat.x < plat.minX) {
          plat.dir = 1;
        }
      }
    }
  }

  function checkCollisions() {
    if (!currentLevel) return;

    // 1. Coin Collection
    for (const coin of activeCoins) {
      if (!coin.collected) {
        if (
          player.x < coin.x + coin.width &&
          player.x + player.width > coin.x &&
          player.y < coin.y + coin.height &&
          player.y + player.height > coin.y
        ) {
          coin.collected = true;
          score += 10;
          coinsCollected += 1;
          Sound.coin();
          particles.spawnBurst(coin.x + coin.width / 2, coin.y + coin.height / 2, '#fde047', 12, 3);
          updateHUD();
        }
      }
    }

    // 2. Obstacles: Spikes
    for (const spike of currentLevel.spikes) {
      if (
        player.x < spike.x + spike.w - 4 &&
        player.x + player.width > spike.x + 4 &&
        player.y < spike.y + spike.h &&
        player.y + player.height > spike.y + 6
      ) {
        handlePlayerDamage();
        return;
      }
    }

    // 3. Fall into Pit / Chasm
    if (player.y > VIEW_H + 40) {
      handlePlayerDamage();
      return;
    }

    // 4. Enemy Interactions
    for (const enemy of activeEnemies) {
      if (enemy.defeated) continue;

      if (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y
      ) {
        // Jumping on enemy from above (stomp!)
        const hitFromAbove = player.vy > 0 && player.y + player.height <= enemy.y + 16;

        if (hitFromAbove) {
          enemy.defeated = true;
          player.vy = -8.6; // Pantulan lompat yang pas dan terkendali
          score += 25;
          Sound.stomp();
          particles.spawnBurst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#4ade80', 16, 4);
          updateHUD();
        } else {
          // Side hit -> Player damage
          handlePlayerDamage();
          return;
        }
      }
    }

    // 5. Boss Interaction (Level 3)
    if (activeBoss && !activeBoss.defeated) {
      if (
        player.x < activeBoss.x + activeBoss.width &&
        player.x + player.width > activeBoss.x &&
        player.y < activeBoss.y + activeBoss.height &&
        player.y + player.height > activeBoss.y
      ) {
        // Stomp on boss head
        const stompBoss = player.vy > 0 && player.y + player.height <= activeBoss.y + 24;

        if (stompBoss && activeBoss.hitCooldown <= 0) {
          const bossDied = activeBoss.takeDamage();
          player.vy = -9.8; // Pantulan mantap di kepala boss
          score += 50;
          updateHUD();
          if (bossDied) {
            score += 100;
            updateHUD();
          }
        } else if (activeBoss.hitCooldown <= 0) {
          handlePlayerDamage();
          return;
        }
      }
    }

    // 6. Portal Check (Level Complete / Win)
    if (activePortal) {
      // In Level 3, boss must be defeated before portal is accessible!
      const canEnterPortal = !currentLevel.hasBoss || (activeBoss && activeBoss.defeated);

      if (canEnterPortal) {
        const portalCenter = activePortal.x + activePortal.width / 2;
        const playerCenter = player.x + player.width / 2;

        if (
          Math.abs(portalCenter - playerCenter) < 30 &&
          player.y + player.height >= activePortal.y &&
          player.y <= activePortal.y + activePortal.height
        ) {
          handleLevelComplete();
        }
      }
    }
  }

  function handlePlayerDamage() {
    if (player.invulnerableTimer > 0) return;

    lives--;
    Sound.hurt();
    updateHUD();

    if (lives <= 0) {
      triggerGameOver();
    } else {
      // Reset to level spawn point
      player.reset(currentLevel.spawn.x, currentLevel.spawn.y);
      player.invulnerableTimer = 60; // 1 second invulnerability
      particles.spawnBurst(player.x + player.width / 2, player.y + player.height / 2, '#ef4444', 20, 5);
    }
  }

  function handleLevelComplete() {
    score += 100;
    Sound.portal();
    updateHUD();

    // Check if finished Level 3
    if (currentLevelIdx >= LEVELS.length - 1) {
      triggerWin();
    } else {
      // Advance to next level
      currentState = GameState.TRANSITION;
      showBanner(`LEVEL ${currentLevelIdx + 1} SELESAI!`, '+100 SCORE BONUS');
      setTimeout(() => {
        loadLevel(currentLevelIdx + 1);
        currentState = GameState.PLAYING;
      }, 1500);
    }
  }

  function triggerGameOver() {
    currentState = GameState.GAMEOVER;
    Sound.gameOver();
    gameOverScore.textContent = score;
    gameOverCoins.textContent = coinsCollected;
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
  }

  function triggerWin() {
    currentState = GameState.WIN;
    Sound.win();
    winScore.textContent = score;
    winCoins.textContent = coinsCollected;
    winScreen.classList.remove('hidden');
    hud.classList.add('hidden');
  }

  // ===================================================
  // 15. MAIN LOOP
  // ===================================================
  function gameLoop() {
    gameTime++;

    if (currentState === GameState.PLAYING || currentState === GameState.TRANSITION) {
      // 1. Update entities
      updateMovingPlatforms(currentLevel.platforms);
      player.update(currentLevel.platforms);

      for (const coin of activeCoins) coin.update();
      for (const enemy of activeEnemies) enemy.update();
      if (activeBoss) activeBoss.update(player);
      if (activePortal) activePortal.update();

      particles.update();

      if (currentState === GameState.PLAYING) {
        checkCollisions();
      }

      // 2. Update Camera
      camera.update(player.x + player.width / 2, currentLevel.width);

      // 3. Render Level
      drawBackground(ctx, camera.x, currentLevel);
      drawPlatforms(ctx, camera.x, currentLevel.platforms, currentLevel);
      drawSpikes(ctx, camera.x, currentLevel.spikes);

      for (const coin of activeCoins) coin.draw(ctx, camera.x);
      for (const enemy of activeEnemies) enemy.draw(ctx, camera.x);
      if (activeBoss) activeBoss.draw(ctx, camera.x);

      // Portal only renders in Level 3 once boss is defeated
      if (activePortal) {
        const showPortal = !currentLevel.hasBoss || (activeBoss && activeBoss.defeated);
        if (showPortal) {
          activePortal.draw(ctx, camera.x);
        }
      }

      particles.draw(ctx, camera.x);
      player.draw(ctx, camera.x);
    } else if (currentState === GameState.MENU) {
      // Render animated title background on canvas behind CSS overlay
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Gentle animated sun & clouds
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(800, 100, 50, 0, Math.PI * 2);
      ctx.fill();

      drawCloud(ctx, (gameTime * 0.4) % (VIEW_W + 200) - 100, 70, 140, 48);
      drawCloud(ctx, (gameTime * 0.25 + 400) % (VIEW_W + 200) - 100, 130, 180, 58);

      // Floating cartoon ground
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(VIEW_W / 2, 520 + Math.sin(gameTime * 0.04) * 6, 320, 60, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(gameLoop);
  }

  // ===================================================
  // 16. BUTTON CLICK EVENT HANDLERS
  // ===================================================
  btnStart.addEventListener('click', () => {
    initAudio();
    mainMenu.classList.add('hidden');
    howToPlay.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    score = 0;
    coinsCollected = 0;
    lives = 3;
    loadLevel(0);
    currentState = GameState.PLAYING;
  });

  btnHowTo.addEventListener('click', () => {
    initAudio();
    mainMenu.classList.add('hidden');
    howToPlay.classList.remove('hidden');
  });

  btnBackHowTo.addEventListener('click', () => {
    initAudio();
    howToPlay.classList.add('hidden');
    mainMenu.classList.remove('hidden');
  });

  btnRestart.addEventListener('click', () => {
    initAudio();
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    score = 0;
    coinsCollected = 0;
    lives = 3;
    loadLevel(0);
    currentState = GameState.PLAYING;
  });

  btnMenuFromOver.addEventListener('click', () => {
    initAudio();
    gameOverScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    currentState = GameState.MENU;
  });

  btnPlayAgain.addEventListener('click', () => {
    initAudio();
    winScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    score = 0;
    coinsCollected = 0;
    lives = 3;
    loadLevel(0);
    currentState = GameState.PLAYING;
  });

  btnMenuFromWin.addEventListener('click', () => {
    initAudio();
    winScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    currentState = GameState.MENU;
  });

  // Start Animation Loop
  requestAnimationFrame(gameLoop);

})();
