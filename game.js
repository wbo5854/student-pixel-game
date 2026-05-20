const ui = {
  level: document.querySelector("#levelText"),
  skillPoints: document.querySelector("#skillPointText"),
  coins: document.querySelector("#coinText"),
  lives: document.querySelector("#lifeText"),
  attempts: document.querySelector("#attemptText"),
  time: document.querySelector("#timeText"),
  skill: document.querySelector("#skillText"),
  message: document.querySelector("#message"),
  skillPanel: document.querySelector("#skillPanel"),
  skillChoices: document.querySelector("#skillChoices"),
  devourOverlay: document.querySelector("#devourOverlay"),
  devourText: document.querySelector("#devourText"),
  devourRestart: document.querySelector("#devourRestart"),
  victoryOverlay: document.querySelector("#victoryOverlay"),
  victoryRestart: document.querySelector("#victoryRestart"),
  failOverlay: document.querySelector("#failOverlay"),
  failRestart: document.querySelector("#failRestart"),
  touchLeft: document.querySelector("#touchLeft"),
  touchRight: document.querySelector("#touchRight"),
  touchJump: document.querySelector("#touchJump"),
  touchDash: document.querySelector("#touchDash"),
};

const TILE = 48;
const WORLD_WIDTH = 4600;
const WORLD_HEIGHT = 720;
const MAX_LEVEL = 5;
const skills = {
  doubleJump: false,
  sprint: false,
  highJump: false,
  airDash: false,
  shield: false,
  magnet: false,
  slowFall: false,
  coinBonus: false,
  extraLife: false,
};
const skillCatalog = [
  { key: "doubleJump", name: "二段跳", desc: "发动gay之力，空气都不好意思让你掉下去，于是给你垫了一脚。", input: "空中再按一次跳跃。", demo: "demo-double" },
  { key: "sprint", name: "放学冲刺", desc: "像听见班主任说“留一下”那一刻，身体比脑子先逃走。", input: "移动时按住 Shift 或 ✦。", demo: "demo-sprint" },
  { key: "highJump", name: "跳高课代表", desc: "把作业没写完的恐惧灌进膝盖里，起跳高度立刻合理化。", input: "在地面按跳跃。", demo: "demo-high" },
  { key: "airDash", name: "空中急转", desc: "半空中突然想起人生不能这样，于是强行横向改命。", input: "空中按 Shift 或 ✦。", demo: "demo-dash" },
  { key: "shield", name: "硬壳书包", desc: "书包替你挨一下。知识没装多少，抗揍倒是很专业。", input: "被敌人碰到时自动触发。", demo: "demo-shield" },
  { key: "magnet", name: "美刀吸引", desc: "贫穷产生引力，附近美刀会主动靠近你，场面十分现实。", input: "靠近美刀时自动触发。", demo: "demo-magnet" },
  { key: "slowFall", name: "轻飘落地", desc: "下坠速度变慢，像ddl前的时间一样，看似还有，其实没有。", input: "下落时按住跳跃。", demo: "demo-float" },
  { key: "coinBonus", name: "双倍美刀", desc: "同一张钞票算两次，经济学沉默了，但分数很开心。", input: "捡美刀时自动生效。", demo: "demo-bonus" },
  { key: "extraLife", name: "便当回血", desc: "吃完便当原地续命。胃说可以，命运说先观察一下。", input: "选择后立即生效。", demo: "demo-life" },
];

let player;
let aura;
let avatarHead;
let leftArm;
let rightArm;
let leftLeg;
let rightLeg;
let cursors;
let keys;
let platforms;
let hazards;
let coins;
let enemies;
let flag;
let score = 0;
let lives = 3;
let secondsLeft = 90;
let currentLevel = 1;
let skillPoints = 0;
let attemptsLeft = 2;
let gameOver = false;
let choosingSkill = false;
let invulnerableUntil = 0;
let timerEvent;
let jumpsUsed = 0;
let airDashUsed = false;
let shieldReady = false;
let sceneRef;
let devourRestartHandler = null;
let victoryRestartHandler = null;
let failRestartHandler = null;
let lastTrailAt = 0;
let victoryHopping = false;
const touchState = {
  left: false,
  right: false,
  jumpQueued: false,
  jumpHeld: false,
  dashQueued: false,
  dashHeld: false,
};

const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#71cdec",
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1180 },
      debug: false,
    },
  },
  scene: { preload, create, update },
};

new Phaser.Game(config);
setupTouchControls();

function preload() {
  this.load.image("playerHead", "assets/player-head-pixel.png");
  this.load.image("monsterMouth", "assets/monster-mouth-pixel.png");
  this.load.image("dogeBg", "assets/doge-bg.png");
}

function create() {
  sceneRef = this;
  score = 0;
  lives = 3;
  currentLevel = 1;
  skillPoints = 0;
  attemptsLeft = 2;
  resetSkills();
  makeTextures(this);
  setupLevel(this, "第一关：现在只能普通跳跃。");
}

