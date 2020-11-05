// TODO
// [x] Boundaries: board
// [x] Allow multiple cuts
// [x] Show cut info: location, area, has min. size, etc.
// [x] Update existing cut
// [x] Constrain at board limits
// [x] Boundaries when resizing
// [x] Select grade
// [x] Warn on small cuts
// [x] Show board information:
//     [x] name
//     [x] size
//     [x] surface measure
// [ ] Show grade information:
//     [x] name
//     [x] minumum board size
//     [x] required cutting units
//     [x] number of cuts
//     [x] minimum cut size
//     [ ] extra cut
// [-] Bounderies when moving: Abandoned as it's too dificult
// [ ] Load boards from JSON
// [ ] Allow left and top resize as well
// [ ] Snap cut to minimum size
// [ ] Show overlaps (better, do not allow overlaps)
// [ ] Delete existing cut
// [ ] Slightly different colors for cuts
// [ ] Improve help messages:
//     [ ] how to edit cuts
//     [ ] what do the color code mean
// [ ] Allow for board resize
// [ ] Add cut as maximum rectangle

const δ = 15;
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
    getNumCuts: (sm) => Math.min(Math.max(Math.floor(sm / 4.0), 1), 4),
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
    getNumCuts: (sm) => Math.min(Math.max(Math.floor((sm + 1) / 3.0), 1), 5),
  },
};

var CANVAS = SVG().addTo("#svg-canvas");

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function drawBox(canvas, box) {
  let x = box.left / K;
  let y = box.top / K;
  let w = (box.right - box.left) / K;
  let h = (box.bottom - box.top) / K;
  return canvas.rect({ x: x, y: y, width: w, height: h });
}

function getSM(board) {
  let boardWidth = math.multiply(board.right, RESOLUTION).to("feet"),
    boardHeight = math.multiply(board.bottom, RESOLUTION).to("inch");
  return Math.round((boardWidth.toNumber() * boardHeight.toNumber()) / 12);
}

var BOARD = { left: 0, top: 0, right: 1536, bottom: 132 };
var defects = {
  front: [
    { left: 1188.0, top: 0.0, right: 1536.0, bottom: 4.0 },
    { left: 1320.0, top: 112.0, right: 1536.0, bottom: 132.0 },
  ],
  back: [],
};

var index = 0,
  boardShape = null,
  defectShapes = [],
  cutShapes = [];

var boardSide = null,
  grade = null;

var actionType = null,
  selectedCut = null,
  selectedIndex = null;
var offset = { x: 0, y: 0 };

function cutToSize(cut) {
  return {
    height: math.multiply(cut.height() * K, RESOLUTION).to("inch"),
    width: math.multiply(cut.width() * K, RESOLUTION).to("feet"),
  };
}

function getCuttingUnits(cut) {
  let size = cutToSize(cut);
  return size.height.to("inch").toNumber() * size.width.to("feet").toNumber();
}

function hasMinSize(cut) {
  cutSize = cutToSize(cut);
  return GRADES[grade].minCutSizes.some(
    (minCutSize) =>
      math.smallerEq(minCutSize.height, cutSize.height) &&
      math.smallerEq(minCutSize.width, cutSize.width)
  );
}

function updateCutsTable(cut) {
  let i = cut.attr("index");
  let x = cut.attr("x"),
    y = cut.attr("y"),
    w = cut.attr("width"),
    h = cut.attr("height");
  let ww = math
      .multiply(h * K, RESOLUTION)
      .to("inch")
      .toNumber(),
    ll = math
      .multiply(w * K, RESOLUTION)
      .to("feet")
      .toNumber(),
    aa = ww * ll;

  let nrRows = $("table#cuts tr").length - 1,
    innerHTML =
      `<td>${i}</td>` +
      `<td>${x.toFixed(0)}, ${y.toFixed(0)}, ` +
      `${w.toFixed(0)}, ${h.toFixed(0)}</td>` +
      `<td>${ww.toFixed(2)}</td>` +
      `<td>${ll.toFixed(2)}</td>` +
      `<td>${aa.toFixed(2)}</td>`;

  if (nrRows < cutShapes.length) {
    var row = $("table#cuts")[0].insertRow();
    row.dataset.id = i;
    row.innerHTML = innerHTML;
  } else {
    var row = $(`table#cuts tr[data-id=${i}]`)[0];
    row.innerHTML = innerHTML;
  }

  if (hasMinSize(cut)) {
    row.className = "";
  } else {
    row.className = "table-warning";
  }
}

function updateTotalCuttingUnits(cuts) {
  let totalCuttingUnits = cuts.map(getCuttingUnits).reduce((a, b) => a + b, 0);
  $("#total-cutting-units").text(totalCuttingUnits.toFixed(2));
}
function getMousePosition(event) {
  var CTM = CANVAS.node.getScreenCTM();
  return {
    x: (event.clientX - CTM.e) / CTM.a,
    y: (event.clientY - CTM.f) / CTM.d,
  };
}

function isNearBorder(rect, coord, dir) {
  if (dir == "x") {
    var r = rect.x() + rect.width();
    var c = coord.x;
  } else if (dir == "y") {
    var r = rect.y() + rect.height();
    var c = coord.y;
  } else {
    return false;
  }
  return r - δ < c && c <= r;
}

