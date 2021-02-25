/* eslint-env jquery */
/* global math */
/* global SVG */
/* global data */
/* global _ */

"use strict";

function segmentIntersects(x1, x2, y1, y2) {
  return x1 < y2 && y1 < x2;
}

class Rectangle {
  constructor({ left, top, right, bottom }) {
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
  }
  get x() {
    return this.left;
  }
  get y() {
    return this.top;
  }
  get width() {
    return this.right - this.left;
  }
  get height() {
    return this.bottom - this.top;
  }
  get area() {
    return this.width * this.height;
  }
  moveTo(point) {
    const w = this.width;
    const h = this.height;
    this.left = point.x;
    this.top = point.y;
    this.right = point.x + w;
    this.bottom = point.y + h;
  }
  intersects(other, axis) {
    if (axis === "x") {
      return segmentIntersects(this.left, this.right, other.left, other.right);
    } else if (axis === "y") {
      return segmentIntersects(this.top, this.bottom, other.top, other.bottom);
    } else {
      return this.intersects(other, "x") && this.intersects(other, "y");
    }
  }
  overlaps(other) {
    return (
      this.left < other.right &&
      this.right > other.left &&
      this.top < other.bottom &&
      this.bottom > other.top
    );
  }
  toSize(toRound = false) {
    let w = math.multiply(this.width, RESOLUTION).to("feet");
    let h = math.multiply(this.height, RESOLUTION).to("inch");
    if (toRound) {
      w = math.unit(Math.floor(w.toNumber()), "feet");
      // h = math.unit(Math.round(h.toNumber()), "inch");
    }
    return { width: w, height: h };
  }
  toStr() {
    return `${this.left} ${this.top} ${this.right} ${this.bottom}`;
  }
}

class DefectLimits {
  constructor({
    defectType,
    aggregation,
    sizeType,
    getDefectValue,
    getLimit,
    description,
  }) {
    const AGG_FUNCS = {
      sum: (defects) => {
        return defects.map((d) => d.size).reduce((acc, d) => acc + d, 0);
      },
      max: (defects) => {
        return defects
          .map((d) => d.size)
          .reduce((acc, d) => Math.max(acc, d), 0);
      },
      "max-sum-edge": (defects, board) => {
        // aggregates defects based on their location — top and bottom edge
        const d = {
          top: defects.filter((d) => d.rect.top == board.top),
          bot: defects.filter((d) => d.rect.bottom == board.bottom),
        };
        return Math.max(AGG_FUNCS.sum(d.top), AGG_FUNCS.sum(d.bot));
      },
      "sum-max-edge": (defects, board) => {
        // aggregates defects based on their location — top and bottom edge
        const d = {
          top: defects.filter((d) => d.rect.top == board.top),
          bot: defects.filter((d) => d.rect.bottom == board.bottom),
        };
        return AGG_FUNCS.max(d.top) + AGG_FUNCS.max(d.bot);
      },
      "sum-edge": (defects, board) => {
        return AGG_FUNCS.sum(
          defects.filter(
            (d) => d.rect.top == board.top || d.rect.bottom == board.bottom
          )
        );
      },
    };
    const SIZE_FUNCS = {
      length: (r) => r.width,
      width: (r) => r.height,
      diameter: (r) => (r.width + r.height) / 2,
    };
    this.defectType = defectType;
    this.aggFunc = AGG_FUNCS[aggregation];
    this.getSize = SIZE_FUNCS[sizeType];
    this.getDefectValue = getDefectValue;
    this.getLimit = getLimit;
    this.description = description;
  }
  areWithinLimits(defects, board, returnInfo = false) {
    const defectValue = this.getDefectValue(
      this.aggFunc(
        defects
          .filter((d) => d.type === this.defectType)
          .map((d) => {
            let s = { size: this.getSize(d.rect) };
            return { ...s, ...d };
          }),
        board
      )
    );
    const limit = this.getLimit(board);
    if (!returnInfo) {
      return defectValue <= limt;
    } else {
      return [
        defectValue <= limit,
        {
          description: this.description,
          defectType: this.defectType,
          defectValue: defectValue,
          limit: limit,
        },
      ];
    }
  }
}