function setupLevel(scene, message) {
  gameOver = false;
  choosingSkill = false;
  victoryHopping = false;
  hideDevourOverlay();
  hideVictoryOverlay();
  hideFailOverlay();
  invulnerableUntil = 0;
  jumpsUsed = 0;
  airDashUsed = false;
  shieldReady = skills.shield;
  secondsLeft = Math.max(76, 108 - currentLevel * 3);

  if (timerEvent) timerEvent.remove(false);
  scene.children.removeAll(true);
  scene.physics.world.colliders.destroy();

  scene.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  scene.cameras.main.roundPixels = true;
  scene.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  addBackdrop(scene);
  platforms = scene.physics.add.staticGroup();
  hazards = scene.physics.add.staticGroup();
  coins = scene.physics.add.staticGroup();
  enemies = scene.physics.add.group({ allowGravity: true, bounceX: 1 });

  buildLevel(scene, currentLevel);

  aura = scene.add.sprite(120, 500, "foxAura").setDepth(3).setAlpha(0.86);
  leftArm = scene.add.image(120, 500, "limb").setDepth(3.8);
  rightArm = scene.add.image(120, 500, "limb").setDepth(3.8);
  leftLeg = scene.add.image(120, 500, "leg").setDepth(3.8);
  rightLeg = scene.add.image(120, 500, "leg").setDepth(3.8);
  player = scene.physics.add.sprite(120, 500, "miniBody").setDepth(4);
  avatarHead = scene.add.image(120, 500, "playerHead").setDepth(5);
  avatarHead.setDisplaySize(44, 44);
  player.setCollideWorldBounds(true);
  player.setSize(28, 54).setOffset(10, 10);
  player.body.setMaxVelocity(700, 820);

  scene.physics.add.collider(player, platforms);
  scene.physics.add.collider(enemies, platforms);
  scene.physics.add.overlap(player, coins, collectCoin, null, scene);
  scene.physics.add.overlap(player, enemies, touchEnemy, null, scene);
  scene.physics.add.overlap(player, hazards, () => loseLife(scene, true, "trap"), null, scene);
  scene.physics.add.overlap(player, flag, winLevel, null, scene);

  cursors = scene.input.keyboard.createCursorKeys();
  keys = scene.input.keyboard.addKeys("W,A,S,D,SPACE,R,SHIFT");
  scene.input.keyboard.off("keydown-R");
  scene.input.keyboard.on("keydown-R", () => {
    if (!choosingSkill) restartRun(scene);
  });

  scene.cameras.main.startFollow(player, true, 0.14, 0.12, -180, 70);

  timerEvent = scene.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (gameOver || choosingSkill) return;
      secondsLeft -= 1;
      syncUi();
      if (secondsLeft <= 0) loseLife(scene, true, "timeout");
    },
  });

  setMessage(message);
  syncUi();
}

