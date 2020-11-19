/* eslint-env jquery */
/* global math */
/* global SVG */
/* global data */

"use strict";

const K = 1.5;
const RESOLUTION = math.unit(0.0625, "inch");
const DEFAULT_CUT = { left: 5, top: 5, width: 100, height: 30 };
const COLORS = {
  board: "rgb(222, 184, 135)",
  defect: "rgb(45, 32, 27)",
  cut: "rgb(130, 173, 215)",
  selected: "rgb(7, 57, 12)",
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
  },
  FASSEL: {
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
    getNumCuts: (sm) => Infinity,
    allowsExtraCut: (sm) => false,
  },
};

const CANVAS = SVG().addTo("#svg-canvas");

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function drawBox(canvas, box) {
  const x = box.left / K;
  const y = box.top / K;
  const w = (box.right - box.left) / K;
  const h = (box.bottom - box.top) / K;
  return canvas.rect({ x: x, y: y, width: w, height: h });
}

function getBoardSize(board) {
  return {
    width: math.multiply(board.right, RESOLUTION).to("feet"),
    height: math.multiply(board.bottom, RESOLUTION).to("inch"),
  };
}

function getSM(board) {
  const s = getBoardSize(board);
  return Math.round((s.width.toNumber() * s.height.toNumber()) / 12);
}

let index = 0;
let boardShape = null;
let defectShapes = [];
let cutShapes = [];

let boardId = null;
let boardName = null;
let boardSide = null;
let grade = null;

let actionType = null;
let selectedCut = null;
let selectedIndex = null;
const offset = { x: 0, y: 0 };

function cutToSize(cut) {
  return {
    height: math.multiply(cut.height() * K, RESOLUTION).to("inch"),
    width: math.multiply(cut.width() * K, RESOLUTION).to("feet"),
  };
}

function getCuttingUnits(cut) {
  const size = cutToSize(cut);
  return size.height.to("inch").toNumber() * size.width.to("feet").toNumber();
}

function smallerEqRect(r1, r2) {
  return (
    math.smallerEq(r1.height, r2.height) && math.smallerEq(r1.width, r2.width)
  );
}

function hasMinSizeCut(cut) {
  const cutSize = cutToSize(cut);
  return GRADES[grade].minCutSizes.some((minCutSize) =>
    smallerEqRect(minCutSize, cutSize)
  );
}