const RESOLUTION = math.unit(0.0625, "inch");
const DEFAULT_CUT = { left: 5, top: 5, right: 100, bottom: 30 };
const COLORS = {
  board: "rgb(222, 184, 135)",
  defect: "rgb(45, 32, 27)",
  cut: "rgb(130, 173, 215)",
  // selected: "rgb(7, 57, 12)",
  selected: "#07397e",
  collision: "#dc5856",
  // particular defects
  STAIN: "#156064",
  CHECKS: "#247ba0",
  SOUND_KNOT: "#5c3307",
  UNSOUND_KNOT: "#4a2702",
  WANE: "#716348",
  SPLIT_OR_SHAKE: "#e7d8c9",
  PITH: "#320310",
  HOLE: "#151b2e",
  DECAY: "#5e5a57",
  BARK_POCKET: "#1a1108",
  VOID: "#143642",
};

const SHORT_TO_LONG_GRADE = {
  FAS: "FAS",
  F1F: "F1F",
  SEL: "SEL",
  "1C": "#1 COM",
  "2AC": "#2A COM",
  "3AC": "#3A COM",
};

const GRADES = {
  FAS: {
    minBoardSize: {
      height: math.unit(6, "inch"),
      width: math.unit(8, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(4, "inch"),
        width: math.unit(5, "feet"),
      },
      {
        height: math.unit(3, "inch"),
        width: math.unit(7, "feet"),
      },
    ],
    yieldFactor: 10,
    yieldFactorExtra: 11,
    getNumCuts: (sm) => Math.min(Math.max(Math.floor(sm / 4.0), 1), 4),
    allowsExtraCut: (sm) => 6 <= sm && sm <= 15,
    defectLimits: [
      new DefectLimits({
        defectType: "SOUND_KNOT",
        aggregation: "max",
        sizeType: "diameter",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => getSM(board) / 3,
        description:
          "the average diameter of any sound knot (in inches) should be less than one-third of the surface measure",
      }),
      new DefectLimits({
        defectType: "UNSOUND_KNOT",
        aggregation: "max",
        sizeType: "diameter",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => getSM(board) / 3,
        description:
          "the average diameter of any unsound knot (in inches) should be less than one-third of the surface measure",
      }),
      new DefectLimits({
        defectType: "PITH",
        aggregation: "sum",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => getSM(board),
        description:
          "pith in the aggregate in length (in inches) should not exceed the surface measure",
      }),
      new DefectLimits({
        defectType: "WANE",
        aggregation: "max-sum-edge",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => board.toSize(true).width.to("inch").toNumber() / 2,
        description:
          "wane on either edge should not exceed over one-half of the length in the aggregate",
      }),
      new DefectLimits({
        defectType: "SPLIT_OR_SHAKE",
        aggregation: "sum",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => math.max(2 * getSM(board), 12),
        description:
          "split should not exceed in the aggregate in length (in inches) twice the surface measure",
      }),
    ],
  },
  FAS_SEL: {
    minBoardSize: {
      height: math.unit(4, "inch"),
      width: math.unit(6, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(4, "inch"),
        width: math.unit(5, "feet"),
      },
      {
        height: math.unit(3, "inch"),
        width: math.unit(7, "feet"),
      },
    ],
    yieldFactor: 10,
    yieldFactorExtra: 11,
    getNumCuts: (sm) => Math.min(Math.max(Math.floor(sm / 4.0), 1), 4),
    allowsExtraCut: (sm) => 6 <= sm && sm <= 15,
    defectLimits: [
      new DefectLimits({
        defectType: "SOUND_KNOT",
        aggregation: "max",
        sizeType: "diameter",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => getSM(board) / 3,
        description:
          "the average diameter of any sound knot (in inches) should be less than one-third of the surface measure",
      }),
      new DefectLimits({
        defectType: "UNSOUND_KNOT",
        aggregation: "max",
        sizeType: "diameter",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => getSM(board) / 3,
        description:
          "the average diameter of any unsound knot (in inches) should be less than one-third of the surface measure",
      }),
      new DefectLimits({
        defectType: "PITH",
        aggregation: "sum",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => getSM(board),
        description:
          "pith in the aggregate in length (in inches) should not exceed the surface measure",
      }),
      new DefectLimits({
        defectType: "WANE",
        aggregation: "max-sum-edge",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => board.toSize(true).width.to("inch").toNumber() / 2,
        description:
          "wane on either edge should not exceed over one-half of the length in the aggregate",
      }),
      new DefectLimits({
        defectType: "SPLIT_OR_SHAKE",
        aggregation: "sum",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => math.max(2 * getSM(board), 12),
        description:
          "split should not exceed in the aggregate in length (in inches) twice the surface measure",
      }),
    ],
  },
  No1COM_F1F: {
    minBoardSize: {
      height: math.unit(3, "inch"),
      width: math.unit(4, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(4, "inch"),
        width: math.unit(2, "feet"),
      },
      {
        height: math.unit(3, "inch"),
        width: math.unit(3, "feet"),
      },
    ],
    yieldFactor: 8,
    yieldFactorExtra: 9,
    getNumCuts: (sm) => Math.min(Math.max(Math.floor((sm + 1) / 3.0), 1), 5),
    allowsExtraCut: (sm) => 3 <= sm && sm <= 10,
    defectLimits: [
      new DefectLimits({
        defectType: "WANE",
        aggregation: "max-sum-edge",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => board.toSize(true).width.to("inch").toNumber() / 2,
        description:
          "wane on either edge should not exceed over one-half of the length in the aggregate",
      }),
      new DefectLimits({
        defectType: "WANE",
        aggregation: "sum-max-edge",
        sizeType: "width",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) =>
          board.toSize(true).height.to("inch").toNumber() / 3,
        description:
          "the width of the wane from both edges, when added together, cannot exceed one-third of the total width",
      }),
    ],
  },
  No1COM_SEL: {
    minBoardSize: {
      height: math.unit(3, "inch"),
      width: math.unit(4, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(4, "inch"),
        width: math.unit(2, "feet"),
      },
      {
        height: math.unit(3, "inch"),
        width: math.unit(3, "feet"),
      },
    ],
    yieldFactor: 8,
    yieldFactorExtra: 9,
    getNumCuts: (sm) => Math.min(Math.max(Math.floor((sm + 1) / 3.0), 1), 5),
    allowsExtraCut: (sm) => 3 <= sm && sm <= 10,
    defectLimits: [
      new DefectLimits({
        defectType: "WANE",
        aggregation: "sum-max-edge",
        sizeType: "width",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) =>
          board.toSize(true).height.to("inch").toNumber() / 3,
        description:
          "the width of the wane from both edges, when added together, cannot exceed one-third of the total width",
      }),
      new (class {
        areWithinLimits(defects, board, returnInfo = false) {
          let dl;
          if (6 <= board.toSize(true).height.to("inch").toNumber()) {
            dl = new DefectLimits({
              defectType: "WANE",
              aggregation: "max-sum-edge",
              sizeType: "length",
              getDefectValue: (value) =>
                math.multiply(value, RESOLUTION).to("inch").toNumber(),
              getLimit: (board) =>
                board.toSize(true).width.to("inch").toNumber() / 2,
              description:
                'in pieces 6" or wider, the total length of wane on either edge cannot exceed one-half of the length',
            });
          } else {
            dl = new DefectLimits({
              defectType: "WANE",
              aggregation: "sum-edge",
              sizeType: "length",
              getDefectValue: (value) =>
                math.multiply(value, RESOLUTION).to("inch").toNumber(),
              getLimit: (board) =>
                board.toSize(true).width.to("inch").toNumber() / 2,
              description:
                'in pieces 4" or 5" wide, the total length of wane, when added together, cannot exceed one-half of the length',
            });
          }
          return dl.areWithinLimits(defects, board, returnInfo);
        }
      })(),
    ],
  },
  No1COM: {
    minBoardSize: {
      height: math.unit(3, "inch"),
      width: math.unit(4, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(4, "inch"),
        width: math.unit(2, "feet"),
      },
      {
        height: math.unit(3, "inch"),
        width: math.unit(3, "feet"),
      },
    ],
    yieldFactor: 8,
    yieldFactorExtra: 9,
    getNumCuts: (sm) => Math.min(Math.max(Math.floor((sm + 1) / 3.0), 1), 5),
    allowsExtraCut: (sm) => 3 <= sm && sm <= 10,
    defectLimits: [
      new DefectLimits({
        defectType: "PITH",
        aggregation: "sum",
        sizeType: "length",
        getDefectValue: (value) =>
          math.multiply(value, RESOLUTION).to("inch").toNumber(),
        getLimit: (board) => board.toSize(true).width.to("inch").toNumber() / 2,
        description:
          "pith in the aggregate in length should not exceed one-half of the length of the board",
      }),
    ],
  },
  No2ACOM: {
    minBoardSize: {
      height: math.unit(3, "inch"),
      width: math.unit(4, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(3, "inch"),
        width: math.unit(2, "feet"),
      },
    ],
    yieldFactor: 6,
    yieldFactorExtra: 8,
    getNumCuts: (sm) => Math.min(Math.max(Math.floor(sm / 2.0), 1), 7),
    allowsExtraCut: (sm) => 2 <= sm && 7 <= sm,
    defectLimits: [],
  },
  No3ACOM: {
    minBoardSize: {
      height: math.unit(3, "inch"),
      width: math.unit(4, "feet"),
    },
    minCutSizes: [
      {
        height: math.unit(3, "inch"),
        width: math.unit(2, "feet"),
      },
    ],
    yieldFactor: 4,
    yieldFactorExtra: null,
    getNumCuts: () => Infinity,
    allowsExtraCut: () => false,
    defectLimits: [],
  },
};

