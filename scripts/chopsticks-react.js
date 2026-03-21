/* global React, ReactDOM */

(() => {
  const e = React.createElement;
  // - xRatio/yRatio: anchor as ratio of viewport size (0-1 is on-screen)
  // - xOffset/yOffset: pixel offset applied after ratio
  // - directionDeg: chopstick direction in degrees (0 = right, 90 = down)
  // - segmentLength: base segment before internal *3 extension
  // - imageIndex (optional): picks a specific image from /api/images list
  const CHOPSTICK_DEFINITIONS = [
    {
      id: "1",
      xRatio: 1,
      xOffset: 48,
      yRatio: 0.46,
      yOffset: 0,
      directionDeg: 185,
      segmentLength: 76,
    },
    {
      id: "2",
      xRatio: 1,
      xOffset: 52,
      yRatio: 0.1,
      yOffset: 0,
      directionDeg: 150,
      segmentLength: 57,
      imageIndex: 1,
    },
    {
      id: "3",
      xRatio: 0.65,
      xOffset: 0,
      yRatio: 0,
      yOffset: -42,
      directionDeg: 110,
      segmentLength: 58,
    },
    {
      id: "4",
      xRatio: 0.4,
      xOffset: 0,
      yRatio: 0,
      yOffset: -52,
      directionDeg: 95,
      segmentLength: 52,
    },

    {
      id: "5",
      xRatio: 0.2,
      xOffset: 0,
      yRatio: 0,
      yOffset: -48,
      directionDeg: 70,
      segmentLength: 45,
      imageIndex: 0,
    },

    {
      id: "6",
      xRatio: 0,
      xOffset: -50,
      yRatio: 0.35,
      yOffset: 0,
      directionDeg: 10,
      segmentLength: 84,
    },
    {
      id: "7",
      xRatio: 0,
      xOffset: -46,
      yRatio: 0.66,
      yOffset: 0,
      directionDeg: -20,
      segmentLength: 70,
    },
  ];

  const USE_MANUAL_DEFINITIONS = true;

  const MOVE_DURATION_MS = 850;

  function getNextNumericId(definitions) {
    let maxId = 0;
    definitions.forEach((def) => {
      const n = Number(def && def.id);
      if (Number.isFinite(n)) {
        maxId = Math.max(maxId, Math.floor(n));
      }
    });
    return maxId + 1;
  }

  function renumberSequentialIds(definitions) {
    return definitions.map((def, index) => ({
      ...def,
      id: String(index + 1),
    }));
  }

  function easeInOutCubic(t) {
    if (t < 0.5) {
      return 4 * t * t * t;
    }
    return 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function getNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function lerpAngleDeg(from, to, t) {
    const delta = ((((to - from) % 360) + 540) % 360) - 180;
    return from + delta * t;
  }

  function findDefinitionIndex(definitions, preferredId, fallbackIndex) {
    const byExact = definitions.findIndex(
      (def) => String(def.id || "") === String(preferredId),
    );
    if (byExact >= 0) {
      return byExact;
    }
    return fallbackIndex < definitions.length ? fallbackIndex : -1;
  }

  // Keeps an animation clock in seconds for lightweight procedural motion.
  function useAnimationClock() {
    const [time, setTime] = React.useState(0);

    React.useEffect(() => {
      let rafId = 0;
      const tick = (ts) => {
        setTime(ts * 0.001);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, []);

    return time;
  }

  // Loads an image and samples random pixels as animated dot metadata.
  function sampleImageToDotData(imageSrc, sampleCount) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Canvas 2D context not available"));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        const dots = [];

        for (let i = 0; i < sampleCount; i += 1) {
          const px = Math.floor(Math.random() * canvas.width);
          const py = Math.floor(Math.random() * canvas.height);
          const idx = (py * canvas.width + px) * 4;

          const r = imageData[idx];
          const g = imageData[idx + 1];
          const b = imageData[idx + 2];
          const a = imageData[idx + 3] / 255;

          dots.push({
            xNorm: px / canvas.width,
            yNorm: py / canvas.height,
            color: `rgba(${r}, ${g}, ${b}, ${Math.max(0.25, a).toFixed(3)})`,
            phase: Math.random() * Math.PI * 2,
            speed: 0.8 + Math.random() * 1.2,
            amplitude: 0.8 + Math.random() * 1.8,
            radius: 4.8 + Math.random() * 3.8, // dot size
          });
        }

        resolve(dots);
      };
      img.onerror = () =>
        reject(new Error(`Failed to load image: ${imageSrc}`));
      img.src = imageSrc;
    });
  }

  // Renders a rough animated thumbnail made from sampled circular color dots.
  function PixelDotThumbnail({ imageSrc, size = 56, onSelect }) {
    const [dots, setDots] = React.useState([]);
    const [active, setActive] = React.useState(false);
    const time = useAnimationClock();

    React.useEffect(() => {
      let cancelled = false;
      sampleImageToDotData(imageSrc, 40) // sample 40 dots for thumbnail
        .then((nextDots) => {
          if (!cancelled) {
            setDots(nextDots);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDots([]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [imageSrc]);

    return e(
      "div",
      {
        onClick: () => {
          setActive((prev) => !prev);
          if (onSelect) {
            onSelect(imageSrc);
          }
        },
        // title: "Click to pulse dots",
        style: {
          position: "absolute",
          width: size,
          height: size,
          left: -size / 2,
          top: -size / 2,
          borderRadius: size / 2,
          background: "rgba(8, 10, 16, 0.15)",
          outline: "1px solid rgba(180, 200, 220, 0.22)",
          backdropFilter: "blur(1px)",
          cursor: "pointer",
          pointerEvents: "auto",
          overflow: "hidden",
        },
      },
      dots.map((dot, index) => {
        const wiggleX = Math.sin(time * dot.speed + dot.phase) * dot.amplitude;
        const wiggleY =
          Math.cos(time * dot.speed * 0.85 + dot.phase) * dot.amplitude;
        const pulse = active ? 1 + 0.15 * Math.sin(time * 6 + dot.phase) : 1;

        return e("div", {
          key: `${imageSrc}-dot-${index}`,
          style: {
            position: "absolute",
            left: dot.xNorm * size + wiggleX,
            top: dot.yNorm * size + wiggleY,
            width: dot.radius * 2 * pulse,
            height: dot.radius * 2 * pulse,
            marginLeft: -dot.radius,
            marginTop: -dot.radius,
            borderRadius: "50%",
            background: dot.color,
            boxShadow: "0 0 2px rgba(255, 255, 255, 0.18)",
          },
        });
      }),
    );
  }

  function getImageFileName(imageSrc) {
    const normalized = String(imageSrc || "").replace(/\\/g, "/");
    const name = normalized.split("/").pop() || normalized;
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }

  // Draws one chopstick pair and places its dot-thumbnail at the calculated tip.
  function ChopstickPair({ id, startPos, endPos, imageSrc, onThumbnailClick }) {
    const [isHovered, setIsHovered] = React.useState(false);
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const baseLength = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);

    const stickLength = baseLength * 3;
    const tipX = startPos.x + Math.cos(angle) * stickLength;
    const tipY = startPos.y + Math.sin(angle) * stickLength;
    const thumbX = Math.max(28, Math.min(window.innerWidth - 28, tipX));
    const thumbY = Math.max(28, Math.min(window.innerHeight - 28, tipY));
    const stickGap = 34;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const leftStartX = startPos.x + nx * (stickGap * 0.5);
    const leftStartY = startPos.y + ny * (stickGap * 0.5);
    const rightStartX = startPos.x - nx * (stickGap * 0.5);
    const rightStartY = startPos.y - ny * (stickGap * 0.5);
    const fileName = getImageFileName(imageSrc);
    const hoverTransform = isHovered
      ? `translate(${thumbX}px, ${thumbY}px) scale(1.5) translate(${-thumbX}px, ${-thumbY}px)`
      : "none";

    const onHoverIn = () => {
      setIsHovered(true);
    };
    const onHoverOut = () => {
      setIsHovered(false);
    };
    const onThumbClick = () => {
      if (onThumbnailClick) {
        onThumbnailClick(imageSrc);
      }
    };

    return e(
      "div",
      {
        key: id,
        style: {
          position: "fixed",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          transform: hoverTransform,
          transformOrigin: "0 0",
          transition: "transform 180ms ease",
        },
      },
      [
        // left stick
        e("div", {
          key: `${id}-left-stick`,
          onMouseEnter: onHoverIn,
          onMouseLeave: onHoverOut,
          style: {
            position: "absolute",
            left: leftStartX,
            top: leftStartY,
            width: stickLength,
            height: 10, // width of the stick
            transformOrigin: "0 50%",
            transform: `rotate(${angle}rad)`,
            borderRadius: 999,
            background: "linear-gradient(90deg, #f2d2a3 0%, #c8955c 100%)",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.25)",
            pointerEvents: "auto",
            cursor: "pointer",
          },
        }), // right stick
        e("div", {
          key: `${id}-right-stick`,
          onMouseEnter: onHoverIn,
          onMouseLeave: onHoverOut,
          style: {
            position: "absolute",
            left: rightStartX,
            top: rightStartY,
            width: stickLength,
            height: 10,
            transformOrigin: "0 50%",
            transform: `rotate(${angle}rad)`,
            borderRadius: 999,
            background: "linear-gradient(90deg, #f2d2a3 0%, #c8955c 100%)",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.25)",
            pointerEvents: "auto",
            cursor: "pointer",
          },
        }), // thumbnail at tip
        e(
          "div",
          {
            key: `${id}-dot-thumb-anchor`,
            onMouseEnter: onHoverIn,
            onMouseLeave: onHoverOut,
            style: {
              position: "fixed",
              left: thumbX,
              top: thumbY,
              pointerEvents: "auto",
            },
          },
          isHovered
            ? [
                e(
                  "div",
                  {
                    key: `${id}-hover-image-shell`,
                    onClick: (event) => {
                      event.stopPropagation();
                      onThumbClick();
                    },
                    style: {
                      position: "absolute",
                      width: 98,
                      height: 98,
                      left: -29,
                      top: -29,
                      borderRadius: "50%",
                      overflow: "hidden",
                      outline: "2px solid rgba(255, 255, 255, 0.56)",
                      boxShadow: "0 10px 20px rgba(0, 0, 0, 0.35)",
                      cursor: "pointer",
                      background: "rgba(0, 0, 0, 0.35)",
                    },
                  },
                  e("img", {
                    src: imageSrc,
                    alt: fileName,
                    onClick: (event) => {
                      event.stopPropagation();
                      onThumbClick();
                    },
                    style: {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    },
                  }),
                ),
                e(
                  "div",
                  {
                    key: `${id}-hover-tooltip`,
                    style: {
                      position: "absolute",
                      left: 40,
                      top: -17,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "rgba(12, 17, 27, 0.9)",
                      color: "#ecf2ff",
                      border: "1px solid rgba(141, 173, 215, 0.42)",
                      fontSize: 12,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      boxShadow: "0 4px 14px rgba(0, 0, 0, 0.3)",
                    },
                  },
                  fileName,
                ),
              ]
            : e(PixelDotThumbnail, {
                imageSrc,
                size: 88,
                onSelect: onThumbClick,
              }),
        ),
      ],
    );
  }

  // Converts an angle in degrees to a direction vector endpoint.
  function endpointFromDirection(startPos, directionDeg, segmentLength) {
    const radians = (directionDeg * Math.PI) / 180;
    return {
      x: startPos.x + Math.cos(radians) * segmentLength,
      y: startPos.y + Math.sin(radians) * segmentLength,
    };
  }

  // Builds runtime chopsticks from explicit definitions for full manual control.
  function createManualChopsticks(width, height, imagePaths, definitions) {
    const source =
      imagePaths.length > 0 ? imagePaths : ["./images/1.png", "./images/2.png"];

    return definitions.map((def, index) => {
      const sx = width * (def.xRatio ?? 0) + (def.xOffset ?? 0);
      const sy = height * (def.yRatio ?? 0) + (def.yOffset ?? 0);
      const segmentLength = Math.max(1, def.segmentLength ?? 40);
      const startPos = { x: sx, y: sy };
      const endPos = endpointFromDirection(
        startPos,
        def.directionDeg ?? 0,
        segmentLength,
      );

      let imageSrc = source[index % source.length];
      if (typeof def.imageIndex === "number" && source.length > 0) {
        const safe = Math.max(0, Math.min(source.length - 1, def.imageIndex));
        imageSrc = source[safe];
      }

      return {
        id: def.id || `manual-${index + 1}`,
        startPos,
        endPos,
        imageSrc,
      };
    });
  }

  // Generates chopstick pair anchors around viewport borders with inward directions.
  // This is kept as a reusable preset generator.
  function createBorderChopsticks(width, height, imagePaths) {
    const source =
      imagePaths.length > 0 ? imagePaths : ["./images/1.png", "./images/2.png"];

    const PAIR_COUNT = 10;
    const EDGE_MARGIN_OUTSIDE = 48;
    const BASE_SEGMENT = 30;
    const SEGMENT_JITTER = 38;
    const ANGLE_JITTER = 0;

    // Deterministic pseudo-random helper for stable per-index placement.
    function pseudoRand(index, salt) {
      const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    }

    return Array.from({ length: PAIR_COUNT }, (_, i) => {
      const side = i % 4; // 0 top, 1 right, 2 bottom, 3 left
      const lane = Math.floor(i / 4);
      const laneCount = Math.ceil(PAIR_COUNT / 4);
      const t = (lane + 1) / (laneCount + 1);

      let sx = 0;
      let sy = 0;

      if (side === 0) {
        sx = width * (0.1 + 0.8 * t);
        sy = -EDGE_MARGIN_OUTSIDE;
      } else if (side === 1) {
        sx = width + EDGE_MARGIN_OUTSIDE;
        sy = height * (0.1 + 0.8 * t);
      } else if (side === 2) {
        sx = width * (0.1 + 0.8 * t);
        sy = height + EDGE_MARGIN_OUTSIDE;
      } else {
        sx = -EDGE_MARGIN_OUTSIDE;
        sy = height * (0.1 + 0.8 * t);
      }

      const toCenterX = width * 0.5 - sx;
      const toCenterY = height * 0.5 - sy;
      const baseAngle = Math.atan2(toCenterY, toCenterX);
      const randomAngleOffset = (pseudoRand(i, 11) * 2 - 1) * ANGLE_JITTER;
      const finalAngle = baseAngle + randomAngleOffset;
      const segLen = BASE_SEGMENT + pseudoRand(i, 23) * SEGMENT_JITTER;

      const ex = sx + Math.cos(finalAngle) * segLen;
      const ey = sy + Math.sin(finalAngle) * segLen;

      return {
        id: `edge-${i + 1}`,
        startPos: { x: sx, y: sy },
        endPos: { x: ex, y: ey },
        imageSrc: source[Math.floor(pseudoRand(i, 31) * source.length)],
      };
    });
  }

  // Main overlay component: loads assets, handles click-to-switch, and renders all pairs.
  function ChopsticksLayer() {
    const [viewport, setViewport] = React.useState({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    const [imagePaths, setImagePaths] = React.useState([]);
    const [pairs, setPairs] = React.useState([]);
    const [manualDefinitions, setManualDefinitions] = React.useState(
      CHOPSTICK_DEFINITIONS,
    );
    const animationRef = React.useRef(0);
    const nextIdRef = React.useRef(getNextNumericId(CHOPSTICK_DEFINITIONS));

    React.useEffect(() => {
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, []);

    // Keeps border layout responsive.
    React.useEffect(() => {
      const onResize = () => {
        setViewport({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);

    // Fetches image file list for random thumbnail assignment.
    React.useEffect(() => {
      let cancelled = false;
      fetch("/api/images", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { images: [] }))
        .then((data) => {
          if (cancelled) return;
          const files = Array.isArray(data.images) ? data.images : [];
          setImagePaths(files.map((name) => `./images/${name}`));
        })
        .catch(() => {
          if (!cancelled) {
            setImagePaths(["./images/1.png", "./images/2.png"]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    // Fetches available color-depth pairs for robust fallback matching.
    React.useEffect(() => {
      let cancelled = false;
      fetch("/api/pairs", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { pairs: [] }))
        .then((data) => {
          if (cancelled) return;
          setPairs(Array.isArray(data.pairs) ? data.pairs : []);
        })
        .catch(() => {
          if (!cancelled) {
            setPairs([]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    // Bridges thumbnail clicks to the point-cloud module API.
    const handleThumbnailClick = React.useCallback(
      async (imageSrc) => {
        const api = window.__pointCloudApi;
        const normalize = (value) => String(value || "").replace(/\\/g, "/");
        const getBasename = (value) => {
          const normalized = normalize(value);
          return normalized.split("/").pop() || normalized;
        };
        const target = normalize(imageSrc);
        const targetNoDot = target.replace(/^\.+\//, "");
        const targetBase = getBasename(targetNoDot);

        if (api && typeof api.switchPairByColorPath === "function") {
          try {
            await api.switchPairByColorPath(target);
            return;
          } catch {
            // Falls back to pair lookup below when direct switch fails.
          }
        }

        const found = pairs.find((pair) => {
          const colorPath = normalize(pair.colorPath);
          const colorNoDot = colorPath.replace(/^\.+\//, "");
          const colorBase = getBasename(colorNoDot);
          return (
            colorPath.endsWith(targetNoDot) ||
            colorPath === target ||
            colorNoDot === targetNoDot ||
            colorBase === targetBase
          );
        });

        if (found && api && typeof api.switchPairByColorPath === "function") {
          await api.switchPairByColorPath(found.colorPath);
        }
      },
      [pairs],
    );

    const handleMoveFirstToSecond = React.useCallback(() => {
      if (!USE_MANUAL_DEFINITIONS) return;

      setManualDefinitions((prev) => {
        if (!Array.isArray(prev) || prev.length < 1) {
          return prev;
        }

        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = 0;
        }

        const base = prev.slice();

        const firstOriginal = base[0];
        const incomingId = String(nextIdRef.current);
        nextIdRef.current += 1;
        const transitions = [];
        for (let i = 0; i < base.length - 1; i += 1) {
          const source = base[i];
          const target = base[i + 1];
          const from = {
            xRatio: getNumber(source.xRatio, 0),
            yRatio: getNumber(source.yRatio, 0),
            xOffset: getNumber(source.xOffset, 0),
            yOffset: getNumber(source.yOffset, 0),
            directionDeg: getNumber(source.directionDeg, 0),
          };
          const to = {
            xRatio: getNumber(target.xRatio, from.xRatio),
            yRatio: getNumber(target.yRatio, from.yRatio),
            xOffset: getNumber(target.xOffset, from.xOffset),
            yOffset: getNumber(target.yOffset, from.yOffset),
            directionDeg: getNumber(target.directionDeg, from.directionDeg),
          };

          transitions.push({ index: i, from, to });
        }

        const lastIndex = base.length - 1;
        const last = base[lastIndex];
        const removedLastId = String(last.id || "");
        const lastFrom = {
          xRatio: getNumber(last.xRatio, 0),
          yRatio: getNumber(last.yRatio, 0),
          xOffset: getNumber(last.xOffset, 0),
          yOffset: getNumber(last.yOffset, 0),
          directionDeg: getNumber(last.directionDeg, 0),
        };
        const lastTo = {
          xRatio: lastFrom.xRatio,
          yRatio: lastFrom.yRatio,
          xOffset: lastFrom.xOffset,
          yOffset: lastFrom.yOffset + viewport.height + 220,
          directionDeg: lastFrom.directionDeg,
        };
        transitions.push({ index: lastIndex, from: lastFrom, to: lastTo });

        const incomingIndex = base.length;
        const incomingTo = {
          xRatio: getNumber(firstOriginal.xRatio, 0),
          yRatio: getNumber(firstOriginal.yRatio, 0),
          xOffset: getNumber(firstOriginal.xOffset, 0),
          yOffset: getNumber(firstOriginal.yOffset, 0),
          directionDeg: getNumber(firstOriginal.directionDeg, 0),
        };
        const incomingFrom = {
          xRatio: incomingTo.xRatio,
          yRatio: incomingTo.yRatio,
          xOffset: incomingTo.xOffset + viewport.width + 260,
          yOffset: incomingTo.yOffset + viewport.height * 0.42,
          directionDeg: incomingTo.directionDeg,
        };

        const incomingDef = {
          ...firstOriginal,
          id: incomingId,
          xRatio: incomingFrom.xRatio,
          yRatio: incomingFrom.yRatio,
          xOffset: incomingFrom.xOffset,
          yOffset: incomingFrom.yOffset,
          directionDeg: incomingFrom.directionDeg,
        };
        transitions.push({
          index: incomingIndex,
          from: incomingFrom,
          to: incomingTo,
        });

        const prepared = [...base, incomingDef];

        if (transitions.length === 0) {
          return prepared;
        }

        const startTs = performance.now();
        const runFrame = (now) => {
          const elapsed = now - startTs;
          const t = Math.min(1, elapsed / MOVE_DURATION_MS);
          const eased = easeInOutCubic(t);

          setManualDefinitions((current) => {
            if (
              !Array.isArray(current) ||
              current.length < transitions.length
            ) {
              return current;
            }

            const next = current.slice();
            transitions.forEach((item) => {
              const currentSource = next[item.index] || {};
              next[item.index] = {
                ...currentSource,
                xRatio:
                  item.from.xRatio +
                  (item.to.xRatio - item.from.xRatio) * eased,
                yRatio:
                  item.from.yRatio +
                  (item.to.yRatio - item.from.yRatio) * eased,
                xOffset:
                  item.from.xOffset +
                  (item.to.xOffset - item.from.xOffset) * eased,
                yOffset:
                  item.from.yOffset +
                  (item.to.yOffset - item.from.yOffset) * eased,
                directionDeg: lerpAngleDeg(
                  item.from.directionDeg,
                  item.to.directionDeg,
                  eased,
                ),
              };
            });
            return next;
          });

          if (t < 1) {
            animationRef.current = requestAnimationFrame(runFrame);
          } else {
            animationRef.current = 0;
            setManualDefinitions((finalState) => {
              if (!Array.isArray(finalState)) {
                return finalState;
              }

              const withoutLast = removedLastId
                ? finalState.filter(
                    (def) => String(def.id || "") !== removedLastId,
                  )
                : finalState.slice();

              const incomingIdx = withoutLast.findIndex(
                (def) => String(def.id || "") === incomingId,
              );

              let ordered = withoutLast;
              if (incomingIdx > 0) {
                const incomingDef = withoutLast[incomingIdx];
                ordered = [
                  incomingDef,
                  ...withoutLast.slice(0, incomingIdx),
                  ...withoutLast.slice(incomingIdx + 1),
                ];
              }

              const renumbered = renumberSequentialIds(ordered);
              nextIdRef.current = getNextNumericId(renumbered);
              return renumbered;
            });
          }
        };

        animationRef.current = requestAnimationFrame(runFrame);
        return prepared;
      });
    }, [viewport.height, viewport.width]);

    const chopsticks = React.useMemo(() => {
      if (USE_MANUAL_DEFINITIONS) {
        return createManualChopsticks(
          viewport.width,
          viewport.height,
          imagePaths,
          manualDefinitions,
        );
      }

      return createBorderChopsticks(
        viewport.width,
        viewport.height,
        imagePaths,
      );
    }, [viewport.width, viewport.height, imagePaths, manualDefinitions]);

    return e(
      "div",
      {
        id: "chopsticks-container",
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
        },
      },
      [
        ...chopsticks.map((item) =>
          e(ChopstickPair, {
            key: item.id,
            id: item.id,
            startPos: item.startPos,
            endPos: item.endPos,
            imageSrc: item.imageSrc,
            onThumbnailClick: handleThumbnailClick,
          }),
        ),
        USE_MANUAL_DEFINITIONS
          ? e(
              "button",
              {
                key: "move-stick-button",
                onClick: handleMoveFirstToSecond,
                title: "Cascade move: each chopstick moves to the next one",
                style: {
                  position: "fixed",
                  right: 14,
                  bottom: 14,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "rgba(255, 255, 255, 0.35)",
                  cursor: "pointer",
                  pointerEvents: "auto",
                  fontSize: 12,
                  lineHeight: "24px",
                  padding: 0,
                  textAlign: "center",
                  backdropFilter: "blur(2px)",
                },
              },
              "~",
            )
          : null,
      ],
    );
  }

  // Mounts the chopsticks overlay app after the HTML container is available.
  const root = ReactDOM.createRoot(document.getElementById("chopsticks-root"));
  root.render(e(ChopsticksLayer));
})();