function update(time) {
  if (!player || gameOver || choosingSkill) return;

  const left = cursors.left.isDown || keys.A.isDown || touchState.left;
  const right = cursors.right.isDown || keys.D.isDown || touchState.right;
  const jumpPressed = Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(keys.W) || Phaser.Input.Keyboard.JustDown(keys.SPACE) || consumeTouch("jumpQueued");
  const jumpHeld = cursors.up.isDown || keys.W.isDown || keys.SPACE.isDown || touchState.jumpHeld;
  const dashPressed = Phaser.Input.Keyboard.JustDown(keys.SHIFT) || consumeTouch("dashQueued");
  const maxJumps = skills.doubleJump ? 2 : 1;
  const runSpeed = skills.sprint && (keys.SHIFT.isDown || touchState.dashHeld) ? 390 : 285;
  const moving = left || right;
  const fastMoving = moving && Math.abs(player.body.velocity.x) > 120;

  if (left) {
    player.setVelocityX(-runSpeed);
    player.setFlipX(true);
    aura.setFlipX(true);
    avatarHead.setFlipX(true);
  } else if (right) {
    player.setVelocityX(runSpeed);
    player.setFlipX(false);
    aura.setFlipX(false);
    avatarHead.setFlipX(false);
  } else {
    player.setVelocityX(player.body.velocity.x * 0.78);
  }

  if (player.body.blocked.down) {
    jumpsUsed = 0;
    airDashUsed = false;
  }

  if (jumpPressed && jumpsUsed < maxJumps) {
    const firstJump = skills.highJump ? -625 : -560;
    player.setVelocityY(jumpsUsed === 0 ? firstJump : -520);
    jumpsUsed += 1;
    setMessage(jumpsUsed === 2 ? "二段跳！" : "跳跃");
  }

  if (skills.airDash && dashPressed && !player.body.blocked.down && !airDashUsed) {
    const direction = player.flipX ? -1 : 1;
    player.setVelocity(direction * 640, -90);
    airDashUsed = true;
    setMessage("空中冲刺");
  }

  if (skills.slowFall && jumpHeld && !player.body.blocked.down && player.body.velocity.y > 120) {
    player.setVelocityY(Math.max(120, player.body.velocity.y * 0.9));
  }

  if (skills.magnet) pullNearbyCoins();
  if (fastMoving && player.body.blocked.down && time > lastTrailAt + 85) {
    addPlayerTrail(time);
    lastTrailAt = time;
  }

  aura.setPosition(player.x, player.y + 3);
  avatarHead.setPosition(player.x, player.y - 21 + Math.sin(time / 120) * 1.5);
  updateMiniPerson(time, moving);
  aura.setAlpha(0.72 + Math.sin(time / 95) * 0.12);
  const blinkAlpha = time < invulnerableUntil && Math.floor(time / 90) % 2 === 0 ? 0.45 : 1;
  player.setAlpha(blinkAlpha);
  avatarHead.setAlpha(blinkAlpha);
  leftArm.setAlpha(blinkAlpha);
  rightArm.setAlpha(blinkAlpha);
  leftLeg.setAlpha(blinkAlpha);
  rightLeg.setAlpha(blinkAlpha);

  if (player.y > 650) loseLife(sceneRef, true, "fall");

  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    if (enemy.body.blocked.left) enemy.moveDirection = 1;
    if (enemy.body.blocked.right) enemy.moveDirection = -1;
    if (currentLevel >= 5) updateSmartEnemy(enemy);
    const direction = enemy.moveDirection || 1;
    if (enemy.body.blocked.down && !hasGroundAhead(enemy, direction)) {
      enemy.moveDirection = -direction;
      enemy.x -= direction * 14;
      enemy.setVelocityX(enemy.moveDirection * (180 + currentLevel * 24));
      return;
    }
    enemy.setVelocityX(direction * (180 + currentLevel * 24));
    if (enemy.body.blocked.down && sceneRef.time.now > enemy.nextJumpAt) {
      const towardPlayer = player && Math.abs(player.x - enemy.x) < 430 ? Math.sign(player.x - enemy.x) || direction : direction;
      if (currentLevel >= 4) enemy.moveDirection = towardPlayer;
      enemy.setVelocityY(-380 - currentLevel * 14);
      enemy.nextJumpAt = sceneRef.time.now + Phaser.Math.Between(950, 2100);
    }
    if (enemy.y > WORLD_HEIGHT + 80) {
      enemy.setPosition(Math.max(160, enemy.spawnX || 900), 520);
      enemy.setVelocity(0, -260);
      enemy.moveDirection *= -1;
    }
  });
}

function buildLevel(scene, level) {
  const groundSegments = [];
  let start = 0;
  let segment = 0;
  while (start < 91) {
    const count = Math.max(5, 12 - Math.floor(level / 2) + (segment % 3));
    groundSegments.push([start, Math.min(count, 96 - start)]);
    const gap = Math.min(5, 2 + Math.floor(level / 3) + (segment % 2));
    start += count + gap;
    segment += 1;
  }
  groundSegments.push([89, 8]);

  groundSegments.forEach(([start, count]) => {
    for (let i = 0; i < count; i += 1) addBlock(scene, (start + i) * TILE, 648, "ground");
  });

  for (let i = 0; i < 6 + level; i += 1) {
    const x = 6 + i * 7 + (i % 2) * 2;
    const y = 520 - ((i + level) % 4) * 42 - Math.min(level, 5) * 4;
    addBlock(scene, x * TILE, y, "brick");
    if (i % 2 === 0) addBlock(scene, (x + 1) * TILE, y, "brick");
    if (i % 4 === 0) addBlock(scene, (x + 2) * TILE, y, "brick");
  }

  for (let i = 0; i < 3 + Math.floor(level / 3); i += 1) {
    addBlock(scene, (12 + i * 18) * TILE, 606, "crate");
  }

  for (let i = 0; i < 10 + level; i += 1) {
    const x = 5 + i * 7;
    const y = 565 - ((i + level) % 5) * 46;
    addCoin(scene, x * TILE + 24, y);
  }

  for (let index = 0; index < 2 + Math.ceil(level / 2); index += 1) {
    const x = 18 + index * 12 + (level % 3);
    const enemy = enemies.create(x * TILE, 575, "monsterMouth");
    enemy.setDisplaySize(74, 74);
    enemy.spawnX = x * TILE;
    enemy.moveDirection = index % 2 === 0 ? -1 : 1;
    enemy.setVelocityX(enemy.moveDirection * (180 + level * 24));
    enemy.setSize(50, 44).setOffset(23, 30);
    enemy.nextJumpAt = scene.time.now + 900 + index * 450 + Phaser.Math.Between(0, 900);
    enemy.nextAttackAt = scene.time.now + 1200 + index * 500 + Phaser.Math.Between(0, 1000);
    scene.tweens.add({
      targets: enemy,
      scaleX: 1.12,
      scaleY: 0.92,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Stepped",
      easeParams: [2],
    });
  }

  for (let i = 0; i < 2 + level; i += 1) {
    const x = 10 + i * Math.max(6, 12 - Math.floor(level / 2));
    const spike = hazards.create(x * TILE + 24, 624, "spike");
    spike.refreshBody();
  }

  const goalX = 4340;
  flag = scene.physics.add.staticSprite(goalX, 554, "flag");
  flag.setSize(48, 160).setOffset(0, 0);
  platforms.create(goalX - 15, 648, "goalBase").refreshBody();
  platforms.create(goalX + 95, 648, "goalBase").refreshBody();
}