const CANVAS = SVG().addTo("#svg-canvas");
const DATA = data;

function populateBoardNamesSelect(boardNames) {
  const select = $("select#board-name");
  boardNames.forEach((boardName) => {
    select.append($("<option />").val(boardName).text(boardName));
  });
}

class State {
  constructor(boardName, boardSide, grade) {
    this.boardName = boardName;
    this.boardSide = boardSide;
    this.grade = grade;
    this.cuts = [];
    this.selectedCutIndex = null;
    this.offset = { x: 0, y: 0 };
    this.actionType = null;
    this.K = 1.5; // inverse scaling factor; display board smaller to fit in screen
    this.startTime = Date.now();
  }
  get board() {
    return new Rectangle(DATA[this.boardId].board);
  }
  get defects() {
    return DATA[this.boardId].defects[this.boardSide].map((d) => {
      return { rect: new Rectangle(d.rect), type: d.type };
    });
  }
  get trueGrade() {
    return DATA[this.boardId].grade;
  }
  get predGrade() {
    return DATA[this.boardId].pred;
  }
  get boardId() {
    return DATA.findIndex((datum) => datum.name === this.boardName);
  }
  get selectedCut() {
    return this.cuts[this.selectedCutIndex];
  }
  resetCuts() {
    this.cuts = [];
    this.selectedCutIndex = null;
  }
  getOtherRects() {
    const i = this.selectedCutIndex;
    const rects = [
      ..._.pluck(this.defects, "rect"),
      ...this.cuts.slice(0, i),
      ...this.cuts.slice(i + 1),
    ];
    return _.compact(rects);
  }
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function getCuttingUnits(cut) {
  const size = cut.toSize();
  return size.height.to("inch").toNumber() * size.width.to("feet").toNumber();
}

function getSM(board) {
  const s = board.toSize(true);
  return Math.round((s.width.toNumber() * s.height.toNumber()) / 12);
}

function smallerEqRect(r1, r2) {
  return (
    math.smallerEq(r1.height, r2.height) && math.smallerEq(r1.width, r2.width)
  );
}

function hasMinSizeCut(cut) {
  const cutSize = cut.toSize();
  return GRADES[state.grade].minCutSizes.some((minCutSize) =>
    smallerEqRect(minCutSize, cutSize)
  );
}

function snapTo(x, vals, tol = 5) {
  return vals.find((v) => Math.abs(x - v) <= tol) || x;
}

function sizeToRect(size) {
  const right = math.divide(size.width.to("inch"), RESOLUTION);
  const bottom = math.divide(size.height.to("inch"), RESOLUTION);
  return new Rectangle({ left: 0, top: 0, right: right, bottom: bottom });
}

function sizeToStr(size, precision = 0) {
  const p = { notation: "fixed", precision: precision };
  const heightStr = size.height.format(p);
  const widthStr = size.width.format(p);
  return `${heightStr} × ${widthStr}`;
}

function getTotalCuttingUnits(cuts) {
  return _.compact(cuts)
    .map(getCuttingUnits)
    .reduce((a, b) => a + b, 0);
}

function getMousePosition(event) {
  const CTM = CANVAS.node.getScreenCTM();
  return {
    x: (state.K * (event.clientX - CTM.e)) / CTM.a,
    y: (state.K * (event.clientY - CTM.f)) / CTM.d,
  };
}

function isNearBorder(rect, coord, border) {
  const δ = 5;
  if (border === "left") {
    let l = rect.left;
    let x = coord.x;
    return l <= x && x < l + δ;
  } else if (border === "right") {
    let r = rect.right;
    let x = coord.x;
    return r - δ < x && x <= r;
  } else if (border === "top") {
    let t = rect.top;
    let y = coord.y;
    return t <= y && y < t + δ;
  } else if (border === "bottom") {
    let b = rect.bottom;
    let y = coord.y;
    return b - δ < y && y <= b;
  } else {
    return false;
  }
}

function constrainInBoard(board, cut, corner) {
  return {
    x: clamp(corner.x, 0, board.width - cut.width),
    y: clamp(corner.y, 0, board.height - cut.height),
  };
}

class Renderer {
  constructor() {
    this.boardShape = null;
    this.defectShapes = [];
    this.cutShapes = [];
    this.renderTimer();
  }

