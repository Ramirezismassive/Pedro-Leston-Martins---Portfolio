
(() => {
  if (window.__cursorGlowInitialized) return;
  window.__cursorGlowInitialized = true;

  const CURSOR_RADIUS = 90;
  const IMAGE_THRESHOLD = 120;
  const RED = "255, 0, 0";
  const IDLE_TIMEOUT = 250;
  const FADE_DURATION = 2000;

  const SPRING_STRENGTH = 0.012;
  const SPRING_FRICTION = 0.90;
  const NORMAL_SMOOTHING = 0.12;

  // Background fireflies
  const FIREFLY_COUNT = 5;
  const FIREFLY_MIN_SIZE = 80;
  const FIREFLY_MAX_SIZE = 200;
  const FIREFLY_MIN_TRAVEL = 10000;
  const FIREFLY_MAX_TRAVEL = 16000;
  const FIREFLY_FADE_IN_MIN = 2500;
  const FIREFLY_FADE_IN_MAX = 5000;
  const FIREFLY_FADE_OUT_MIN = 1800;
  const FIREFLY_FADE_OUT_MAX = 3500;
  const FIREFLY_MERGE_FADE_DURATION = 2500;
  const FIREFLY_MIN_PAUSE = 500;
  const FIREFLY_MAX_PAUSE = 2200;
  const FIREFLY_MERGE_DISTANCE = 90;
  const FIREFLY_MERGE_SPEED = 0.012;
  const FIREFLY_MERGE_COOLDOWN = 1600;

  // Gentle, local attraction
  const FIREFLY_CURSOR_ATTRACTION_RADIUS = 180;
  const FIREFLY_GROUP_ATTRACTION_RADIUS = 130;
  const FIREFLY_ATTRACTION_STRENGTH = 0.0007;
  const FIREFLY_ATTRACTION_FRICTION = 0.94;
  const FIREFLY_ATTRACTION_MAX_SPEED = 1;
  const FIREFLY_ATTRACTION_SLOW_DISTANCE = 50;

  // Independent attraction cooldowns
  const FIREFLY_ATTRACTION_IGNORE_MIN = 2200;
  const FIREFLY_ATTRACTION_IGNORE_MAX = 5000;
  const FIREFLY_ATTRACTION_START_DELAY_MIN = 0;
  const FIREFLY_ATTRACTION_START_DELAY_MAX = 1800;

  // Individual linger and fade timings
  const FIREFLY_LINGER_MIN = 500;
  const FIREFLY_LINGER_MAX = 1600;
  const FIREFLY_FADE_DELAY_MIN = 0;
  const FIREFLY_FADE_DELAY_MAX = 1200;
  const FIREFLY_ATTRACTION_FADE_MIN = 1200;
  const FIREFLY_ATTRACTION_FADE_MAX = 2400;

  const currentPath =
    window.location.pathname.replace(/\/+$/, "") || "/";

  const disableImageGlow =
    currentPath === "/" || currentPath === "/contact";

  const CURSOR_GLOW_Z_INDEX = disableImageGlow ? 1 : -1;

  if (disableImageGlow) {
    document.body.classList.add("cursor-glow-front");
  }

  const style = document.createElement("style");

  style.textContent = `
.cursor-effects {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  overflow: visible;
  mix-blend-mode: screen;
}

body.cursor-glow-front .cursor-effects {
  z-index: 10;
}

body.cursor-glow-front main {
  position: relative;
  z-index: 0;
}

.cursor-radial-glow {
  position: fixed;
  left: 0;
  top: 0;
  width: ${CURSOR_RADIUS * 2}px;
  height: ${CURSOR_RADIUS * 2}px;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(
      circle,
      rgba(253,7,7,0.22) 0%,
      rgba(255,0,0,0.12) 25%,
      rgba(255,0,0,0.04) 55%,
      transparent 100%
    );
  opacity: 0;
  will-change: transform, opacity;
  transition: opacity ${FADE_DURATION}ms ease-out;
  mix-blend-mode: screen;
  z-index: 0;
}

.cursor-film-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.055;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.cursor-firefly {
  position: fixed;
  left: 0;
  top: 0;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  will-change: transform, opacity;
  mix-blend-mode: screen;
}

.cursor-image-glow {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  transition: opacity 500ms ease;
  z-index: 10;
}

.cursor-image-glow rect {
  fill: none;
  stroke-linejoin: round;
}

.cursor-image-glow .glow-wide {
  fill: rgba(${RED}, 0.035);
  stroke: rgba(${RED}, 0.45);
  stroke-width: 30;
  filter: url(#cursorGlowWide);
}

.cursor-image-glow .glow-medium {
  fill: rgba(${RED}, 0.06);
  stroke: rgba(${RED}, 0.35);
  stroke-width: 16;
  filter: url(#cursorGlowMedium);
}

.cursor-image-glow .glow-core {
  fill: rgba(${RED}, 0.12);
  stroke: rgba(${RED}, 0.18);
  stroke-width: 6;
  filter: url(#cursorGlowCore);
}
  `;

  document.head.appendChild(style);

  const effects = document.createElement("div");
  effects.className = "cursor-effects";
  document.body.appendChild(effects);

  const trailCanvas = document.createElement("canvas");

  trailCanvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;

  effects.appendChild(trailCanvas);

  const cursorGlow = document.createElement("div");
  cursorGlow.className = "cursor-radial-glow";
  cursorGlow.style.zIndex = String(CURSOR_GLOW_Z_INDEX);
  document.body.appendChild(cursorGlow);

  const grain = document.createElement("div");
  grain.className = "cursor-film-grain";
  effects.appendChild(grain);

  const fireflies = [];

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function smoothstep(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function getVisibleGlowTargets() {
    return Array.from(
      document.querySelectorAll(
        disableImageGlow ? "main a" : "main img, main a"
      )
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const elementStyle = getComputedStyle(element);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        elementStyle.display !== "none" &&
        elementStyle.visibility !== "hidden"
      );
    });
  }

  function getNearestTargetPoint(x, y, rect) {
    return {
      x: Math.max(rect.left, Math.min(x, rect.right)),
      y: Math.max(rect.top, Math.min(y, rect.bottom))
    };
  }

  function findNearbyGlowTarget(x, y) {
    let closest = null;
    let closestPoint = null;
    let closestDistance = Infinity;

    for (const element of getVisibleGlowTargets()) {
      const rect = element.getBoundingClientRect();
      const point = getNearestTargetPoint(x, y, rect);
      const distance = Math.hypot(x - point.x, y - point.y);

      if (distance < closestDistance) {
        closestDistance = distance;
        closest = element;
        closestPoint = point;
      }
    }

    if (closest && closestDistance <= FIREFLY_MERGE_DISTANCE) {
      return {
        element: closest,
        point: closestPoint,
        distance: closestDistance
      };
    }

    return null;
  }

  function scheduleNextAttraction(firefly, timestamp) {
    firefly.releaseCooldownUntil =
      timestamp +
      randomBetween(
        FIREFLY_ATTRACTION_IGNORE_MIN,
        FIREFLY_ATTRACTION_IGNORE_MAX
      );

    firefly.nextAttractionCheck =
      timestamp +
      randomBetween(
        FIREFLY_ATTRACTION_START_DELAY_MIN,
        FIREFLY_ATTRACTION_START_DELAY_MAX
      );
  }

  function clearAttractionState(firefly) {
    firefly.attracted = false;
    firefly.attractionTargetType = null;
    firefly.attractionStarted = 0;
    firefly.attractionLinger = 0;
    firefly.attractionFading = false;
    firefly.attractionFadeStarted = 0;
    firefly.attractionFadeFromOpacity = 0;
    firefly.attractionFadeDelay = 0;
    firefly.attractionFadeDuration = 0;
    firefly.attractionTargetId = null;
  }

  function chooseFireflyDestination(firefly, timestamp) {
    const margin = 35;

    firefly.targetX = randomBetween(
      margin,
      Math.max(margin, window.innerWidth - margin)
    );

    firefly.targetY = randomBetween(
      margin,
      Math.max(margin, window.innerHeight - margin)
    );

    firefly.moving = true;
    firefly.merging = false;
    firefly.mergeTarget = null;
    firefly.mergeStartOpacity = 0;

    clearAttractionState(firefly);

    firefly.travelStarted = timestamp;
    firefly.travelDuration = randomBetween(
      FIREFLY_MIN_TRAVEL,
      FIREFLY_MAX_TRAVEL
    );

    firefly.fadeInDuration = randomBetween(
      FIREFLY_FADE_IN_MIN,
      FIREFLY_FADE_IN_MAX
    );

    firefly.fadeOutDuration = randomBetween(
      FIREFLY_FADE_OUT_MIN,
      FIREFLY_FADE_OUT_MAX
    );

    firefly.startX = firefly.x;
    firefly.startY = firefly.y;

    firefly.targetOpacity = randomBetween(0.24, 0.58);
    firefly.spring = randomBetween(0.00025, 0.00065);
    firefly.friction = randomBetween(0.965, 0.99);

    firefly.velocityX = 0;
    firefly.velocityY = 0;
    firefly.pauseUntil = timestamp;
    firefly.fadeStarted = timestamp;
    firefly.fadeDuration = 0;
    firefly.startOpacity = firefly.opacity;

    firefly.nextWander =
      timestamp + randomBetween(300, 1200);

    firefly.wanderX = randomBetween(-0.6, 0.6);
    firefly.wanderY = randomBetween(-0.6, 0.6);

    firefly.attractionEligibleAt =
      timestamp +
      randomBetween(0, FIREFLY_ATTRACTION_START_DELAY_MAX);
  }

  function randomiseFireflySize(firefly) {
    firefly.size = randomBetween(
      FIREFLY_MIN_SIZE,
      FIREFLY_MAX_SIZE
    );

    firefly.element.style.width = `${firefly.size}px`;
    firefly.element.style.height = `${firefly.size}px`;
  }

  function respawnFirefly(firefly, timestamp) {
    const margin = 35;
    const minDistanceFromOldPosition = Math.min(
      220,
      Math.min(window.innerWidth, window.innerHeight) * 0.3
    );

    let newX = firefly.x;
    let newY = firefly.y;

    for (let attempt = 0; attempt < 12; attempt++) {
      newX = randomBetween(
        margin,
        Math.max(margin, window.innerWidth - margin)
      );

      newY = randomBetween(
        margin,
        Math.max(margin, window.innerHeight - margin)
      );

      if (
        Math.hypot(newX - firefly.x, newY - firefly.y) >=
        minDistanceFromOldPosition
      ) {
        break;
      }
    }

    firefly.x = newX;
    firefly.y = newY;
    firefly.opacity = 0;

    randomiseFireflySize(firefly);

    firefly.element.style.opacity = "0";
    firefly.element.style.transform =
      `translate3d(${newX - firefly.size / 2}px, ${newY - firefly.size / 2}px, 0)`;

    firefly.ignoreAttractionUntilExit = false;
    firefly.detachedFrom = [];
    firefly.releaseImpulseX = 0;
    firefly.releaseImpulseY = 0;
    firefly.mergeCooldownUntil =
      timestamp + FIREFLY_MERGE_COOLDOWN;

    scheduleNextAttraction(firefly, timestamp);
    chooseFireflyDestination(firefly, timestamp);
  }

  function pauseFirefly(firefly, timestamp) {
    firefly.moving = false;
    firefly.merging = false;
    clearAttractionState(firefly);

    firefly.pauseUntil =
      timestamp + randomBetween(FIREFLY_MIN_PAUSE, FIREFLY_MAX_PAUSE);

    firefly.fadeStarted = timestamp;
    firefly.fadeDuration = 0;
    firefly.startOpacity = firefly.opacity;
    firefly.velocityX = 0;
    firefly.velocityY = 0;
  }

  function createFireflies() {
    const now = performance.now();

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const element = document.createElement("div");
      element.className = "cursor-firefly";

      const size = randomBetween(FIREFLY_MIN_SIZE, FIREFLY_MAX_SIZE);
      const brightness = randomBetween(0.55, 0.9);
      const blur = randomBetween(3, 7);

      element.style.width = `${size}px`;
      element.style.height = `${size}px`;

      element.style.background = `
        radial-gradient(
          circle,
          rgba(255, 30, 30, ${brightness}) 0%,
          rgba(255, 0, 0, 0.42) 20%,
          rgba(255, 0, 0, 0.16) 43%,
          rgba(255, 0, 0, 0.04) 65%,
          transparent 78%
        )
      `;

      element.style.filter = `blur(${blur}px)`;
      effects.appendChild(element);

      const firefly = {
        element,
        size,
        x: randomBetween(0, window.innerWidth),
        y: randomBetween(0, window.innerHeight),
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        velocityX: 0,
        velocityY: 0,
        spring: randomBetween(0.00025, 0.00065),
        friction: randomBetween(0.965, 0.99),
        opacity: 0,
        targetOpacity: randomBetween(0.24, 0.58),
        moving: true,
        merging: false,
        mergeTarget: null,
        mergeStarted: 0,
        mergeStartOpacity: 0,
        mergeCooldownUntil: now + randomBetween(1000, 5000),
        travelStarted: now,
        travelDuration: randomBetween(
          FIREFLY_MIN_TRAVEL,
          FIREFLY_MAX_TRAVEL
        ),
        fadeInDuration: randomBetween(
          FIREFLY_FADE_IN_MIN,
          FIREFLY_FADE_IN_MAX
        ),
        fadeOutDuration: randomBetween(
          FIREFLY_FADE_OUT_MIN,
          FIREFLY_FADE_OUT_MAX
        ),
        pauseUntil: now,
        fadeStarted: now,
        fadeDuration: 0,
        startOpacity: 0,
        pulseOffset: Math.random() * Math.PI * 2,
        pulseSpeed: randomBetween(0.00015, 0.0004),
        nextWander: now + randomBetween(300, 1200),
        wanderX: randomBetween(-0.6, 0.6),
        wanderY: randomBetween(-0.6, 0.6),
        attracted: false,
        attractionTargetType: null,
        attractionTargetId: null,
        attractionStarted: 0,
        attractionLinger: 0,
        attractionFading: false,
        attractionFadeStarted: 0,
        attractionFadeFromOpacity: 0,
        attractionFadeDelay: 0,
        attractionFadeDuration: 0,
        attractionEligibleAt:
          now + randomBetween(0, FIREFLY_ATTRACTION_START_DELAY_MAX),
        releaseCooldownUntil:
          now + randomBetween(0, FIREFLY_ATTRACTION_IGNORE_MAX),
        nextAttractionCheck:
          now + randomBetween(0, FIREFLY_ATTRACTION_START_DELAY_MAX),
        ignoreAttractionUntilExit: false,
        detachedFrom: [],
        releaseImpulseX: 0,
        releaseImpulseY: 0
      };

      fireflies.push(firefly);
      chooseFireflyDestination(firefly, now);

      // Stagger initial journeys and attraction checks.
      firefly.travelStarted -= randomBetween(0, 7000);
      firefly.attractionEligibleAt += randomBetween(0, 3000);
    }
  }

  createFireflies();

  function getCursorAttractionTarget(firefly) {
    if (mouseX <= -500 || mouseY <= -500) return null;

    const distance = Math.hypot(
      mouseX - firefly.x,
      mouseY - firefly.y
    );

    if (distance >= FIREFLY_CURSOR_ATTRACTION_RADIUS) return null;

    return {
      x: mouseX,
      y: mouseY,
      type: "cursor",
      id: "cursor",
      distance,
      radius: FIREFLY_CURSOR_ATTRACTION_RADIUS
    };
  }

  function getFireflyAttractionTarget(firefly, timestamp) {
    if (
      firefly.merging ||
      firefly.attractionFading ||
      firefly.attracted ||
      timestamp < firefly.releaseCooldownUntil ||
      timestamp < firefly.attractionEligibleAt
    ) {
      return null;
    }

    let closestTarget = getCursorAttractionTarget(firefly);
    let closestDistance = closestTarget
      ? closestTarget.distance
      : Infinity;

    for (const other of fireflies) {
      if (
        other === firefly ||
        other.merging ||
        other.attractionFading ||
        other.attracted ||
        timestamp < other.releaseCooldownUntil
      ) {
        continue;
      }

      const distance = Math.hypot(
        other.x - firefly.x,
        other.y - firefly.y
      );

      if (
        distance < FIREFLY_GROUP_ATTRACTION_RADIUS &&
        distance < closestDistance
      ) {
        closestDistance = distance;

        closestTarget = {
          x: other.x,
          y: other.y,
          type: "firefly",
          id: other,
          distance,
          radius: FIREFLY_GROUP_ATTRACTION_RADIUS
        };
      }
    }

    return closestTarget;
  }

  function getConnectedFireflyGroup(startFirefly) {
    const group = [startFirefly];
    const visited = new Set(group);

    for (let index = 0; index < group.length; index++) {
      const current = group[index];

      for (const other of fireflies) {
        if (
          visited.has(other) ||
          other.merging ||
          other.attractionFading ||
          other === current
        ) {
          continue;
        }

        const distance = Math.hypot(
          other.x - current.x,
          other.y - current.y
        );

        if (distance < FIREFLY_GROUP_ATTRACTION_RADIUS) {
          visited.add(other);
          group.push(other);
        }
      }
    }

    return group;
  }

  function releaseFireflyGroup(startFirefly, timestamp) {
    const group = getConnectedFireflyGroup(startFirefly);

    for (const firefly of group) {
      if (firefly.merging || firefly.attractionFading) continue;

      firefly.attracted = false;
      firefly.attractionTargetType = null;
      firefly.attractionTargetId = null;
      firefly.attractionStarted = 0;

      firefly.attractionFading = true;
      firefly.attractionFadeStarted = timestamp;
      firefly.attractionFadeFromOpacity = firefly.opacity;

      firefly.attractionFadeDelay = randomBetween(
        FIREFLY_FADE_DELAY_MIN,
        FIREFLY_FADE_DELAY_MAX
      );

      firefly.attractionFadeDuration = randomBetween(
        FIREFLY_ATTRACTION_FADE_MIN,
        FIREFLY_ATTRACTION_FADE_MAX
      );

      firefly.velocityX = 0;
      firefly.velocityY = 0;
    }
  }

  function steerTowardsTarget(x, y, target) {
    if (!target) return { x, y };

    const influence =
      0.72 +
      0.23 * (1 - Math.min(1, target.distance / target.radius));

    return {
      x: x + (target.x - x) * influence,
      y: y + (target.y - y) * influence
    };
  }

  function startAttractionFade(firefly, timestamp) {
    if (firefly.attractionFading || firefly.merging) return;

    releaseFireflyGroup(firefly, timestamp);

    if (!firefly.attractionFading) {
      firefly.attracted = false;
      firefly.attractionFading = true;
      firefly.attractionFadeStarted = timestamp;
      firefly.attractionFadeFromOpacity = firefly.opacity;

      firefly.attractionFadeDelay = randomBetween(
        FIREFLY_FADE_DELAY_MIN,
        FIREFLY_FADE_DELAY_MAX
      );

      firefly.attractionFadeDuration = randomBetween(
        FIREFLY_ATTRACTION_FADE_MIN,
        FIREFLY_ATTRACTION_FADE_MAX
      );

      firefly.velocityX = 0;
      firefly.velocityY = 0;
    }
  }

  function updateFireflies(timestamp, delta) {
    const frameScale = delta / 16.67;

    for (const firefly of fireflies) {
      // Merge into links and images when close enough.
      if (
        !firefly.merging &&
        timestamp >= firefly.mergeCooldownUntil
      ) {
        const nearbyTarget = findNearbyGlowTarget(
          firefly.x,
          firefly.y
        );

        if (nearbyTarget) {
          firefly.merging = true;
          firefly.mergeTarget = nearbyTarget.element;
          firefly.mergeStarted = timestamp;
          firefly.mergeStartOpacity = firefly.opacity;
          firefly.velocityX = 0;
          firefly.velocityY = 0;
          clearAttractionState(firefly);
        }
      }

      if (firefly.merging) {
        if (
          !firefly.mergeTarget ||
          !firefly.mergeTarget.isConnected
        ) {
          respawnFirefly(firefly, timestamp);
          continue;
        }

        const rect =
          firefly.mergeTarget.getBoundingClientRect();

        const point = getNearestTargetPoint(
          firefly.x,
          firefly.y,
          rect
        );

        firefly.velocityX +=
          (point.x - firefly.x) *
          FIREFLY_MERGE_SPEED *
          frameScale;

        firefly.velocityY +=
          (point.y - firefly.y) *
          FIREFLY_MERGE_SPEED *
          frameScale;

        firefly.velocityX *= Math.pow(0.91, frameScale);
        firefly.velocityY *= Math.pow(0.91, frameScale);

        firefly.x += firefly.velocityX * frameScale;
        firefly.y += firefly.velocityY * frameScale;

        const mergeElapsed = timestamp - firefly.mergeStarted;
        const mergeProgress = Math.min(
          1,
          mergeElapsed / FIREFLY_MERGE_FADE_DURATION
        );

        firefly.opacity =
          firefly.mergeStartOpacity *
          (1 - smoothstep(mergeProgress));

        firefly.element.style.opacity = String(
          Math.max(0, firefly.opacity)
        );

        firefly.element.style.transform =
          `translate3d(${firefly.x - firefly.size / 2}px, ${firefly.y - firefly.size / 2}px, 0)`;

        if (mergeProgress >= 1) {
          respawnFirefly(firefly, timestamp);
        }

        continue;
      }

      if (firefly.attractionFading) {
        const elapsedFade =
          timestamp -
          firefly.attractionFadeStarted -
          firefly.attractionFadeDelay;

        if (elapsedFade < 0) {
          firefly.opacity = firefly.attractionFadeFromOpacity;

          firefly.element.style.opacity = String(
            Math.max(0, firefly.opacity)
          );

          firefly.element.style.transform =
            `translate3d(${firefly.x - firefly.size / 2}px, ${firefly.y - firefly.size / 2}px, 0)`;

          continue;
        }

        const fadeProgress = Math.min(
          1,
          elapsedFade / Math.max(1, firefly.attractionFadeDuration)
        );

        firefly.opacity =
          firefly.attractionFadeFromOpacity *
          (1 - smoothstep(fadeProgress));

        firefly.element.style.opacity = String(
          Math.max(0, firefly.opacity)
        );

        firefly.element.style.transform =
          `translate3d(${firefly.x - firefly.size / 2}px, ${firefly.y - firefly.size / 2}px, 0)`;

        if (fadeProgress >= 1) {
          firefly.opacity = 0;
          firefly.element.style.opacity = "0";
          firefly.velocityX = 0;
          firefly.velocityY = 0;
          firefly.releaseImpulseX = 0;
          firefly.releaseImpulseY = 0;
          firefly.detachedFrom = [];

          scheduleNextAttraction(firefly, timestamp);
          chooseFireflyDestination(firefly, timestamp);
        }

        continue;
      }

      if (!firefly.moving) {
        if (timestamp >= firefly.pauseUntil) {
          chooseFireflyDestination(firefly, timestamp);
        } else {
          firefly.element.style.opacity = String(
            Math.max(0, Math.min(0.6, firefly.opacity))
          );
          continue;
        }
      }

      const elapsed = timestamp - firefly.travelStarted;

      const progress = Math.min(
        1,
        elapsed / firefly.travelDuration
      );

      const easedProgress = smoothstep(progress);

      const randomX =
        firefly.startX +
        (firefly.targetX - firefly.startX) * easedProgress;

      const randomY =
        firefly.startY +
        (firefly.targetY - firefly.startY) * easedProgress;

      if (timestamp >= firefly.nextWander) {
        firefly.wanderX = randomBetween(-0.6, 0.6);
        firefly.wanderY = randomBetween(-0.6, 0.6);
        firefly.nextWander =
          timestamp + randomBetween(500, 1800);
      }

      const target = getFireflyAttractionTarget(firefly, timestamp);

      const steeringTarget = steerTowardsTarget(
        randomX,
        randomY,
        target
      );

      firefly.velocityX +=
        (steeringTarget.x - firefly.x) *
        firefly.spring *
        frameScale;

      firefly.velocityY +=
        (steeringTarget.y - firefly.y) *
        firefly.spring *
        frameScale;

      firefly.velocityX +=
        firefly.wanderX * 0.015 * frameScale;

      firefly.velocityY +=
        firefly.wanderY * 0.015 * frameScale;

      firefly.velocityX *= Math.pow(
        firefly.friction,
        frameScale
      );

      firefly.velocityY *= Math.pow(
        firefly.friction,
        frameScale
      );

      // Clamp velocity so attraction cannot trap the firefly.
      const speed = Math.hypot(
        firefly.velocityX,
        firefly.velocityY
      );

      if (speed > FIREFLY_ATTRACTION_MAX_SPEED) {
        const scale = FIREFLY_ATTRACTION_MAX_SPEED / speed;
        firefly.velocityX *= scale;
        firefly.velocityY *= scale;
      }

      firefly.x += firefly.velocityX * frameScale;
      firefly.y += firefly.velocityY * frameScale;

      const fadeIn = Math.min(
        1,
        Math.max(0, elapsed / firefly.fadeInDuration)
      );

      const remainingTravel =
        (1 - progress) * firefly.travelDuration;

      const fadeOut = Math.min(
        1,
        Math.max(0, remainingTravel / firefly.fadeOutDuration)
      );

      const pulse =
        0.92 +
        Math.sin(
          timestamp * firefly.pulseSpeed +
          firefly.pulseOffset
        ) * 0.08;

      firefly.opacity =
        firefly.targetOpacity *
        fadeIn *
        fadeOut *
        pulse;

      if (target) {
        const shouldLinger =
          target.type === "firefly" ||
          target.distance < FIREFLY_ATTRACTION_SLOW_DISTANCE;

        if (shouldLinger) {
          if (!firefly.attracted) {
            firefly.attractionStarted = timestamp;
            firefly.attractionLinger = randomBetween(
              FIREFLY_LINGER_MIN,
              FIREFLY_LINGER_MAX
            );
          }

          firefly.attracted = true;
          firefly.attractionTargetType = target.type;
          firefly.attractionTargetId = target.id;

          if (
            timestamp - firefly.attractionStarted >=
            firefly.attractionLinger
          ) {
            startAttractionFade(firefly, timestamp);
          }
        } else {
          firefly.attracted = false;
          firefly.attractionTargetType = null;
          firefly.attractionTargetId = null;
          firefly.attractionStarted = 0;
        }
      } else {
        firefly.attracted = false;
        firefly.attractionTargetType = null;
        firefly.attractionTargetId = null;
        firefly.attractionStarted = 0;
      }

      firefly.element.style.opacity = String(
        Math.max(0, Math.min(0.6, firefly.opacity))
      );

      firefly.element.style.transform =
        `translate3d(${firefly.x - firefly.size / 2}px, ${firefly.y - firefly.size / 2}px, 0)`;

      if (progress >= 1) {
        firefly.x = firefly.targetX;
        firefly.y = firefly.targetY;

        pauseFirefly(firefly, timestamp);
      }
    }
  }

  const imageGlow = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );

  imageGlow.setAttribute("class", "cursor-image-glow");
  imageGlow.setAttribute("aria-hidden", "true");

  imageGlow.innerHTML = `
    <defs>
      <filter
        id="cursorGlowWide"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
        color-interpolation-filters="sRGB"
      >
        <feGaussianBlur stdDeviation="55" />
      </filter>

      <filter
        id="cursorGlowMedium"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
        color-interpolation-filters="sRGB"
      >
        <feGaussianBlur stdDeviation="25" />
      </filter>

      <filter
        id="cursorGlowCore"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
        color-interpolation-filters="sRGB"
      >
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </defs>

    <rect class="glow-wide" />
    <rect class="glow-medium" />
    <rect class="glow-core" />
  `;

  effects.appendChild(imageGlow);

  const glowRects = imageGlow.querySelectorAll("rect");
  const ctx = trailCanvas.getContext("2d");

  let mouseX = -1000;
  let mouseY = -1000;

  let smoothX = mouseX;
  let smoothY = mouseY;

  let targetX = mouseX;
  let targetY = mouseY;

  let velocityX = 0;
  let velocityY = 0;

  let activeGlowTarget = null;
  let previousGlowTarget = null;
  let imageBlend = 0;

  let lastFrame = 0;
  let idleTimeout = null;

  const trail = [];
  const TRAIL_LENGTH = 7;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    trailCanvas.width =
      Math.round(window.innerWidth * dpr);

    trailCanvas.height =
      Math.round(window.innerHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    imageGlow.setAttribute(
      "viewBox",
      `0 0 ${window.innerWidth} ${window.innerHeight}`
    );
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function distanceToRect(x, y, rect) {
    const nearestX = Math.max(
      rect.left,
      Math.min(x, rect.right)
    );

    const nearestY = Math.max(
      rect.top,
      Math.min(y, rect.bottom)
    );

    return Math.hypot(
      x - nearestX,
      y - nearestY
    );
  }

  function findActiveImage() {
    let closest = null;
    let closestDistance = Infinity;

    for (const element of getVisibleGlowTargets()) {
      const rect = element.getBoundingClientRect();

      const distance = distanceToRect(
        mouseX,
        mouseY,
        rect
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closest = element;
      }
    }

    return closest && closestDistance <= IMAGE_THRESHOLD
      ? closest
      : null;
  }

  function updateImageGlow() {
    if (
      !activeGlowTarget ||
      !activeGlowTarget.isConnected
    ) {
      return;
    }

    const rect = activeGlowTarget.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const radius =
      Math.min(rect.width, rect.height) * 0.04;

    glowRects.forEach((rectEl) => {
      rectEl.setAttribute("x", rect.left);
      rectEl.setAttribute("y", rect.top);
      rectEl.setAttribute("width", rect.width);
      rectEl.setAttribute("height", rect.height);
      rectEl.setAttribute("rx", radius);
      rectEl.setAttribute("ry", radius);
    });
  }

  function setCursorGlowVisible(value) {
    cursorGlow.style.opacity = value ? "1" : "0";
  }

  function updateCursorGlow() {
    cursorGlow.style.transform =
      `translate(${smoothX - CURSOR_RADIUS}px, ${smoothY - CURSOR_RADIUS}px)`;
  }

  function drawTrail() {
    ctx.clearRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );

    for (let i = trail.length - 1; i >= 0; i--) {
      const point = trail[i];

      point.life *= 0.95;

      if (point.life < 0.025) {
        trail.splice(i, 1);
        continue;
      }

      const progress =
        i / Math.max(trail.length - 1, 1);

      const radius = (1 - progress) * 65 + 50;
      const alpha =
        point.life * (1 - progress) * 0.12;

      const gradient = ctx.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        radius
      );

      gradient.addColorStop(
        0,
        `rgba(253,7,7,${alpha})`
      );

      gradient.addColorStop(
        0.35,
        `rgba(255,0,0,${alpha * 0.55})`
      );

      gradient.addColorStop(
        1,
        "rgba(255,0,0,0)"
      );

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(
        point.x,
        point.y,
        radius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  function animate(timestamp) {
    const delta = lastFrame
      ? Math.min(timestamp - lastFrame, 32)
      : 16;

    lastFrame = timestamp;

    updateFireflies(timestamp, delta);

    activeGlowTarget = findActiveImage();

    if (activeGlowTarget) {
      const rect =
        activeGlowTarget.getBoundingClientRect();

      targetX = Math.max(
        rect.left,
        Math.min(mouseX, rect.right)
      );

      targetY = Math.max(
        rect.top,
        Math.min(mouseY, rect.bottom)
      );

      if (activeGlowTarget !== previousGlowTarget) {
        velocityX = 0;
        velocityY = 0;
        previousGlowTarget = activeGlowTarget;
      }

      const frameScale = delta / 16.67;

      velocityX +=
        (targetX - smoothX) *
        SPRING_STRENGTH *
        frameScale;

      velocityY +=
        (targetY - smoothY) *
        SPRING_STRENGTH *
        frameScale;

      velocityX *= Math.pow(
        SPRING_FRICTION,
        frameScale
      );

      velocityY *= Math.pow(
        SPRING_FRICTION,
        frameScale
      );

      smoothX += velocityX * frameScale;
      smoothY += velocityY * frameScale;
    } else {
      targetX = mouseX;
      targetY = mouseY;

      const normalFactor =
        1 - Math.pow(
          1 - NORMAL_SMOOTHING,
          delta / 16.67
        );

      smoothX +=
        (mouseX - smoothX) * normalFactor;

      smoothY +=
        (mouseY - smoothY) * normalFactor;

      velocityX = 0;
      velocityY = 0;
      previousGlowTarget = null;
    }

    const targetBlend =
      activeGlowTarget ? 1 : 0;

    const blendFactor =
      1 - Math.pow(1 - 0.08, delta / 16.67);

    imageBlend +=
      (targetBlend - imageBlend) * blendFactor;

    if (imageBlend < 0.001) imageBlend = 0;

    imageGlow.style.opacity = String(imageBlend);

    updateCursorGlow();
    updateImageGlow();
    drawTrail();

    requestAnimationFrame(animate);
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;

      setCursorGlowVisible(true);

      clearTimeout(idleTimeout);

      idleTimeout = setTimeout(() => {
        setCursorGlowVisible(false);
      }, IDLE_TIMEOUT);

      trail.push({
        x: mouseX,
        y: mouseY,
        life: 1
      });

      while (trail.length > TRAIL_LENGTH) {
        trail.shift();
      }
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    clearTimeout(idleTimeout);
    setCursorGlowVisible(false);
  });

  window.addEventListener("pointerenter", () => {
    clearTimeout(idleTimeout);
  });

  window.addEventListener(
    "scroll",
    updateImageGlow,
    { passive: true }
  );

  requestAnimationFrame(animate);
})();