CANVAS.on("mousedown", (event) => {
  if (event.target.getAttribute("type") == "cut") {
    let i = event.target.getAttribute("index");
    let coord = getMousePosition(event);
    selectedCut = cutShapes[i];
    selectedIndex = parseInt(i);
    offset.x = coord.x - selectedCut.x();
    offset.y = coord.y - selectedCut.y();
    if (isNearBorder(selectedCut, coord, "x")) {
      actionType = "resize-x";
    } else if (isNearBorder(selectedCut, coord, "y")) {
      actionType = "resize-y";
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
  if (axis == "x") {
    return intersects(
      shape1.x(),
      shape1.x() + shape1.width(),
      shape2.x(),
      shape2.x() + shape2.width()
    );
  } else if (axis == "y") {
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

CANVAS.on("mousemove", (event) => {
  if (selectedCut) {
    let coord = getMousePosition(event),
      width = selectedCut.width(),
      height = selectedCut.height();
    if (actionType == "drag") {
      let corner = { x: coord.x - offset.x, y: coord.y - offset.y },
        otherShapes = defectShapes.concat(
          cutShapes.slice(0, selectedIndex),
          cutShapes.slice(selectedIndex + 1)
        ),
        xs = otherShapes.map((s) => [s.x(), s.x() + s.width()]).flat(),
        ys = otherShapes.map((s) => [s.y(), s.y() + s.height()]).flat();
      for (x of xs) {
        if (Math.abs(x - corner.x) <= 5) {
          corner.x = x;
        }
        if (Math.abs(x - (corner.x + width)) <= 5) {
          corner.x = x - width;
        }
      }
      for (y of ys) {
        if (Math.abs(y - corner.y) <= 5) {
          corner.y = y;
        }
        if (Math.abs(y - (corner.y + height)) <= 5) {
          corner.y = y - height;
        }
      }
      corner = constrainInBoard(selectedCut, corner);
      selectedCut.attr({ x: corner.x, y: corner.y });
    } else if (actionType == "resize-x") {
      var otherShapes = defectShapes.concat(
        cutShapes.slice(0, selectedIndex),
        cutShapes.slice(selectedIndex + 1)
      );
      var validOtherShapes = otherShapes.filter(
        (shape) =>
          intersectsShape(shape, selectedCut, "y") &&
          shape.x() > selectedCut.x()
      );
      var xs = validOtherShapes.map((shape) => shape.x());
      var xMax = Math.min(boardShape.width(), ...xs);
      var x = clamp(coord.x, selectedCut.x(), xMax);
      selectedCut.width(x - selectedCut.x());
    } else if (actionType == "resize-y") {
      var otherShapes = defectShapes.concat(
        cutShapes.slice(0, selectedIndex),
        cutShapes.slice(selectedIndex + 1)
      );
      var validOtherShapes = otherShapes.filter(
        (shape) =>
          intersectsShape(shape, selectedCut, "x") &&
          shape.y() > selectedCut.y()
      );
      var ys = validOtherShapes.map((shape) => shape.y());
      var yMax = Math.min(boardShape.height(), ...ys);
      var y = clamp(coord.y, selectedCut.y(), yMax);
      selectedCut.height(y - selectedCut.y());
    } else {
      assert(false, "unknown action type");
    }
    updateCutsTable(selectedCut);
    updateTotalCuttingUnits(cutShapes);
  }
});

CANVAS.on("mousemove", (event) => {
  let coord = getMousePosition(event);
  let isCut = event.target.getAttribute("type") == "cut",
    i = event.target.getAttribute("index");
  if (isCut && isNearBorder(cutShapes[i], coord, "x")) {
    event.target.style.cursor = "ew-resize";
  } else if (isCut && isNearBorder(cutShapes[i], coord, "y")) {
    event.target.style.cursor = "ns-resize";
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
  var cutShape = CANVAS.rect({
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
  index += 1;
});

function main(board, defects) {
  index = 0;
  defectShapes = [];
  cutShapes = [];

  CANVAS.clear();
  CANVAS.size(board.right / K + 10, board.bottom / K + 10);

  $("table#cuts tr").slice(1).empty();

  let boardSize = {
    width: math.multiply(board.right, RESOLUTION).to("feet"),
    height: math.multiply(board.bottom, RESOLUTION).to("inch"),
  };
  $("#board-size").text(sizeToStr(boardSize, 2));

  $("#sm").text(getSM(board));

  boardShape = drawBox(CANVAS, board);
  boardShape.attr({ fill: COLORS.board });
  CANVAS.add(boardShape);

  for (defect of defects) {
    var defectShape = drawBox(CANVAS, defect);
    defectShape.attr({ fill: COLORS.defect });
    defectShapes.push(defectShape);
  }
}

function sizeToStr(size, precision = 0) {
  let p = { notation: "fixed", precision: precision },
    heightStr = size.height.format(p),
    widthStr = size.width.format(p);
  return `${heightStr} × ${widthStr}`;
}

function updateGradeInfo(grade, board) {
  $("#min-board-size").text(sizeToStr(GRADES[grade].minBoardSize));
  $("#min-cut-sizes").text(
    GRADES[grade].minCutSizes.map((size) => sizeToStr(size)).join(" or ")
  );
  let sm = getSM(board);
  $("#required-cutting-units").text(sm * GRADES[grade].yieldFactor);
  $("#num-cuts").text(GRADES[grade].getNumCuts(sm));
}

$("select#side").on("change", (event) => {
  main(BOARD, defects[event.target.value]);
});

$("select#grade").on("change", (event) => {
  grade = event.target.value;
  updateGradeInfo(grade, BOARD);
});

$(document).ready(() => {
  (boardSide = $("select#side")[0].value), (grade = $("select#grade")[0].value);
  main(BOARD, defects[boardSide]);
  updateGradeInfo(grade, BOARD);
});