  renderAll(state) {
    this.renderPanelBoard(state);
    this.renderPanelGrade(state);
    this.renderBoard(state);
    this.renderCuts(state);
  }

  drawRectShape(rect, shape = undefined) {
    const x = rect.left / state.K;
    const y = rect.top / state.K;
    const w = rect.width / state.K;
    const h = rect.height / state.K;
    if (shape === undefined) {
      // create new shape
      shape = CANVAS.rect({ x: x, y: y, width: w, height: h });
    } else {
      // update given shape
      shape.attr({ x: x, y: y, width: w, height: h });
    }
    return shape;
  }

  clearCuts() {
    $("table#cuts tbody tr").remove();
    $("#total-cutting-units").text("0");
    for (const cutShape of this.cutShapes) {
      if (cutShape !== undefined) {
        cutShape.remove();
      }
    }
    this.cutShapes = [];
  }

  renderTimer() {
    setInterval(function () {
      const diff = (Date.now() - state.startTime) / 1000;

      let minutes = (diff / 60) | 0;
      let seconds = diff % 60 | 0;

      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;

      $("#timer").text(minutes + ":" + seconds);
    }, 1000);
  }

  renderBoard(state) {
    CANVAS.clear();
    CANVAS.size(
      state.board.right / state.K + 10,
      state.board.bottom / state.K + 10
    );

    this.boardShape = this.drawRectShape(state.board);
    this.boardShape.attr({ fill: COLORS.board });
    CANVAS.add(this.boardShape);

    for (const defect of state.defects) {
      // const defectShape = CANVAS.rect();
      const defectShape = this.drawRectShape(defect.rect);
      const defectSizeStr = sizeToStr(defect.rect.toSize(), 1);
      defectShape.attr({
        fill: COLORS[defect.type],
        "data-toggle": "tooltip",
        title: `${defect.type} ${defectSizeStr}`,
      });
      this.defectShapes.push(defectShape);
    }
    $('[data-toggle="tooltip"]').tooltip();
  }

