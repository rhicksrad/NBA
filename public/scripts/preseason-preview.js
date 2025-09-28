(function () {
  const pageId = document.body?.dataset?.previewId;
  const registry = window.preseasonDashboards;

  if (!pageId || !registry || !registry[pageId]) {
    return;
  }

  const { teams } = registry[pageId];
  const gridColor = "rgba(18, 42, 68, 0.16)";
  const tickColor = "rgba(12, 34, 56, 0.66)";
  const labelColor = "rgba(12, 22, 34, 0.78)";
  const FALLBACK_RATIO = 0.62;

  const sizingRegistry = new Map();

  Chart.defaults.font.family = "'Barlow', 'Inter', system-ui, sans-serif";
  Chart.defaults.color = labelColor;

  function ensureCanvasWrapper(canvas) {
    if (!canvas) {
      return null;
    }
    const parent = canvas.parentElement;
    if (!parent) {
      return null;
    }
    if (parent.classList.contains('chart-card__canvas')) {
      return parent;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card__canvas';
    parent.insertBefore(wrapper, canvas);
    wrapper.appendChild(canvas);
    return wrapper;
  }

  function applySizing(canvas, wrapper) {
    if (!canvas || !wrapper) {
      return;
    }

    const existingCleanup = sizingRegistry.get(canvas);
    if (existingCleanup) {
      existingCleanup();
    }

    const previousHeights = {
      wrapper: wrapper.style.height,
      canvasHeight: canvas.style.height,
      canvasWidth: canvas.style.width
    };

    const ratioAttr = Number.parseFloat(canvas.dataset.chartRatio);
    const ratio = Number.isFinite(ratioAttr) && ratioAttr > 0 ? ratioAttr : FALLBACK_RATIO;

    let frameId;

    const updateHeight = () => {
      const width = wrapper.clientWidth;
      if (!width) {
        return;
      }
      const styles = window.getComputedStyle(wrapper);
      const minHeight = Number.parseFloat(styles.minHeight) || 0;
      const maxHeight = Number.parseFloat(styles.maxHeight);
      let nextHeight = width * ratio;
      if (minHeight) {
        nextHeight = Math.max(nextHeight, minHeight);
      }
      if (Number.isFinite(maxHeight) && maxHeight > 0) {
        nextHeight = Math.min(nextHeight, maxHeight);
      }
      wrapper.style.height = `${nextHeight}px`;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    };

    const scheduleUpdate = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(updateHeight);
    };

    updateHeight();

    let resizeObserver;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(wrapper);
    } else {
      window.addEventListener('resize', scheduleUpdate, { passive: true });
    }

    const cleanup = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', scheduleUpdate);
      }
      wrapper.style.height = previousHeights.wrapper;
      canvas.style.height = previousHeights.canvasHeight;
      canvas.style.width = previousHeights.canvasWidth;
    };

    sizingRegistry.set(canvas, cleanup);
  }

  function prepareCanvas(canvas, ratio) {
    if (!canvas) {
      return null;
    }
    if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
      canvas.dataset.chartRatio = String(ratio);
    }
    canvas.removeAttribute('width');
    canvas.removeAttribute('height');
    const wrapper = ensureCanvasWrapper(canvas);
    if (wrapper) {
      applySizing(canvas, wrapper);
    }
    return canvas;
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  teams.forEach((team) => {
    const { slug, colors, rotation, skill, shotProfile, tempo, synergy, name } = team;

    const rotationCtx = document.getElementById(`${slug}-rotation`);
    const skillCtx = document.getElementById(`${slug}-skill-spider`);
    const shotCtx = document.getElementById(`${slug}-shot-zones`);
    const tempoCtx = document.getElementById(`${slug}-tempo-curve`);
    const synergyCtx = document.getElementById(`${slug}-synergy-matrix`);

    if (rotationCtx) {
      const canvas = prepareCanvas(rotationCtx, 0.74);
      if (canvas) {
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: rotation.labels,
            datasets: [
              {
                label: 'Target minutes',
                data: rotation.data,
                backgroundColor: rotation.data.map((value, index) =>
                  index === 0 ? hexToRgba(colors.primary, 0.9) : hexToRgba(colors.primary, 0.7)
                ),
                borderColor: colors.primary,
                borderWidth: 1,
                borderRadius: 9,
                hoverBackgroundColor: hexToRgba(colors.secondary, 0.75)
              }
            ]
          },
          options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: tickColor, stepSize: 4 }
              },
              y: {
                grid: { display: false },
                ticks: { color: tickColor }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => `${context.raw} minute plan`
                }
              }
            }
          }
        });
      }
    }

    if (skillCtx) {
      const canvas = prepareCanvas(skillCtx, 0.96);
      if (canvas) {
        new Chart(canvas, {
          type: 'radar',
          data: {
            labels: skill.labels,
            datasets: [
              {
                label: 'Coaching blueprint',
                data: skill.training,
                borderColor: colors.primary,
                backgroundColor: hexToRgba(colors.primary, 0.25),
                pointBackgroundColor: colors.primary,
                pointBorderColor: '#ffffff'
              },
              {
                label: 'Current readiness',
                data: skill.readiness,
                borderColor: colors.tertiary,
                backgroundColor: hexToRgba(colors.tertiary || '#7f8ea3', 0.3),
                pointBackgroundColor: colors.tertiary,
                pointBorderColor: '#ffffff'
              }
            ]
          },
          options: {
            maintainAspectRatio: false,
            scales: {
              r: {
                suggestedMin: 0,
                suggestedMax: 10,
                angleLines: { color: gridColor },
                grid: { color: gridColor },
                pointLabels: { color: tickColor },
                ticks: { display: false }
              }
            }
          }
        });
      }
    }

    if (shotCtx) {
      const canvas = prepareCanvas(shotCtx, 0.68);
      if (canvas) {
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels: shotProfile.labels,
            datasets: [
              {
                label: name,
                data: shotProfile.team,
                backgroundColor: hexToRgba(colors.primary, 0.75),
                borderColor: colors.primary,
                borderWidth: 1,
                borderRadius: 8
              },
              {
                label: 'League baseline',
                data: shotProfile.league,
                backgroundColor: 'rgba(18, 42, 68, 0.18)',
                borderColor: 'rgba(18, 42, 68, 0.4)',
                borderWidth: 1,
                borderRadius: 8
              }
            ]
          },
          options: {
            maintainAspectRatio: false,
            scales: {
              x: {
                stacked: false,
                grid: { display: false },
                ticks: { color: tickColor }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor, callback: (value) => `${value}%` }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => `${context.dataset.label}: ${context.raw}% of attempts`
                }
              }
            }
          }
        });
      }
    }

    if (tempoCtx) {
      const canvas = prepareCanvas(tempoCtx, 0.6);
      if (canvas) {
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: tempo.labels,
            datasets: [
              {
                label: 'Tempo sessions',
                data: tempo.tempo,
                borderColor: colors.primary,
                backgroundColor: hexToRgba(colors.primary, 0.2),
                fill: true,
                tension: 0.35,
                pointRadius: 4,
                pointBackgroundColor: colors.primary
              },
              {
                label: 'Special situation installs',
                data: tempo.specials,
                borderColor: colors.secondary,
                backgroundColor: hexToRgba(colors.secondary || colors.primary, 0.2),
                fill: true,
                tension: 0.35,
                pointRadius: 4,
                pointBackgroundColor: colors.secondary || colors.primary
              }
            ]
          },
          options: {
            maintainAspectRatio: false,
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: tickColor }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor }
              }
            }
          }
        });
      }
    }

    if (synergyCtx) {
      const canvas = prepareCanvas(synergyCtx, 0.68);
      if (canvas) {
        new Chart(canvas, {
          type: 'bubble',
          data: {
            datasets: [
              {
                label: `${name} pairings`,
                data: synergy.points.map((point) => ({ x: point.x, y: point.y, r: point.r })),
                backgroundColor: synergy.points.map((_, index) =>
                  index === 0 ? hexToRgba(colors.primary, 0.65) : hexToRgba(colors.secondary || colors.primary, 0.55)
                ),
                borderColor: colors.primary,
                borderWidth: 1
              }
            ]
          },
          options: {
            maintainAspectRatio: false,
            scales: {
              x: {
                title: { display: true, text: synergy.xLabel, color: tickColor },
                grid: { color: gridColor },
                ticks: { color: tickColor }
              },
              y: {
                title: { display: true, text: synergy.yLabel, color: tickColor },
                grid: { color: gridColor },
                ticks: { color: tickColor }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  title: (items) => (items[0]?.raw ? `${items[0].raw.x} pace / ${items[0].raw.y} sync` : ''),
                  label: (context) => synergy.points[context.dataIndex]?.label || ''
                }
              }
            }
          }
        });
      }
    }
  });
})();
