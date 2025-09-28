/*
 * Preseason dashboard data for each preview page.
 * Populates 10 visualizations (5 per team) using Chart.js.
 */

window.preseasonDashboards = {
  "preseason-12400001": {
    teams: [
      {
        name: "Boston Celtics",
        slug: "boston-celtics",
        colors: {
          primary: "#007A33",
          secondary: "#2C5234",
          tertiary: "#CBA135"
        },
        rotation: {
          labels: [
            "Jordan Walsh",
            "Baylor Scheierman",
            "Payton Pritchard",
            "Neemias Queta",
            "Oshae Brissett"
          ],
          data: [24, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 9, 6, 8],
          readiness: [6, 8, 8, 7, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [28, 12, 10, 22, 28],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [68, 74, 77, 72, 70],
          specials: [22, 28, 34, 36, 30]
        },
        synergy: {
          points: [
            { label: "Walsh + Pritchard", x: 102, y: 78, r: 14 },
            { label: "Scheierman + Hauser", x: 96, y: 84, r: 12 },
            { label: "Queta anchor units", x: 90, y: 72, r: 11 },
            { label: "Brissett switch looks", x: 106, y: 80, r: 13 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Denver Nuggets",
        slug: "denver-nuggets",
        colors: {
          primary: "#0E2240",
          secondary: "#8B2131",
          tertiary: "#FDB927"
        },
        rotation: {
          labels: [
            "Julian Strawther",
            "Peyton Watson",
            "DaRon Holmes II",
            "Christian Braun",
            "Zeke Nnaji"
          ],
          data: [22, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 6, 8, 6, 7],
          readiness: [6, 7, 7, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [24, 11, 15, 20, 30],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [64, 69, 72, 70, 68],
          specials: [18, 24, 30, 32, 26]
        },
        synergy: {
          points: [
            { label: "Strawther + Murray reps", x: 98, y: 82, r: 13 },
            { label: "Watson + Braun wings", x: 94, y: 86, r: 12 },
            { label: "Holmes + Jokic hub", x: 90, y: 78, r: 11 },
            { label: "Nnaji bench rim", x: 96, y: 74, r: 10 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400003": {
    teams: [
      {
        name: "Minnesota Timberwolves",
        slug: "minnesota-timberwolves",
        colors: {
          primary: "#0C2340",
          secondary: "#236192",
          tertiary: "#9EA2A2"
        },
        rotation: {
          labels: [
            "Naz Reid",
            "Nickeil Alexander-Walker",
            "Josh Minott",
            "Leonard Miller",
            "Troy Brown Jr."
          ],
          data: [22, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 6, 8, 5, 7],
          readiness: [6, 7, 7, 6, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [26, 13, 12, 20, 29],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [66, 72, 75, 70, 68],
          specials: [20, 26, 32, 34, 28]
        },
        synergy: {
          points: [
            { label: "Reid + Towns stretch", x: 100, y: 80, r: 13 },
            { label: "NAW + McDaniels traps", x: 96, y: 88, r: 12 },
            { label: "Minott slashing wing", x: 98, y: 76, r: 11 },
            { label: "Miller jumbo fours", x: 92, y: 74, r: 10 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Los Angeles Lakers",
        slug: "los-angeles-lakers",
        colors: {
          primary: "#552583",
          secondary: "#FDB927",
          tertiary: "#000000"
        },
        rotation: {
          labels: [
            "Austin Reaves",
            "D'Angelo Russell",
            "Rui Hachimura",
            "Max Christie",
            "Jaxson Hayes"
          ],
          data: [20, 18, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 6, 7, 6],
          readiness: [7, 8, 7, 6, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [25, 15, 14, 20, 26],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [64, 70, 72, 68, 67],
          specials: [22, 28, 34, 32, 30]
        },
        synergy: {
          points: [
            { label: "Reaves + Davis drags", x: 94, y: 88, r: 13 },
            { label: "Russell + Rui pops", x: 98, y: 78, r: 12 },
            { label: "Christie wing stopper", x: 96, y: 82, r: 11 },
            { label: "Hayes rim pressure", x: 100, y: 74, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400004": {
    teams: [
      {
        name: "Golden State Warriors",
        slug: "golden-state-warriors",
        colors: {
          primary: "#1D428A",
          secondary: "#FFC72C",
          tertiary: "#26282A"
        },
        rotation: {
          labels: [
            "Jonathan Kuminga",
            "Moses Moody",
            "Brandin Podziemski",
            "Trayce Jackson-Davis",
            "Gui Santos"
          ],
          data: [22, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 7, 6, 6],
          readiness: [7, 8, 7, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [24, 12, 14, 26, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [70, 74, 78, 72, 71],
          specials: [18, 24, 30, 34, 28]
        },
        synergy: {
          points: [
            { label: "Kuminga downhill", x: 104, y: 82, r: 14 },
            { label: "Moody 3&D", x: 100, y: 86, r: 12 },
            { label: "Podziemski connectors", x: 96, y: 80, r: 11 },
            { label: "TJD roll game", x: 98, y: 78, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Los Angeles Clippers",
        slug: "los-angeles-clippers",
        colors: {
          primary: "#C8102E",
          secondary: "#1D428A",
          tertiary: "#000000"
        },
        rotation: {
          labels: [
            "Terance Mann",
            "Amir Coffey",
            "Kobe Brown",
            "Bones Hyland",
            "Moussa Diabate"
          ],
          data: [20, 18, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 7, 6, 6, 7],
          readiness: [7, 8, 7, 6, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [22, 14, 18, 20, 26],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [66, 70, 72, 69, 68],
          specials: [18, 24, 32, 34, 28]
        },
        synergy: {
          points: [
            { label: "Mann drive game", x: 96, y: 84, r: 13 },
            { label: "Hyland pace", x: 102, y: 78, r: 12 },
            { label: "Brown spacing", x: 94, y: 80, r: 11 },
            { label: "Diabate rim seals", x: 90, y: 76, r: 10 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400006": {
    teams: [
      {
        name: "New York Knicks",
        slug: "new-york-knicks",
        colors: {
          primary: "#006BB6",
          secondary: "#F58426",
          tertiary: "#BEC0C2"
        },
        rotation: {
          labels: [
            "Miles McBride",
            "Donte DiVincenzo",
            "Josh Hart",
            "Precious Achiuwa",
            "Jericho Sims"
          ],
          data: [22, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 8, 7, 6, 6],
          readiness: [7, 8, 7, 6, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [25, 14, 15, 18, 28],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [68, 73, 76, 72, 70],
          specials: [24, 30, 34, 36, 32]
        },
        synergy: {
          points: [
            { label: "McBride + Achiuwa traps", x: 100, y: 86, r: 13 },
            { label: "DiVincenzo motion", x: 98, y: 82, r: 12 },
            { label: "Hart connective", x: 94, y: 84, r: 11 },
            { label: "Sims rim protection", x: 90, y: 80, r: 10 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Charlotte Hornets",
        slug: "charlotte-hornets",
        colors: {
          primary: "#1D1160",
          secondary: "#00788C",
          tertiary: "#A1A1A4"
        },
        rotation: {
          labels: [
            "Brandon Miller",
            "LaMelo Ball",
            "Grant Williams",
            "Nick Smith Jr.",
            "JT Thor"
          ],
          data: [24, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 6, 8, 7],
          readiness: [7, 7, 6, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [27, 12, 13, 22, 26],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [70, 74, 75, 72, 71],
          specials: [20, 26, 32, 34, 28]
        },
        synergy: {
          points: [
            { label: "Ball + Miller creation", x: 104, y: 80, r: 14 },
            { label: "Grant Williams switches", x: 94, y: 82, r: 12 },
            { label: "Nick Smith pace", x: 102, y: 74, r: 11 },
            { label: "Thor weak-side length", x: 96, y: 78, r: 10 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400007": {
    teams: [
      {
        name: "Washington Wizards",
        slug: "washington-wizards",
        colors: {
          primary: "#002B5C",
          secondary: "#E31837",
          tertiary: "#C4CED4"
        },
        rotation: {
          labels: [
            "Bilal Coulibaly",
            "Jordan Poole",
            "Corey Kispert",
            "Deni Avdija",
            "Patrick Baldwin Jr."
          ],
          data: [22, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 8, 6, 7, 7],
          readiness: [6, 7, 6, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [26, 11, 15, 20, 28],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [70, 74, 76, 72, 70],
          specials: [22, 28, 32, 34, 30]
        },
        synergy: {
          points: [
            { label: "Coulibaly wingspan", x: 102, y: 84, r: 14 },
            { label: "Poole pace groups", x: 106, y: 74, r: 13 },
            { label: "Kispert movement", x: 98, y: 80, r: 11 },
            { label: "Avdija initiator", x: 94, y: 82, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Toronto Raptors",
        slug: "toronto-raptors",
        colors: {
          primary: "#BA0C2F",
          secondary: "#000000",
          tertiary: "#A1A1A4"
        },
        rotation: {
          labels: [
            "Scottie Barnes",
            "RJ Barrett",
            "Immanuel Quickley",
            "Gradey Dick",
            "Jakob Poeltl"
          ],
          data: [24, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 8, 7, 6],
          readiness: [7, 7, 8, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [28, 12, 14, 22, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [68, 72, 74, 70, 69],
          specials: [24, 30, 34, 36, 32]
        },
        synergy: {
          points: [
            { label: "Barnes point forward", x: 98, y: 86, r: 14 },
            { label: "Quickley pace", x: 102, y: 80, r: 12 },
            { label: "Barrett downhill", x: 100, y: 78, r: 11 },
            { label: "Poeltl hub", x: 94, y: 84, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400008": {
    teams: [
      {
        name: "Milwaukee Bucks",
        slug: "milwaukee-bucks",
        colors: {
          primary: "#00471B",
          secondary: "#EEE1C6",
          tertiary: "#0077C0"
        },
        rotation: {
          labels: [
            "MarJon Beauchamp",
            "AJ Green",
            "Andre Jackson Jr.",
            "Pat Connaughton",
            "Bobby Portis"
          ],
          data: [22, 18, 18, 16, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 8, 7, 6, 6],
          readiness: [6, 7, 8, 6, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [24, 10, 14, 24, 28],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [66, 70, 74, 70, 68],
          specials: [20, 26, 32, 34, 30]
        },
        synergy: {
          points: [
            { label: "Beauchamp pressure", x: 98, y: 84, r: 13 },
            { label: "Jackson Jr. disruption", x: 100, y: 88, r: 12 },
            { label: "Green spacing", x: 92, y: 80, r: 11 },
            { label: "Portis punch", x: 94, y: 82, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Detroit Pistons",
        slug: "detroit-pistons",
        colors: {
          primary: "#C8102E",
          secondary: "#1D428A",
          tertiary: "#00274C"
        },
        rotation: {
          labels: [
            "Jaden Ivey",
            "Ausar Thompson",
            "Marcus Sasser",
            "Jalen Duren",
            "Isaiah Stewart"
          ],
          data: [22, 20, 18, 18, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 8, 6, 7],
          readiness: [7, 7, 8, 6, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [30, 12, 14, 20, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [70, 74, 76, 72, 70],
          specials: [24, 30, 34, 36, 32]
        },
        synergy: {
          points: [
            { label: "Ivey downhill", x: 106, y: 78, r: 14 },
            { label: "Ausar havoc", x: 100, y: 86, r: 13 },
            { label: "Sasser control", x: 96, y: 80, r: 11 },
            { label: "Duren lob game", x: 104, y: 82, r: 13 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400010": {
    teams: [
      {
        name: "Orlando Magic",
        slug: "orlando-magic",
        colors: {
          primary: "#0077C0",
          secondary: "#C4CED4",
          tertiary: "#000000"
        },
        rotation: {
          labels: [
            "Paolo Banchero",
            "Franz Wagner",
            "Jalen Suggs",
            "Anthony Black",
            "Wendell Carter Jr."
          ],
          data: [22, 20, 18, 16, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 8, 7, 6],
          readiness: [7, 7, 8, 7, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [30, 12, 14, 18, 26],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [68, 72, 74, 70, 69],
          specials: [22, 28, 34, 36, 32]
        },
        synergy: {
          points: [
            { label: "Banchero hub", x: 98, y: 86, r: 14 },
            { label: "Suggs pressure", x: 102, y: 88, r: 12 },
            { label: "Wagner connector", x: 96, y: 84, r: 12 },
            { label: "Black guard length", x: 100, y: 80, r: 11 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "New Orleans Pelicans",
        slug: "new-orleans-pelicans",
        colors: {
          primary: "#0C2340",
          secondary: "#85714D",
          tertiary: "#C8102E"
        },
        rotation: {
          labels: [
            "Zion Williamson",
            "Brandon Ingram",
            "Trey Murphy III",
            "Dyson Daniels",
            "Larry Nance Jr."
          ],
          data: [20, 20, 18, 18, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [9, 7, 7, 7, 6],
          readiness: [8, 7, 7, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [34, 14, 16, 18, 18],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [66, 70, 72, 68, 67],
          specials: [24, 28, 32, 34, 30]
        },
        synergy: {
          points: [
            { label: "Zion downhill", x: 108, y: 76, r: 15 },
            { label: "Ingram midrange", x: 96, y: 84, r: 12 },
            { label: "Murphy spacers", x: 98, y: 80, r: 11 },
            { label: "Daniels defense", x: 94, y: 88, r: 13 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400012": {
    teams: [
      {
        name: "Memphis Grizzlies",
        slug: "memphis-grizzlies",
        colors: {
          primary: "#5D76A9",
          secondary: "#12173F",
          tertiary: "#F5B112"
        },
        rotation: {
          labels: [
            "Desmond Bane",
            "Ziaire Williams",
            "GG Jackson",
            "Santi Aldama",
            "Brandon Clarke"
          ],
          data: [20, 18, 18, 18, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 7, 6, 7],
          readiness: [7, 7, 8, 6, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [28, 13, 15, 20, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [70, 74, 76, 72, 70],
          specials: [20, 26, 32, 34, 30]
        },
        synergy: {
          points: [
            { label: "Bane off-ball", x: 98, y: 84, r: 13 },
            { label: "GG Jackson usage", x: 102, y: 76, r: 12 },
            { label: "Aldama stretch", x: 96, y: 80, r: 11 },
            { label: "Clarke rim runs", x: 104, y: 82, r: 13 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Dallas Mavericks",
        slug: "dallas-mavericks",
        colors: {
          primary: "#00538C",
          secondary: "#002B5E",
          tertiary: "#B8C4CA"
        },
        rotation: {
          labels: [
            "Luka Dončić",
            "Kyrie Irving",
            "Josh Green",
            "Dereck Lively II",
            "Olivier-Maxence Prosper"
          ],
          data: [18, 18, 18, 16, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [9, 7, 6, 9, 7],
          readiness: [8, 7, 6, 8, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [26, 12, 18, 22, 22],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [64, 70, 72, 68, 66],
          specials: [24, 28, 34, 32, 30]
        },
        synergy: {
          points: [
            { label: "Dončić orchestrator", x: 90, y: 88, r: 15 },
            { label: "Irving pace", x: 96, y: 82, r: 13 },
            { label: "Green defensive wing", x: 98, y: 84, r: 11 },
            { label: "Lively rim roll", x: 100, y: 78, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400013": {
    teams: [
      {
        name: "Oklahoma City Thunder",
        slug: "oklahoma-city-thunder",
        colors: {
          primary: "#007AC1",
          secondary: "#EF3B24",
          tertiary: "#002D62"
        },
        rotation: {
          labels: [
            "Shai Gilgeous-Alexander",
            "Jalen Williams",
            "Chet Holmgren",
            "Josh Giddey",
            "Cason Wallace"
          ],
          data: [18, 20, 18, 18, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [9, 7, 8, 8, 7],
          readiness: [8, 7, 8, 8, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [32, 12, 12, 20, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [72, 76, 78, 74, 72],
          specials: [22, 28, 32, 36, 30]
        },
        synergy: {
          points: [
            { label: "SGA isolation", x: 100, y: 90, r: 15 },
            { label: "J-Dub secondary", x: 102, y: 84, r: 13 },
            { label: "Holmgren rim protect", x: 96, y: 92, r: 14 },
            { label: "Wallace pressure", x: 104, y: 82, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "San Antonio Spurs",
        slug: "san-antonio-spurs",
        colors: {
          primary: "#000000",
          secondary: "#C4CED4",
          tertiary: "#8D9093"
        },
        rotation: {
          labels: [
            "Victor Wembanyama",
            "Devin Vassell",
            "Jeremy Sochan",
            "Tre Jones",
            "Malaki Branham"
          ],
          data: [20, 20, 18, 16, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [8, 7, 9, 7, 6],
          readiness: [8, 7, 8, 7, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [30, 14, 18, 18, 20],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [66, 70, 72, 68, 67],
          specials: [20, 26, 32, 34, 30]
        },
        synergy: {
          points: [
            { label: "Wemby rim deterrence", x: 92, y: 96, r: 15 },
            { label: "Vassell spacing", x: 100, y: 84, r: 12 },
            { label: "Sochan playmaking", x: 96, y: 82, r: 11 },
            { label: "Jones tempo", x: 102, y: 80, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400016": {
    teams: [
      {
        name: "Chicago Bulls",
        slug: "chicago-bulls",
        colors: {
          primary: "#CE1141",
          secondary: "#000000",
          tertiary: "#747474"
        },
        rotation: {
          labels: [
            "Coby White",
            "Ayo Dosunmu",
            "Patrick Williams",
            "Julian Phillips",
            "Dalen Terry"
          ],
          data: [22, 20, 18, 16, 14]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [7, 7, 7, 6, 7],
          readiness: [7, 7, 8, 6, 6]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [24, 12, 16, 22, 26],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [66, 70, 72, 68, 67],
          specials: [20, 26, 30, 32, 28]
        },
        synergy: {
          points: [
            { label: "White pace", x: 100, y: 82, r: 13 },
            { label: "Williams spacing", x: 96, y: 84, r: 12 },
            { label: "Dosunmu on-ball", x: 98, y: 78, r: 11 },
            { label: "Phillips length", x: 94, y: 80, r: 10 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Cleveland Cavaliers",
        slug: "cleveland-cavaliers",
        colors: {
          primary: "#860038",
          secondary: "#041E42",
          tertiary: "#FDBB30"
        },
        rotation: {
          labels: [
            "Donovan Mitchell",
            "Darius Garland",
            "Caris LeVert",
            "Evan Mobley",
            "Georges Niang"
          ],
          data: [20, 18, 18, 20, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [9, 8, 7, 8, 7],
          readiness: [8, 8, 7, 8, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [26, 14, 16, 20, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [68, 72, 74, 70, 69],
          specials: [22, 28, 34, 36, 30]
        },
        synergy: {
          points: [
            { label: "Mitchell downhill", x: 102, y: 84, r: 14 },
            { label: "Garland orchestration", x: 96, y: 88, r: 13 },
            { label: "Mobley rim shield", x: 90, y: 94, r: 14 },
            { label: "Niang spacing", x: 94, y: 82, r: 11 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  },
  "preseason-12400018": {
    teams: [
      {
        name: "Indiana Pacers",
        slug: "indiana-pacers",
        colors: {
          primary: "#002D62",
          secondary: "#FDBB30",
          tertiary: "#BEC0C2"
        },
        rotation: {
          labels: [
            "Tyrese Haliburton",
            "Bennedict Mathurin",
            "Andrew Nembhard",
            "Obi Toppin",
            "Jarace Walker"
          ],
          data: [20, 20, 18, 18, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [9, 8, 7, 9, 8],
          readiness: [8, 8, 7, 8, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [28, 12, 12, 24, 24],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [72, 76, 78, 74, 72],
          specials: [24, 30, 36, 38, 34]
        },
        synergy: {
          points: [
            { label: "Haliburton orchestration", x: 98, y: 90, r: 14 },
            { label: "Mathurin scoring", x: 104, y: 82, r: 13 },
            { label: "Nembhard control", x: 96, y: 84, r: 11 },
            { label: "Toppin rim pressure", x: 108, y: 78, r: 12 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      },
      {
        name: "Atlanta Hawks",
        slug: "atlanta-hawks",
        colors: {
          primary: "#E03A3E",
          secondary: "#C1D32F",
          tertiary: "#26282A"
        },
        rotation: {
          labels: [
            "Trae Young",
            "Dejounte Murray",
            "Jalen Johnson",
            "Bogdan Bogdanovic",
            "Onyeka Okongwu"
          ],
          data: [20, 20, 18, 18, 16]
        },
        skill: {
          labels: [
            "Advantage creation",
            "Spacing gravity",
            "Defensive disruption",
            "Playmaking vision",
            "Tempo pressure"
          ],
          training: [9, 7, 6, 9, 8],
          readiness: [8, 7, 6, 8, 7]
        },
        shotProfile: {
          labels: [
            "Rim attacks",
            "Paint floaters",
            "Mid-post isolations",
            "Corner threes",
            "Above-the-break threes"
          ],
          team: [24, 14, 14, 26, 22],
          league: [24, 14, 16, 18, 28]
        },
        tempo: {
          labels: [
            "Arrival day",
            "Closed scrimmage",
            "Open scrimmage",
            "Special situations",
            "Shootaround"
          ],
          tempo: [70, 74, 76, 72, 70],
          specials: [22, 28, 32, 34, 30]
        },
        synergy: {
          points: [
            { label: "Young + Murray dual", x: 102, y: 84, r: 14 },
            { label: "Johnson slashing", x: 104, y: 80, r: 12 },
            { label: "Bogdanovic spacing", x: 98, y: 78, r: 11 },
            { label: "Okongwu rim deterrence", x: 96, y: 86, r: 13 }
          ],
          xLabel: "Tempo index (possessions per 48)",
          yLabel: "Coverage sync score"
        }
      }
    ]
  }
};