  renderCuts(state) {
    this.clearCuts();
    for (let i = 0; i < state.cuts.length; i++) {
      if (state.cuts[i] !== undefined) {
        this.renderCut(state, i);
      }
    }
    this.renderTotalCuttingUnits(state);
  }

  renderTotalCuttingUnits(state) {
    $("#total-cutting-units").text(getTotalCuttingUnits(state.cuts).toFixed(2));
  }

  renderCut(state, i, color = COLORS.cut) {
    // draw cut
    const cut = state.cuts[i];
    this.cutShapes[i] = this.drawRectShape(cut, this.cutShapes[i]);
    this.cutShapes[i].attr({
      fill: color,
      stroke: "#444444",
      "stroke-width": 0.5,
      index: i,
      type: "cut",
    });

    // update table
    const ww = math.multiply(cut.height, RESOLUTION).to("inch").toNumber();
    const ll = math.multiply(cut.width, RESOLUTION).to("feet").toNumber();
    const aa = ww * ll;

    const nrRows = $("table#cuts tr").length - 1;
    const innerHTML =
      `<td>${i}</td>` +
      `<td>${cut.x.toFixed(0)}, ${cut.y.toFixed(0)}, ` +
      `${cut.width.toFixed(0)}, ${cut.height.toFixed(0)}</td>` +
      `<td>${ww.toFixed(2)}</td>` +
      `<td>${ll.toFixed(2)}</td>` +
      `<td>${aa.toFixed(2)}</td>` +
      '<td><button class="btn"><i class="fas fa-trash" id="delete-cut"></i></button></td>';

    let row;

    if (nrRows < this.cutShapes.filter((s) => s !== undefined).length) {
      row = $("table#cuts tbody")[0].insertRow();
      row.dataset.id = i;
      row.innerHTML = innerHTML;
    } else {
      row = $(`table#cuts tbody tr[data-id=${i}]`)[0];
      row.innerHTML = innerHTML;
    }

    if (hasMinSizeCut(cut)) {
      row.className = "";
    } else {
      row.className = "table-warning";
    }
  }