function addBlock(scene, x, y, key) {
  platforms.create(x + 24, y + 24, key).refreshBody();
}

function addCoin(scene, x, y) {
  const coin = coins.create(x, y, "coin");
  scene.tweens.add({
    targets: coin,
    y: y - 8,
    duration: 950,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

function collectCoin(_player, coin) {
  coin.disableBody(true, true);
  score += skills.coinBonus ? 2 : 1;
  syncUi();
  setMessage(score % 5 === 0 ? "美刀连收" : "美刀");
}

function touchEnemy(scenePlayer, enemy) {
  const scene = enemy.scene;
  if (scene.time.now < invulnerableUntil) return;
  if (scenePlayer.body.velocity.y > 120 && scenePlayer.y < enemy.y - 4) {
    enemy.disableBody(true, true);
    scenePlayer.setVelocityY(skills.highJump ? -760 : -680);
    jumpsUsed = Math.max(0, jumpsUsed - 1);
    airDashUsed = false;
    score += 2;
    syncUi();
    setMessage("踩怪大跳板，直接弹上天。");
    return;
  }
  loseLife(scene, false, "devoured");
}

function loseLife(scene, resetPosition, reason = "hit") {
  if (scene.time.now < invulnerableUntil && !resetPosition) return;
  if (shieldReady && !resetPosition) {
    shieldReady = false;
    invulnerableUntil = scene.time.now + 1400;
    setMessage("书包挡住了一次碰撞");
    return;
  }
  lives -= 1;
  attemptsLeft -= 1;
  syncUi();
  if (reason === "devoured") {
    showDevourOverlay(scene, lives <= 0);
    return;
  }
  if (attemptsLeft <= 0) {
    showFailOverlay(scene);
    return;
  }

  if (lives <= 0) {
    lives = 3;
    setupLevel(scene, `从第 ${currentLevel} 关重新开始`);
    return;
  }

  const reasonText = {
    fall: "掉进坑里了",
    timeout: "拖到放学铃都响了",
    devoured: "被小怪张嘴吞了一口",
    trap: "踩到危险物了",
    hit: "被撞到了",
  }[reason] || "失误了";
  setMessage(`${reasonText}，剩余体力：${lives}`);
  invulnerableUntil = scene.time.now + 1500;
  if (resetPosition) {
    player.setPosition(Math.max(120, player.x - 260), 500);
    avatarHead.setPosition(player.x, player.y - 21);
    player.setVelocity(0, 0);
  } else {
    player.setVelocity(-180 * (player.flipX ? -1 : 1), -350);
  }
}

function winLevel(_player, levelFlag) {
  const scene = levelFlag.scene;
  if (gameOver) return;
  score += 10;
  syncUi();
  gameOver = true;
  player.setVelocity(0, 0);
  if (player.body) player.body.enable = false;
  if (timerEvent) timerEvent.paused = true;
  setMessage("通关！原地跳起来。");

  if (currentLevel < MAX_LEVEL) {
    standBehindFlag(levelFlag.x);
    playVictoryHop(scene);
    skillPoints += 1;
    currentLevel += 1;
    attemptsLeft = 2;
    choosingSkill = true;
    syncUi();
    setMessage("选择一个技能继续。");
    showSkillPanel(scene);
    return;
  }

  standBehindFlag(levelFlag.x);
  playVictoryHop(scene);
  showVictoryOverlay(scene);
}

function standBehindFlag(flagX) {
  const targets = [player, avatarHead, aura, leftArm, rightArm, leftLeg, rightLeg].filter(Boolean);
  const startX = Math.min(flagX + 125, WORLD_WIDTH - 150);
  const startY = 592;
  const dx = startX - player.x;
  const dy = startY - player.y;
  targets.forEach((target) => {
    target.x += dx;
    target.y += dy;
    target.setAngle(0);
  });
  player.setFlipX(false);
  avatarHead.setFlipX(false);
  aura.setFlipX(false);
}

function playVictoryHop(scene) {
  const targets = [player, avatarHead, aura, leftArm, rightArm, leftLeg, rightLeg].filter(Boolean);
  victoryHopping = true;
  const hop = () => {
    if (!victoryHopping) {
      targets.forEach((target) => {
        target.setAngle(0);
        target.setScale(1);
      });
      return;
    }
    scene.tweens.add({
      targets,
      y: "-=44",
      scaleX: 0.94,
      scaleY: 1.08,
      duration: 180,
      ease: "Sine.easeOut",
      onComplete: () => {
        scene.tweens.add({
          targets,
          y: "+=44",
          scaleX: 1.08,
          scaleY: 0.92,
          duration: 170,
          ease: "Bounce.easeOut",
          onComplete: () => {
            targets.forEach((target) => target.setScale(1));
            scene.time.delayedCall(90, hop);
          },
        });
      },
    });
  };
  hop();
}

function restartRun(scene) {
  lives = 3;
  victoryHopping = false;
  hideSkillPanel();
  setupLevel(scene, `重新开始第 ${currentLevel} 关`);
}

function endRun(scene, text) {
  gameOver = true;
  player.setVelocity(0, 0);
  if (timerEvent) timerEvent.paused = true;
  setMessage(text);
  const cx = scene.cameras.main.scrollX + scene.scale.width / 2;
  const cy = scene.scale.height / 2;
  scene.add.rectangle(cx, cy, 560, 150, 0x111b2a, 0.86).setScrollFactor(0).setDepth(50);
  scene.add.text(cx, cy, text, {
    fontFamily: "Arial, sans-serif",
    fontSize: "30px",
    fontStyle: "bold",
    color: "#ffffff",
    align: "center",
    wordWrap: { width: 480 },
  }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
}

function syncUi() {
  ui.level.textContent = `1-${currentLevel}`;
  ui.skillPoints.textContent = skillPoints;
  ui.coins.textContent = score;
  ui.lives.textContent = lives;
  ui.attempts.textContent = attemptsLeft;
  ui.time.textContent = secondsLeft;
  ui.skill.textContent = `技能：${activeSkillLabel()}`;
}

function setMessage(text) {
  ui.message.textContent = text;
}

function updateMiniPerson(time, moving) {
  const direction = player.flipX ? -1 : 1;
  const pace = moving && player.body.blocked.down ? Math.sin(time / 80) : 0;
  const float = player.body.blocked.down ? 0 : -3;
  const armSwing = pace * 24;
  const legSwing = pace * 18;

  leftArm.setPosition(player.x - 15 * direction, player.y + 7 + float).setRotation(Phaser.Math.DegToRad(18 + armSwing));
  rightArm.setPosition(player.x + 15 * direction, player.y + 7 + float).setRotation(Phaser.Math.DegToRad(-18 - armSwing));
  leftLeg.setPosition(player.x - 8 * direction, player.y + 29 + float).setRotation(Phaser.Math.DegToRad(-4 - legSwing));
  rightLeg.setPosition(player.x + 8 * direction, player.y + 29 + float).setRotation(Phaser.Math.DegToRad(4 + legSwing));
}

function addPlayerTrail(time) {
  const directionOffset = player.flipX ? 12 : -12;
  const bodyTrail = sceneRef.add.sprite(player.x + directionOffset, player.y, "miniBody").setDepth(2.6);
  const headTrail = sceneRef.add.image(avatarHead.x + directionOffset, avatarHead.y, "playerHead").setDepth(2.7);
  bodyTrail.setFlipX(player.flipX).setAlpha(0.24).setTint(0x92a8ff);
  headTrail.setFlipX(avatarHead.flipX).setAlpha(0.22).setTint(0x92a8ff).setDisplaySize(44, 44);
  bodyTrail.setScale(player.scaleX, player.scaleY);
  sceneRef.tweens.add({
    targets: [bodyTrail, headTrail],
    alpha: 0,
    x: `+=${player.flipX ? 12 : -12}`,
    duration: 260,
    ease: "Stepped",
    easeParams: [3],
    onComplete: () => {
      bodyTrail.destroy();
      headTrail.destroy();
    },
  });
}

function resetSkills() {
  Object.keys(skills).forEach((key) => {
    skills[key] = false;
  });
}

function showSkillPanel(scene) {
  if (timerEvent) timerEvent.paused = true;
  ui.skillChoices.innerHTML = "";
  availableSkillChoices().forEach((skill) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <div class="skill-demo ${skill.demo}" aria-hidden="true">
        <i class="demo-hero"></i>
        <i class="demo-coin"></i>
        <i class="demo-ghost"></i>
      </div>
      <strong>${skill.name}</strong>
      <span>${skill.desc}</span>
      <span>操作：${skill.input}</span>
    `;
    button.addEventListener("click", () => chooseSkill(scene, skill));
    ui.skillChoices.appendChild(button);
  });
  ui.skillPanel.hidden = false;
}

function hideSkillPanel() {
  ui.skillPanel.hidden = true;
  ui.skillChoices.innerHTML = "";
}

function showDevourOverlay(scene, outOfLives = false) {
  gameOver = true;
  if (timerEvent) timerEvent.paused = true;
  player.setVelocity(0, 0);
  ui.devourText.textContent = outOfLives
    ? "体力归零。周围一片血红，书包没能保住你。"
    : `剩余体力：${lives}。周围一片血红，书包没能保住你。`;
  ui.devourOverlay.hidden = false;
  if (devourRestartHandler) {
    ui.devourRestart.removeEventListener("click", devourRestartHandler);
  }
  devourRestartHandler = () => {
    victoryHopping = false;
    if (outOfLives) lives = 3;
    hideDevourOverlay();
    setupLevel(scene, `从第 ${currentLevel} 关重新开始`);
  };
  ui.devourRestart.addEventListener("click", devourRestartHandler);
}

function hideDevourOverlay() {
  if (!ui.devourOverlay) return;
  ui.devourOverlay.hidden = true;
}

function showVictoryOverlay(scene) {
  gameOver = true;
  if (timerEvent) timerEvent.paused = true;
  setMessage("5 关全部通关。");
  ui.victoryOverlay.hidden = false;
  if (victoryRestartHandler) {
    ui.victoryRestart.removeEventListener("click", victoryRestartHandler);
  }
  victoryRestartHandler = () => {
    victoryHopping = false;
    hideVictoryOverlay();
    currentLevel = 1;
    skillPoints = 0;
    score = 0;
    lives = 3;
    attemptsLeft = 2;
    resetSkills();
    setupLevel(scene, "第一关：现在只能普通跳跃。");
  };
  ui.victoryRestart.addEventListener("click", victoryRestartHandler);
}

function hideVictoryOverlay() {
  if (!ui.victoryOverlay) return;
  ui.victoryOverlay.hidden = true;
}

function showFailOverlay(scene) {
  gameOver = true;
  victoryHopping = false;
  if (timerEvent) timerEvent.paused = true;
  if (player?.body) player.body.enable = false;
  player?.setVelocity(0, 0);
  setMessage("机会用完，回到第一关。");
  ui.failOverlay.hidden = false;
  if (failRestartHandler) {
    ui.failRestart.removeEventListener("click", failRestartHandler);
  }
  failRestartHandler = () => {
    hideFailOverlay();
    currentLevel = 1;
    skillPoints = 0;
    score = 0;
    lives = 3;
    attemptsLeft = 2;
    resetSkills();
    setupLevel(scene, "第一关：现在只能普通跳跃。");
  };
  ui.failRestart.addEventListener("click", failRestartHandler);
}

function hideFailOverlay() {
  if (!ui.failOverlay) return;
  ui.failOverlay.hidden = true;
}

function availableSkillChoices() {
  const locked = skillCatalog.filter((skill) => !skills[skill.key]);
  return locked.slice(0, 3);
}

function chooseSkill(scene, skill) {
  if (skillPoints <= 0 || skills[skill.key]) return;
  victoryHopping = false;
  skills[skill.key] = true;
  skillPoints -= 1;
  if (skill.key === "extraLife") lives += 1;
  hideSkillPanel();
  choosingSkill = false;
  setupLevel(scene, `第 ${currentLevel} 关：已学会「${skill.name}」。`);
}

function activeSkillLabel() {
  const labels = [];
  if (skills.doubleJump) labels.push("二段跳");
  if (skills.sprint) labels.push("短跑");
  if (skills.highJump) labels.push("跳高");
  if (skills.airDash) labels.push("冲刺");
  if (skills.shield && shieldReady) labels.push("防护");
  if (skills.magnet) labels.push("美刀");
  if (skills.slowFall) labels.push("缓降");
  if (skills.coinBonus) labels.push("双倍分");
  if (skills.extraLife) labels.push("+体力");
  return labels.length ? labels.join(" / ") : "普通跳跃";
}

function pullNearbyCoins() {
  coins.children.iterate((coin) => {
    if (!coin || !coin.active) return;
    const distance = Phaser.Math.Distance.Between(player.x, player.y, coin.x, coin.y);
    if (distance > 190) return;
    coin.x += (player.x - coin.x) * 0.045;
    coin.y += (player.y - coin.y) * 0.045;
    coin.refreshBody();
  });
}

function hasGroundAhead(enemy, direction) {
  const probeX = enemy.x + direction * 54;
  const probeY = enemy.y + 50;
  let found = false;
  platforms.children.iterate((platform) => {
    if (found || !platform || !platform.body) return;
    const body = platform.body;
    if (
      probeX >= body.x - 4 &&
      probeX <= body.x + body.width + 4 &&
      probeY >= body.y - 8 &&
      probeY <= body.y + body.height + 24
    ) {
      found = true;
    }
  });
  return found;
}

function updateSmartEnemy(enemy) {
  if (!player || !player.active) return;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.abs(dx);
  const sameVerticalBand = Math.abs(dy) < 220;
  if (distance < 720 && sameVerticalBand) {
    enemy.moveDirection = dx < 0 ? -1 : 1;
  }

  const canPounce =
    enemy.body.blocked.down &&
    distance > 55 &&
    distance < 470 &&
    Math.abs(dy) < 190 &&
    sceneRef.time.now > enemy.nextAttackAt;

  if (canPounce) {
    enemy.moveDirection = dx < 0 ? -1 : 1;
    enemy.setVelocity(enemy.moveDirection * (340 + currentLevel * 34), -530 - currentLevel * 18);
    enemy.nextAttackAt = sceneRef.time.now + Phaser.Math.Between(1050, 2300);
    enemy.nextJumpAt = sceneRef.time.now + 850;
    setMessage("五关后的小怪开始带脑子了。");
  }
}

function setupTouchControls() {
  bindTouchButton(ui.touchLeft, "left");
  bindTouchButton(ui.touchRight, "right");
  bindTouchButton(ui.touchJump, "jumpHeld", "jumpQueued");
  bindTouchButton(ui.touchDash, "dashHeld", "dashQueued");
}

function bindTouchButton(button, holdKey, queueKey) {
  if (!button) return;
  const press = (event) => {
    event.preventDefault();
    touchState[holdKey] = true;
    if (queueKey) touchState[queueKey] = true;
    button.classList.add("is-pressed");
  };
  const release = (event) => {
    event.preventDefault();
    touchState[holdKey] = false;
    button.classList.remove("is-pressed");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

function consumeTouch(key) {
  if (!touchState[key]) return false;
  touchState[key] = false;
  return true;
}

function addBackdrop(scene) {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x101727, 0x101727, 0x24324e, 0x12131f, 1);
  g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const dogeTiles = scene.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, "dogeBg").setOrigin(0, 0);
  dogeTiles.setTileScale(1.45, 1.45);
  dogeTiles.setAlpha(0.34);
  dogeTiles.setScrollFactor(0.18, 0);
  g.fillStyle(0xd9d3bd, 0.88).fillCircle(175, 120, 58);
  g.fillStyle(0x101727, 1).fillCircle(198, 102, 58);

  for (let i = 0; i < 26; i += 1) {
    const x = i * 190 + 40;
    const y = 90 + (i % 5) * 42;
    g.fillStyle(0x4a4f65, 0.24);
    g.fillEllipse(x, y, 150, 32);
  }

  g.fillStyle(0x161b29, 1);
  for (let i = 0; i < 18; i += 1) {
    const x = i * 280 - 80;
    const base = 648;
    const h = 190 + (i % 4) * 42;
    g.fillRect(x, base - h, 120, h);
    g.fillTriangle(x - 10, base - h, x + 60, base - h - 70, x + 130, base - h);
    g.fillRect(x + 135, base - h + 50, 86, h - 50);
    g.fillTriangle(x + 125, base - h + 50, x + 178, base - h - 5, x + 230, base - h + 50);
    for (let w = 0; w < 3; w += 1) {
      g.fillStyle(0xf2c866, 0.28);
      g.fillRect(x + 22 + w * 30, base - h + 76, 10, 28);
      g.fillStyle(0x161b29, 1);
    }
  }

  g.fillStyle(0x0d1018, 1);
  for (let i = 0; i < 23; i += 1) {
    const x = i * 210 - 40;
    g.fillTriangle(x, 648, x + 110, 430 + (i % 3) * 28, x + 230, 648);
  }
  g.setScrollFactor(0.35, 0);
}

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x202331).fillRect(0, 0, 48, 48);
  g.fillStyle(0x3b3f52).fillRect(0, 0, 48, 13);
  g.fillStyle(0x2c2030).fillRect(0, 14, 48, 34);
  g.lineStyle(2, 0x151724, 1);
  g.strokeLineShape(new Phaser.Geom.Line(12, 16, 12, 46));
  g.strokeLineShape(new Phaser.Geom.Line(32, 16, 32, 46));
  g.generateTexture("ground", 48, 48).clear();

  g.fillStyle(0x5b4b64).fillRect(0, 0, 48, 48);
  g.lineStyle(3, 0x2b2638, 1);
  g.strokeRect(1, 1, 46, 46);
  g.strokeLineShape(new Phaser.Geom.Line(0, 24, 48, 24));
  g.strokeLineShape(new Phaser.Geom.Line(24, 0, 24, 24));
  g.generateTexture("brick", 48, 48).clear();

  g.fillStyle(0x6b5260).fillRect(0, 0, 48, 48);
  g.lineStyle(4, 0x312638, 1);
  g.strokeRect(2, 2, 44, 44);
  g.strokeLineShape(new Phaser.Geom.Line(8, 8, 40, 40));
  g.strokeLineShape(new Phaser.Geom.Line(40, 8, 8, 40));
  g.generateTexture("crate", 48, 48).clear();

  g.fillStyle(0xf2f0e8).fillRoundedRect(5, 0, 10, 28, 4);
  g.fillStyle(0xffd8a0).fillCircle(10, 4, 4);
  g.generateTexture("limb", 20, 30).clear();

  g.fillStyle(0x151b28).fillRoundedRect(5, 0, 10, 26, 4);
  g.fillStyle(0x070a10).fillRect(3, 23, 15, 5);
  g.generateTexture("leg", 20, 30).clear();

  g.fillStyle(0x2f9c5a).fillRoundedRect(2, 7, 28, 18, 3);
  g.fillStyle(0xbaf0bb).fillRoundedRect(5, 10, 22, 12, 2);
  g.fillStyle(0x1d6e3d).fillCircle(16, 16, 5);
  g.fillStyle(0xe8ffe4).fillRect(15, 11, 2, 10);
  g.fillStyle(0xe8ffe4).fillRect(12, 14, 8, 2);
  g.lineStyle(2, 0x176137, 1).strokeRoundedRect(2, 7, 28, 18, 3);
  g.generateTexture("coin", 32, 32).clear();

  g.fillStyle(0x202532).fillTriangle(0, 36, 24, 0, 48, 36);
  g.fillStyle(0xbec8c2).fillTriangle(8, 34, 24, 10, 40, 34);
  g.generateTexture("spike", 48, 40).clear();

  g.fillStyle(0x3f6f54).fillEllipse(24, 30, 44, 28);
  g.fillStyle(0x1f2c27).fillRect(8, 30, 32, 16);
  g.fillStyle(0xffeec2).fillCircle(15, 20, 5);
  g.fillStyle(0xffeec2).fillCircle(33, 20, 5);
  g.fillStyle(0x182018).fillCircle(16, 21, 2);
  g.fillStyle(0x182018).fillCircle(34, 21, 2);
  g.generateTexture("beet", 48, 48).clear();

  g.fillStyle(0x6b7aa2, 0.48).fillEllipse(24, 28, 54, 62);
  g.fillStyle(0xd8e2ff, 0.22).fillEllipse(24, 28, 38, 48);
  g.fillStyle(0x7080a8, 0.32).fillTriangle(4, 36, -10, 56, 18, 48);
  g.fillStyle(0x7080a8, 0.32).fillTriangle(44, 36, 58, 56, 30, 48);
  g.generateTexture("foxAura", 64, 68).clear();

  g.fillStyle(0xffb347).fillCircle(24, 16, 12);
  g.fillStyle(0xf06a13).fillRoundedRect(9, 28, 30, 28, 6);
  g.fillStyle(0x121923).fillRect(10, 24, 28, 8);
  g.fillStyle(0xffd47d).fillCircle(18, 17, 2);
  g.fillStyle(0xffd47d).fillCircle(30, 17, 2);
  g.fillStyle(0xfff1b8).fillCircle(19, 16, 1.5);
  g.fillStyle(0xfff1b8).fillCircle(29, 16, 1.5);
  g.fillStyle(0xf06a13).fillRect(11, 45, 9, 12);
  g.fillStyle(0xf06a13).fillRect(28, 45, 9, 12);
  g.fillStyle(0x232b38).fillRect(13, 57, 8, 4);
  g.fillStyle(0x232b38).fillRect(27, 57, 8, 4);
  g.fillStyle(0xffd45a).fillTriangle(12, 7, 4, 1, 12, 16);
  g.fillStyle(0xffd45a).fillTriangle(36, 7, 44, 1, 36, 16);
  g.lineStyle(2, 0xfff3b0, 0.9);
  g.strokeCircle(24, 28, 21);
  g.generateTexture("foxNinja", 48, 62).clear();

  g.fillStyle(0x2d5d9f).fillRoundedRect(7, 23, 11, 24, 4);
  g.fillStyle(0xf2f0e8).fillRoundedRect(11, 22, 26, 27, 7);
  g.fillStyle(0x25324a).fillRect(14, 25, 20, 7);
  g.fillStyle(0xc94141).fillTriangle(20, 32, 28, 32, 24, 41);
  g.lineStyle(5, 0xf2f0e8, 1);
  g.strokeLineShape(new Phaser.Geom.Line(12, 27, 3, 42));
  g.strokeLineShape(new Phaser.Geom.Line(36, 27, 45, 42));
  g.lineStyle(5, 0x192131, 1);
  g.strokeLineShape(new Phaser.Geom.Line(18, 47, 13, 60));
  g.strokeLineShape(new Phaser.Geom.Line(30, 47, 35, 60));
  g.fillStyle(0xffd8a0).fillCircle(3, 42, 4);
  g.fillStyle(0xffd8a0).fillCircle(45, 42, 4);
  g.fillStyle(0x0e141f).fillRect(9, 59, 12, 4);
  g.fillStyle(0x0e141f).fillRect(31, 59, 12, 4);
  g.lineStyle(2, 0xfff0a8, 0.85);
  g.strokeRoundedRect(8, 20, 32, 31, 8);
  g.generateTexture("miniBody", 48, 64).clear();

  g.fillStyle(0x463242).fillRect(8, 0, 8, 160);
  g.fillStyle(0xd8d1ba).fillTriangle(16, 0, 82, 34, 16, 68);
  g.fillStyle(0xc8953f).fillTriangle(16, 12, 58, 34, 16, 56);
  g.generateTexture("flag", 96, 160).clear();

  g.fillStyle(0x24283a).fillRect(0, 0, 96, 48);
  g.fillStyle(0x6f5a7d).fillRect(0, 0, 96, 12);
  g.generateTexture("goalBase", 96, 48).clear();
}
