const transitionSpeed = 9;

const transitionLinks = document.querySelectorAll(
  'nav a[href="/work"], nav a[href="/about"], nav a[href="/contact"], .logo[href="/"], a.project[href^="/work/"]'
);

const columns = 20;
const rows = 12;
const total = columns * rows;

function getCellOrder() {
  const origins = Array.from({ length: 8 }, () => ({
    x: Math.random() * columns,
    y: Math.random() * rows,
  }));

  const cells = Array.from({ length: total }, (_, index) => {
    const x = index % columns;
    const y = Math.floor(index / columns);

    let distance = Infinity;

    origins.forEach((origin) => {
      const d = Math.sqrt(
        Math.pow(x - origin.x, 2) +
        Math.pow(y - origin.y, 2)
      );

      distance = Math.min(distance, d);
    });

    return {
      index,
      x,
      y,
      distance,
    };
  });

  cells.sort((a, b) => {
    const difference = a.distance - b.distance;

    if (Math.abs(difference) < 2.5) {
      return Math.random() - 0.5;
    }

    return difference;
  });

  const result = [];
  const remaining = [...cells];

  while (remaining.length > 0) {
    if (result.length < total * 0.75) {
      result.push(remaining.shift());
      continue;
    }

    let bestIndex = 0;
    let bestDistance = -Infinity;

    const recent = result.slice(-12);

    remaining.forEach((candidate, index) => {
      let minimumDistance = Infinity;

      recent.forEach((previous) => {
        const distance = Math.sqrt(
          Math.pow(candidate.x - previous.x, 2) +
          Math.pow(candidate.y - previous.y, 2)
        );

        minimumDistance = Math.min(
          minimumDistance,
          distance
        );
      });

      if (minimumDistance > bestDistance) {
        bestDistance = minimumDistance;
        bestIndex = index;
      }
    });

    result.push(
      remaining.splice(bestIndex, 1)[0]
    );
  }

  return result;
}

async function waitForPageImages(iframe) {
  try {
    const doc = iframe.contentDocument;

    if (!doc) {
      return;
    }

    const images = Array.from(doc.images);

    images.forEach((image) => {
      image.loading = "eager";
      image.setAttribute("loading", "eager");
    });

    await Promise.all(
      images.map((image) => {
        if (!image.complete) {
          return new Promise((resolve) => {
            image.addEventListener("load", resolve, {
              once: true,
            });

            image.addEventListener("error", resolve, {
              once: true,
            });
          });
        }

        return Promise.resolve();
      })
    );

    await Promise.all(
      images.map(async (image) => {
        if (typeof image.decode === "function") {
          try {
            await image.decode();
          } catch {
            // Ignore individual image decode failures.
          }
        }
      })
    );

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
    });
  } catch {
    // Continue if image inspection is unavailable.
  }
}

function createMask(iframe) {
  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");

  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 2000 1200");
  svg.setAttribute("preserveAspectRatio", "none");

  svg.style.position = "fixed";
  svg.style.inset = "0";
  svg.style.width = "100vw";
  svg.style.height = "100vh";
  svg.style.pointerEvents = "none";
  svg.style.zIndex = "-1";

  const defs = document.createElementNS(
    svgNS,
    "defs"
  );

  const mask = document.createElementNS(
    svgNS,
    "mask"
  );

  const maskId =
    `page-transition-mask-${Date.now()}`;

  mask.setAttribute("id", maskId);
  mask.setAttribute(
    "maskUnits",
    "userSpaceOnUse"
  );
  mask.setAttribute("x", "0");
  mask.setAttribute("y", "0");
  mask.setAttribute("width", "2000");
  mask.setAttribute("height", "1200");

  const background =
    document.createElementNS(svgNS, "rect");

  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", "2000");
  background.setAttribute("height", "1200");
  background.setAttribute("fill", "black");

  mask.appendChild(background);

  const maskCells = [];

  const cellWidth = 2000 / columns;
  const cellHeight = 1200 / rows;

  for (let i = 0; i < total; i++) {
    const x = i % columns;
    const y = Math.floor(i / columns);

    const rect =
      document.createElementNS(svgNS, "rect");

    rect.setAttribute(
      "x",
      x * cellWidth
    );

    rect.setAttribute(
      "y",
      y * cellHeight
    );

    rect.setAttribute(
      "width",
      cellWidth + 1
    );

    rect.setAttribute(
      "height",
      cellHeight + 1
    );

    rect.setAttribute("fill", "white");
    rect.style.opacity = "0";

    mask.appendChild(rect);

    maskCells.push(rect);
  }

  defs.appendChild(mask);
  svg.appendChild(defs);

  document.body.appendChild(svg);

  iframe.style.maskImage =
    `url(#${maskId})`;

  iframe.style.webkitMaskImage =
    `url(#${maskId})`;

  return maskCells;
}

function revealCells(maskCells, order, destination) {
  let current = 0;

  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;

    const target = Math.min(
      Math.floor(elapsed / transitionSpeed),
      order.length
    );

    while (current < target) {
      const cellIndex =
        order[current].index;

      maskCells[cellIndex].style.opacity = "1";

      current++;
    }

    if (current < order.length) {
      requestAnimationFrame(frame);
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.location.href = destination;
      });
    });
  }

  requestAnimationFrame(frame);
}

async function startTransition(destination) {
  if (
    document.body.classList.contains(
      "page-transition-running"
    )
  ) {
    return;
  }

  document.body.classList.add(
    "page-transition-running"
  );

  const iframe = document.createElement("iframe");

  iframe.className =
    "page-transition-iframe";

  iframe.src = destination;

  document.body.appendChild(iframe);

  await new Promise((resolve) => {
    iframe.addEventListener(
      "load",
      resolve,
      { once: true }
    );
  });

  await waitForPageImages(iframe);

  iframe.classList.add(
    "page-transition-ready"
  );

  const maskCells =
    createMask(iframe);

  const order = getCellOrder();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      revealCells(
        maskCells,
        order,
        destination
      );
    });
  });
}

transitionLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    startTransition(link.href);
  });
});

const style = document.createElement("style");

style.textContent = `
  .page-transition-iframe {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    border: 0;
    z-index: 999999;
    opacity: 0;
    pointer-events: none;
    background: transparent;
  }

  .page-transition-iframe.page-transition-ready {
    opacity: 1;
  }

  body.page-transition-running {
    overflow: hidden;
  }
`;

document.head.appendChild(style);