  renderPanelBoard(state) {
    const boardSize = state.board.toSize();
    $("#board-size").text(sizeToStr(boardSize, 2));
    $("#true-grade").text(SHORT_TO_LONG_GRADE[state.trueGrade]);
    $("#pred-grade").text(SHORT_TO_LONG_GRADE[state.predGrade]);
    $("#sm").text(getSM(state.board));
  }

  renderPanelGrade(state) {
    // min board size
    const minBoardSize = GRADES[state.grade].minBoardSize;
    // adjust for kiln-dried boards
    const minBoardSizeAdjusted = {
      height: math.subtract(minBoardSize.height, math.unit(0.25, "inch")),
      width: minBoardSize.width,
    };
    const hasMinSize = smallerEqRect(
      minBoardSizeAdjusted,
      state.board.toSize()
    );
    $("#min-board-size").text(sizeToStr(minBoardSize));
    {
      const textColor = hasMinSize ? "text-success" : "text-danger";
      const checkmark = hasMinSize ? "fa-check-circle" : "fa-circle";
      $("#min-board-size-label").attr("class", textColor);
      $("#min-board-size-check i").attr("class", "far " + checkmark);
    }

    const cuts = _.compact(state.cuts);

    // min cut size
    const hasMinCutSize = cuts.length && cuts.every(hasMinSizeCut);
    $("#min-cut-sizes").text(
      GRADES[state.grade].minCutSizes
        .map((size) => sizeToStr(size))
        .join(" or ")
    );
    {
      const textColor = hasMinCutSize ? "text-success" : "text-danger";
      const checkmark = hasMinCutSize ? "fa-check-circle" : "fa-circle";
      $("#min-cut-sizes-label").attr("class", textColor);
      $("#min-cut-sizes-check i").attr("class", "far " + checkmark);
    }

    // requred cutting units
    const sm = getSM(state.board);
    const reqCuttingUnits = sm * GRADES[state.grade].yieldFactor;
    const numCuts = GRADES[state.grade].getNumCuts(sm);
    const allowsExtraCut = GRADES[state.grade].allowsExtraCut(sm);
    const suffix = numCuts > 1 ? "s" : "";
    let reqCuttingUnitsExtra = Infinity;
    let text = `${reqCuttingUnits} in ${numCuts} cut${suffix}`;
    if (allowsExtraCut) {
      reqCuttingUnitsExtra = sm * GRADES[state.grade].yieldFactorExtra;
      text = text + ` or ${reqCuttingUnitsExtra} in ${numCuts + 1} cuts`;
    }
    $("#required-cutting-units").text(text);
    const totalCuttingUnits = getTotalCuttingUnits(state.cuts);
    const hasReqCuttingUnits =
      (cuts.length <= numCuts && reqCuttingUnits <= totalCuttingUnits) ||
      (allowsExtraCut &&
        cuts.length <= numCuts + 1 &&
        reqCuttingUnitsExtra <= totalCuttingUnits);
    {
      const textColor = hasReqCuttingUnits ? "text-success" : "text-danger";
      const checkmark = hasReqCuttingUnits ? "fa-check-circle" : "fa-circle";
      $("#required-cutting-units-label").attr("class", textColor);
      $("#required-cutting-units-check i").attr("class", "far " + checkmark);
    }

    // defect limits
    const defectLimitsResults = GRADES[state.grade].defectLimits.map((d) =>
      d.areWithinLimits(state.defects, state.board, true)
    );
    const hasDefectLimits = defectLimitsResults.every((r) => r[0]);

    let row;
    $("table#defects tbody tr").remove();
    for (const dlr of defectLimitsResults) {
      const checkmark = dlr[0] ? "fa-check-circle" : "fa-circle";
      const innerHTML =
        `<td>${dlr[1].defectType}</td>` +
        `<td class="text-muted"><small>${dlr[1].description}</small></td>` +
        `<td>${dlr[1].defectValue.toFixed(2)}</td>` +
        `<td>${dlr[1].limit.toFixed(2)}</td>` +
        `<td class="text-right"><i class="far ${checkmark}"></i></td>`;
      row = $("table#defects tbody")[0].insertRow();
      row.innerHTML = innerHTML;
    }

    {
      const textColor = hasDefectLimits ? "text-success" : "text-danger";
      const checkmark = hasDefectLimits ? "fa-check-circle" : "fa-circle";
      $("#defect-limits-label").attr("class", textColor);
      $("#defect-limits-check i").attr("class", "far " + checkmark);
    }

    // overall grade
    {
      const hasGrade =
        hasMinSize && hasMinCutSize && hasReqCuttingUnits && hasDefectLimits;
      const textColor = hasGrade ? "text-success" : "text-danger";
      const checkmark = hasGrade ? "fa-check-circle" : "fa-circle";
      $("#grade-label").attr("class", "my-1 mr-2 " + textColor);
      $("#grade-check i").attr("class", "far " + checkmark);
    }
  }
}

const boardNames = DATA.map((datum) => datum.name).sort();
populateBoardNamesSelect(boardNames);

const boardName = $("select#board-name")[0].value;
const boardSide = $("select#side")[0].value;
const grade = $("select#grade")[0].value;
const state = new State(boardName, boardSide, grade);

const renderer = new Renderer();
renderer.renderAll(state);

// Events
$("select#board-name").on("change", (event) => {
  state.boardName = event.target.value;
  state.resetCuts();
  renderer.renderAll(state);
  state.startTime = Date.now();
});

$("select#side").on("change", (event) => {
  state.boardSide = event.target.value;
  state.resetCuts();
  renderer.renderAll(state);
});

$("select#grade").on("change", (event) => {
  state.grade = event.target.value;
  renderer.renderPanelGrade(state);
});

new Clipboard("#copy-cuts", {
  text: function (trigger) {
    return state.cuts.map((cut) => cut.toStr()).join("; ");
  },
});

$("#load-cuts").on("click", () => {
  let gradesAndCuts = DATA[state.boardId].cuts[state.boardSide];
  let gc = _.find(gradesAndCuts, ([g]) => g === state.grade.split("_")[0]);
  if (gc === undefined) {
    gc = _.last(gradesAndCuts);
  }
  state.cuts = gc[1].map((cut) => new Rectangle(cut));

  renderer.renderCuts(state);
  renderer.renderPanelGrade(state);
});

// https://stackoverflow.com/a/43053803/474311
const product = (...a) =>
  a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));