function updateCutsTable(cut) {
  const i = cut.attr("index");
  const x = cut.attr("x");
  const y = cut.attr("y");
  const w = cut.attr("width");
  const h = cut.attr("height");
  const ww = math
    .multiply(h * K, RESOLUTION)
    .to("inch")
    .toNumber();
  const ll = math
    .multiply(w * K, RESOLUTION)
    .to("feet")
    .toNumber();
  const aa = ww * ll;

  const nrRows = $("table#cuts tr").length - 1;
  const innerHTML =
    `<td>${i}</td>` +
    `<td>${x.toFixed(0)}, ${y.toFixed(0)}, ` +
    `${w.toFixed(0)}, ${h.toFixed(0)}</td>` +
    `<td>${ww.toFixed(2)}</td>` +
    `<td>${ll.toFixed(2)}</td>` +
    `<td>${aa.toFixed(2)}</td>` +
    '<td><button class="btn"><i class="fas fa-trash" id="delete-cut"></i></button></td>';

  let row;

  if (nrRows < cutShapes.filter((s) => s !== undefined).length) {
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

function getTotalCuttingUnits(cuts) {
  return cuts
    .filter((c) => c !== undefined)
    .map(getCuttingUnits)
    .reduce((a, b) => a + b, 0);
}

function updateTotalCuttingUnits(cuts) {
  $("#total-cutting-units").text(getTotalCuttingUnits(cuts).toFixed(2));
}

function getMousePosition(event) {
  const CTM = CANVAS.node.getScreenCTM();
  return {
    x: (event.clientX - CTM.e) / CTM.a,
    y: (event.clientY - CTM.f) / CTM.d,
  };
}

function isNearBorder(rect, coord, border) {
  const δ = 5;
  let r, c;
  if (border === "left") {
    r = rect.x();
    c = coord.x;
    return r <= c && c < r + δ;
  } else if (border === "right") {
    r = rect.x() + rect.width();
    c = coord.x;
    return r - δ < c && c <= r;
  } else if (border === "top") {
    r = rect.y();
    c = coord.y;
    return r <= c && c < r + δ;
  } else if (border === "bottom") {
    r = rect.y() + rect.height();
    c = coord.y;
    return r - δ < c && c <= r;
  } else {
    return false;
  }
}

CANVAS.on("mousedown", (event) => {
  if (event.target.getAttribute("type") === "cut") {
    const i = event.target.getAttribute("index");
    const coord = getMousePosition(event);
    selectedCut = cutShapes[i];
    selectedIndex = parseInt(i);
    offset.x = coord.x - selectedCut.x();
    offset.y = coord.y - selectedCut.y();
    if (isNearBorder(selectedCut, coord, "left")) {
      actionType = "resize-left";
    } else if (isNearBorder(selectedCut, coord, "top")) {
      actionType = "resize-top";
    } else if (isNearBorder(selectedCut, coord, "right")) {
      actionType = "resize-right";
    } else if (isNearBorder(selectedCut, coord, "bottom")) {
      actionType = "resize-bottom";
    } else {
      actionType = "drag";
    }
  }
});

function constrainInBoard(cut, corner) {
  return {
    x: clamp(corner.x, 0, boardShape.width() - cut.width()),
    y: clamp(corner.y, 0, boardShape.height() - cut.height()),
  };
}

function intersects(x1, x2, y1, y2) {
  return x1 < y2 && y1 < x2;
}

function intersectsShape(shape1, shape2, axis) {
  if (axis === "x") {
    return intersects(
      shape1.x(),
      shape1.x() + shape1.width(),
      shape2.x(),
      shape2.x() + shape2.width()
    );
  } else if (axis === "y") {
    return intersects(
      shape1.y(),
      shape1.y() + shape1.height(),
      shape2.y(),
      shape2.y() + shape2.height()
    );
  } else {
    console.assert(false, "unknown axis");
  }
}

function getOtherShapes(i) {
  return defectShapes
    .concat(cutShapes.slice(0, i), cutShapes.slice(i + 1))
    .filter((s) => s !== undefined);
}

CANVAS.on("mousemove", (event) => {
  if (selectedCut) {
    const coord = getMousePosition(event);
    const width = selectedCut.width();
    const height = selectedCut.height();

    const left = selectedCut.x();
    const top = selectedCut.y();
    const right = selectedCut.x() + selectedCut.width();
    const bottom = selectedCut.y() + selectedCut.height();

    if (actionType === "drag") {
      let corner = { x: coord.x - offset.x, y: coord.y - offset.y };
      const otherShapes = getOtherShapes(selectedIndex);
      const xs = otherShapes.map((s) => [s.x(), s.x() + s.width()]).flat();
      const ys = otherShapes.map((s) => [s.y(), s.y() + s.height()]).flat();
      for (const x of xs) {
        if (Math.abs(x - corner.x) <= 5) {
          corner.x = x;
        }
        if (Math.abs(x - (corner.x + width)) <= 5) {
          corner.x = x - width;
        }
      }
      for (const y of ys) {
        if (Math.abs(y - corner.y) <= 5) {
          corner.y = y;
        }
        if (Math.abs(y - (corner.y + height)) <= 5) {
          corner.y = y - height;
        }
      }
      corner = constrainInBoard(selectedCut, corner);
      selectedCut.attr({ x: corner.x, y: corner.y });
    } else if (actionType === "resize-left") {
      const xs = getOtherShapes(selectedIndex)
        .filter(
          (shape) =>
            intersectsShape(shape, selectedCut, "y") &&
            shape.x() + shape.width() < right
        )
        .map((shape) => shape.x() + shape.width());
      const xMin = Math.max(boardShape.x(), ...xs);
      const x = clamp(coord.x, xMin, right - 1);
      selectedCut.x(x);
      selectedCut.width(right - x);
    } else if (actionType === "resize-top") {
      const ys = getOtherShapes(selectedIndex)
        .filter(
          (shape) =>
            intersectsShape(shape, selectedCut, "x") &&
            shape.y() + shape.height() < bottom
        )
        .map((shape) => shape.y() + shape.height());
      const yMin = Math.max(boardShape.y(), ...ys);
      const y = clamp(coord.y, yMin, bottom - 1);
      selectedCut.y(y);
      selectedCut.height(bottom - y);
    } else if (actionType === "resize-right") {
      const xs = getOtherShapes(selectedIndex)
        .filter(
          (shape) =>
            intersectsShape(shape, selectedCut, "y") &&
            shape.x() > selectedCut.x()
        )
        .map((shape) => shape.x());
      const xMax = Math.min(boardShape.width(), ...xs);
      const x = clamp(coord.x, left + 1, xMax);
      selectedCut.width(x - selectedCut.x());
    } else if (actionType === "resize-bottom") {
      const ys = getOtherShapes(selectedIndex)
        .filter(
          (shape) =>
            intersectsShape(shape, selectedCut, "x") &&
            shape.y() > selectedCut.y()
        )
        .map((shape) => shape.y());
      const yMax = Math.min(boardShape.height(), ...ys);
      const y = clamp(coord.y, top + 1, yMax);
      selectedCut.height(y - selectedCut.y());
    } else {
      console.assert(false, "unknown action type");
    }
    updateCutsTable(selectedCut);
    updateTotalCuttingUnits(cutShapes);
    updateGradeInfo(grade, data[boardId].board);
  }
});

CANVAS.on("mousemove", (event) => {
  const coord = getMousePosition(event);
  const isCut = event.target.getAttribute("type") === "cut";
  const i = event.target.getAttribute("index");
  const shape = cutShapes[i];
  if (isCut) {
    if (
      isNearBorder(shape, coord, "right") ||
      isNearBorder(shape, coord, "left")
    ) {
      event.target.style.cursor = "ew-resize";
    } else if (
      isNearBorder(shape, coord, "top") ||
      isNearBorder(shape, coord, "bottom")
    ) {
      event.target.style.cursor = "ns-resize";
    } else {
      event.target.style.cursor = "default";
    }
  } else {
    event.target.style.cursor = "default";
  }
});

CANVAS.on("mouseup mouseleave", (event) => {
  if (selectedCut) {
    selectedCut = null;
    selectedIndex = null;
  }
});

$("#add-cut").on("click", () => {
  const cutShape = CANVAS.rect({
    x: DEFAULT_CUT.left,
    y: DEFAULT_CUT.top,
    width: DEFAULT_CUT.width,
    height: DEFAULT_CUT.height,
    fill: COLORS.cut,
    index: index,
    type: "cut",
  });
  cutShapes.push(cutShape);
  updateCutsTable(cutShape);
  updateTotalCuttingUnits(cutShapes);
  updateGradeInfo(grade, data[boardId].board);
  index += 1;
});

$("#load-cuts").on("click", () => {
  let cuts1 = _.find(data[boardId].cuts[boardSide], (e) => e[0] === grade);
  if (cuts1 === undefined) {
    cuts1 = _.last(data[boardId].cuts[boardSide]);
  }
  cuts1 = cuts1[1];

  // clean cuts
  index = 0;
  for (const cutShape of cutShapes) {
    if (cutShape !== undefined) {
      cutShape.remove();
    }
  }
  cutShapes = [];
  $("table#cuts tbody tr").remove();

  // rebuild
  for (const cut of cuts1) {
    let cutShape = drawBox(CANVAS, cut);
    cutShape.attr({
      fill: COLORS.cut,
      index: index,
      type: "cut",
    });
    cutShapes.push(cutShape);
    updateCutsTable(cutShape);
    index += 1;
  }
  updateTotalCuttingUnits(cutShapes);
  updateGradeInfo(grade, data[boardId].board);
});

function main(board, defects) {
  index = 0;
  defectShapes = [];
  cutShapes = [];

  CANVAS.clear();
  CANVAS.size(board.right / K + 10, board.bottom / K + 10);

  $("table#cuts tbody tr").remove();
  $("#total-cutting-units").text("0");

  const boardSize = getBoardSize(board);
  $("#board-size").text(sizeToStr(boardSize, 2));

  $("#sm").text(getSM(board));

  boardShape = drawBox(CANVAS, board);
  boardShape.attr({ fill: COLORS.board });
  CANVAS.add(boardShape);

  for (const defect of defects) {
    const defectShape = drawBox(CANVAS, defect);
    defectShape.attr({ fill: COLORS.defect });
    defectShapes.push(defectShape);
  }
}

function sizeToStr(size, precision = 0) {
  const p = { notation: "fixed", precision: precision };
  const heightStr = size.height.format(p);
  const widthStr = size.width.format(p);
  return `${heightStr} × ${widthStr}`;
}

function updateGradeInfo(grade, board) {
  // min board size
  const minBoardSize = GRADES[grade].minBoardSize;
  // adjust for kiln-dried boards
  const minBoardSizeAdjusted = {
    height: math.subtract(minBoardSize.height, math.unit(0.25, "inch")),
    width: minBoardSize.width,
  };
  const hasMinSize = smallerEqRect(minBoardSizeAdjusted, getBoardSize(board));
  $("#min-board-size").text(sizeToStr(minBoardSize));
  {
    const checkmark = hasMinSize ? "fa-check-circle" : "fa-circle";
    $("#min-board-size-check i").attr("class", "far " + checkmark);
  }

  const cutShapes1 = cutShapes.filter((s) => s !== undefined);

  // min cut size
  const hasMinCutSize = cutShapes1.length && cutShapes1.every(hasMinSizeCut);
  $("#min-cut-sizes").text(
    GRADES[grade].minCutSizes.map((size) => sizeToStr(size)).join(" or ")
  );
  {
    const checkmark = hasMinCutSize ? "fa-check-circle" : "fa-circle";
    $("#min-cut-sizes-check i").attr("class", "far " + checkmark);
  }

  // requred cutting units
  const sm = getSM(board);
  const reqCuttingUnits = sm * GRADES[grade].yieldFactor;
  const numCuts = GRADES[grade].getNumCuts(sm);
  const allowsExtraCut = GRADES[grade].allowsExtraCut(sm);
  const suffix = numCuts > 1 ? "s" : "";
  let reqCuttingUnitsExtra = Infinity;
  let text = `${reqCuttingUnits} in ${numCuts} cut${suffix}`;
  if (allowsExtraCut) {
    reqCuttingUnitsExtra = sm * GRADES[grade].yieldFactorExtra;
    text = text + ` or ${reqCuttingUnitsExtra} in ${numCuts + 1} cuts`;
  }
  $("#required-cutting-units").text(text);
  const totalCuttingUnits = getTotalCuttingUnits(cutShapes);
  const hasReqCuttingUnits =
    (cutShapes1.length <= numCuts && reqCuttingUnits <= totalCuttingUnits) ||
    (allowsExtraCut &&
      cutShapes1.length <= numCuts + 1 &&
      reqCuttingUnitsExtra <= totalCuttingUnits);
  {
    const checkmark = hasReqCuttingUnits ? "fa-check-circle" : "fa-circle";
    $("#required-cutting-units-check i").attr("class", "far " + checkmark);
  }
  {
    const hasGrade = hasMinSize && hasMinCutSize && hasReqCuttingUnits;
    const checkmark = hasGrade ? "fa-check-circle" : "fa-circle";
    $("#grade-check i").attr("class", "far " + checkmark);
  }
}

function populateBoardNamesSelect(boardNames) {
  const select = $("select#board-name");
  boardNames.forEach((boardName) => {
    select.append($("<option />").val(boardName).text(boardName));
  });
}

function getBoardId(boardName) {
  return data.findIndex((datum) => datum.name === boardName);
}

$("select#board-name").on("change", (event) => {
  boardName = event.target.value;
  boardId = getBoardId(boardName);
  updateGradeInfo(grade, data[boardId].board);
  main(data[boardId].board, data[boardId].defects[boardSide]);
});

$("select#side").on("change", (event) => {
  boardSide = event.target.value;
  main(data[boardId].board, data[boardId].defects[boardSide]);
});

$("select#grade").on("change", (event) => {
  grade = event.target.value;
  updateGradeInfo(grade, data[boardId].board);
});

$("table#cuts").on("click", (event) => {
  if (event.target.id === "delete-cut") {
    const row = event.target.closest("tr");
    const i = row.getAttribute("data-id");
    cutShapes[i].remove();
    cutShapes[i] = undefined;
    row.remove();
    updateTotalCuttingUnits(cutShapes);
    updateGradeInfo(grade, data[boardId].board);
  }
});

$(document).ready(() => {
  const boardNames = data.map((datum) => datum.name).sort();
  populateBoardNamesSelect(boardNames);
  boardName = $("select#board-name")[0].value;
  boardSide = $("select#side")[0].value;
  grade = $("select#grade")[0].value;
  boardId = getBoardId(boardName);
  updateGradeInfo(grade, data[boardId].board);
  main(data[boardId].board, data[boardId].defects[boardSide]);
});
