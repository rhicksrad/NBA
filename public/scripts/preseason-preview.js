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

  Chart.defaults.font.family = "'Barlow', 'Inter', system-ui, sans-serif";
  Chart.defaults.color = labelColor;

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
      new Chart(rotationCtx, {
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

    if (skillCtx) {
      new Chart(skillCtx, {
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

    if (shotCtx) {
      new Chart(shotCtx, {
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

    if (tempoCtx) {
      new Chart(tempoCtx, {
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

    if (synergyCtx) {
      new Chart(synergyCtx, {
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
                title: (items) => items[0]?.raw ? `${items[0].raw.x} pace / ${items[0].raw.y} sync` : '',
                label: (context) => synergy.points[context.dataIndex]?.label || ''
              }
            }
          }
        }
      });
    }
  });
})();