function getCandidates() {
  const obstacles = [
    ..._.pluck(state.defects, "rect"),
    ..._.compact(state.cuts),
  ];
  const overlapsObstacles = (r) => obstacles.some((o) => r.overlaps(o));
  const limL = [...obstacles.map((r) => r.right), state.board.left];
  const limR = [...obstacles.map((r) => r.left), state.board.right];
  const limT = [...obstacles.map((r) => r.bottom), state.board.top];
  const limB = [...obstacles.map((r) => r.top), state.board.bottom];
  return product(limL, limR, limT, limB)
    .filter((t) => t[0] < t[1] && t[2] < t[3])
    .map(
      (t) => new Rectangle({ left: t[0], right: t[1], top: t[2], bottom: t[3] })
    )
    .filter((r) => !overlapsObstacles(r));
}

$("#add-cut").on("click", () => {
  const candidates = getCandidates();
  if (candidates.length > 0) {
    const maxCandidate = _.max(candidates, (r) => r.area);
    state.cuts.push(maxCandidate);
    renderer.renderCut(state, state.cuts.length - 1);
    renderer.renderPanelGrade(state);
    renderer.renderTotalCuttingUnits(state);
  }
});

$("table#cuts").on("click", (event) => {
  if (event.target.id === "delete-cut") {
    const row = event.target.closest("tr");
    const i = row.getAttribute("data-id");
    state.cuts[i] = undefined;
    renderer.renderCuts(state);
    renderer.renderTotalCuttingUnits(state);
    renderer.renderPanelGrade(state);
  }
});

function isCollision(state, selectedCut) {
  return state.getOtherRects().some((r) => selectedCut.overlaps(r));
}

CANVAS.on("mousedown", (event) => {
  if (event.target.getAttribute("type") === "cut") {
    const i = event.target.getAttribute("index");
    const coord = getMousePosition(event);
    state.selectedCutIndex = parseInt(i);
    state.offset.x = coord.x - state.selectedCut.x;
    state.offset.y = coord.y - state.selectedCut.y;
    if (isNearBorder(state.selectedCut, coord, "left")) {
      state.actionType = "resize-left";
    } else if (isNearBorder(state.selectedCut, coord, "top")) {
      state.actionType = "resize-top";
    } else if (isNearBorder(state.selectedCut, coord, "right")) {
      state.actionType = "resize-right";
    } else if (isNearBorder(state.selectedCut, coord, "bottom")) {
      state.actionType = "resize-bottom";
    } else {
      state.actionType = "drag";
    }

    if (isCollision(state, state.selectedCut)) {
      renderer.renderCut(state, state.selectedCutIndex, COLORS.collision);
    } else {
      renderer.renderCut(state, state.selectedCutIndex, COLORS.selected);
    }
  }
});

CANVAS.on("mouseup mouseleave", () => {
  if (state.selectedCut) {
    const i = state.selectedCutIndex;
    renderer.renderCut(state, i, COLORS.cut);
  }
  state.selectedCutIndex = null;
});

// Update cursor
CANVAS.on("mousemove", (event) => {
  const coord = getMousePosition(event);
  const isCut = event.target.getAttribute("type") === "cut";
  const i = event.target.getAttribute("index");
  const cut = state.cuts[i];
  if (isCut) {
    if (isNearBorder(cut, coord, "right") || isNearBorder(cut, coord, "left")) {
      event.target.style.cursor = "ew-resize";
    } else if (
      isNearBorder(cut, coord, "top") ||
      isNearBorder(cut, coord, "bottom")
    ) {
      event.target.style.cursor = "ns-resize";
    } else {
      event.target.style.cursor = "default";
    }
  } else {
    event.target.style.cursor = "default";
  }
});

CANVAS.on("mousemove", (event) => {
  if (state.selectedCut) {
    let color = COLORS.selected;
    const coord = getMousePosition(event);
    const cut = state.selectedCut;
    const i = state.selectedCutIndex;
    const toSnap = $("#snap-switch").is(":checked");

    if (state.actionType === "drag") {
      let corner = { x: coord.x - state.offset.x, y: coord.y - state.offset.y };
      if (isCollision(state, cut)) {
        color = COLORS.collision;
      }
      corner = constrainInBoard(state.board, cut, corner);
      state.cuts[i].moveTo(corner);
    } else if (state.actionType === "resize-left") {
      const xs = state
        .getOtherRects()
        .filter((r) => r.intersects(cut, "y") && r.right < cut.right)
        .map((r) => r.right);
      const xMin = Math.max(state.board.x, ...xs);
      const valsSnap = GRADES[state.grade].minCutSizes.map(
        (c) => cut.right - sizeToRect(c).width
      );
      let x;
      x = clamp(coord.x, xMin, cut.right - 1);
      if (toSnap) {
        x = snapTo(x, valsSnap, 10);
      }
      state.cuts[i].left = x;
    } else if (state.actionType === "resize-top") {
      const ys = state
        .getOtherRects()
        .filter((r) => r.intersects(cut, "x") && r.bottom < cut.bottom)
        .map((r) => r.bottom);
      const yMin = Math.max(state.board.y, ...ys);
      const valsSnap = GRADES[state.grade].minCutSizes.map(
        (c) => cut.bottom - sizeToRect(c).height
      );
      let y;
      y = clamp(coord.y, yMin, cut.bottom - 1);
      if (toSnap) {
        y = snapTo(y, valsSnap, 5);
      }
      state.cuts[i].top = y;
    } else if (state.actionType === "resize-right") {
      const xs = state
        .getOtherRects()
        .filter((r) => r.intersects(cut, "y") && r.left > cut.left)
        .map((r) => r.left);
      const xMax = Math.min(state.board.width, ...xs);
      const valsSnap = GRADES[state.grade].minCutSizes.map(
        (c) => cut.left + sizeToRect(c).width
      );
      let x;
      x = clamp(coord.x, cut.left + 1, xMax);
      if (toSnap) {
        x = snapTo(x, valsSnap, 10);
      }
      state.cuts[i].right = x;
    } else if (state.actionType === "resize-bottom") {
      const ys = state
        .getOtherRects()
        .filter((r) => r.intersects(cut, "x") && r.top > cut.top)
        .map((r) => r.top);
      const yMax = Math.min(state.board.height, ...ys);
      const valsSnap = GRADES[state.grade].minCutSizes.map(
        (c) => cut.top + sizeToRect(c).height
      );
      let y;
      y = clamp(coord.y, cut.top + 1, yMax);
      if (toSnap) {
        y = snapTo(y, valsSnap, 5);
      }
      state.cuts[i].bottom = y;
    } else {
      console.assert(false, "unknown action type");
    }
    renderer.renderCut(state, i, color);
    renderer.renderPanelGrade(state);
    renderer.renderTotalCuttingUnits(state);
  }
});

$("input[type=range]").on("input", function () {
  state.K = (50 * 1.5) / this.value;
  renderer.renderBoard(state);
  renderer.renderCuts(state);
});
