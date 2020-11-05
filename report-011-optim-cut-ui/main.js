// TODO
// [x] Boundaries: board
// [x] Allow multiple cuts
// [x] Show cut info: location, area, has min. size, etc.
// [x] Update existing cut
// [x] Constrain at board limits
// [x] Boundaries when resizing
// [ ] Bounderies when moving
// [ ] Show overlaps
// [ ] Snap cut to defects and other cuts
// [ ] Delete existing cut
// [ ] Slightly different colors for cuts
// [ ] Load board
// [ ] Minimum cut size
// [ ] Select grade
// [ ] Show board information: name, size, surface measure
// [ ] Show grade information: name, minumum board size, minimum cut size, required cutting units, number of cuts

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
    minimumBoardSize: {
      height: math.unit(6, "inch"),
      width: math.unit(8, "feet"),
    },
    yieldFactor: 10,
  },
  No1COM: {
    minimumBoardSize: {
      height: math.unit(3, "inch"),
      width: math.unit(4, "feet"),
    },
    yieldFactor: 8,
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

function main(board, defects) {
  function getCuttingUnits(cut) {
    let ww = math
        .multiply(cut.height() * K, RESOLUTION)
        .to("inch")
        .toNumber(),
      ll = math
        .multiply(cut.width() * K, RESOLUTION)
        .to("feet")
        .toNumber();
    return ww * ll;
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
        `<td>${x.toFixed(2)}, ${y.toFixed(2)}, ${w.toFixed(2)}, ${h.toFixed(
          2
        )}</td>` +
        `<td>${ww.toFixed(2)}</td>` +
        `<td>${ll.toFixed(2)}</td>` +
        `<td>${aa.toFixed(2)}</td>`;

    if (nrRows < cutShapes.length) {
      var row = $("table#cuts")[0].insertRow();
      row.dataset.id = i;
      row.innerHTML = innerHTML;
    } else {
      var row = $(`table#cuts tr[data-id=${i}]`);
      row.html(innerHTML);
    }
  }

  function updateTotalCuttingUnits(cuts) {
    let totalCuttingUnits = cuts
      .map(getCuttingUnits)
      .reduce((a, b) => a + b, 0);
    $("#total-cutting-units").text(totalCuttingUnits.toFixed(2));
  }

  CANVAS.clear();
  CANVAS.size(board.right / K + 10, board.bottom / K + 10);

  let p = { notation: "fixed", precision: 2 },
    boardWidth = math.multiply(board.right, RESOLUTION).to("feet"),
    boardWidthStr = boardWidth.format(p),
    boardHeight = math.multiply(board.bottom, RESOLUTION).to("inch"),
    boardHeightStr = boardHeight.format(p);
  $("#board-size").text(`${boardHeightStr} × ${boardWidthStr}`);

  $("#sm").text(getSM(board));

  var index = 0;
  var defectShapes = [];
  var cutShapes = [];

  var boardShape = drawBox(CANVAS, board);
  boardShape.attr({ fill: COLORS.board });

  CANVAS.add(boardShape);

  for (defect of defects) {
    var defectShape = drawBox(CANVAS, defect);
    defectShape.attr({ fill: COLORS.defect });
    defectShapes.push(defectShape);
  }

  var actionType = null,
    selectedCut = null,
    selectedIndex = null;
  var offset = { x: 0, y: 0 };

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
      offset.x = event.offsetX;
      offset.y = event.offsetY;
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
    return x1 <= y2 && y1 <= x2;
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
      let coord = getMousePosition(event);
      if (actionType == "drag") {
        var corner = { x: coord.x - offset.x, y: coord.y - offset.y };
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
}

function updateGradeInfo(grade, board) {
  let p = { notation: "fixed", precision: 2 },
    heightStr = GRADES[grade].minimumBoardSize.height.format(p),
    widthStr = GRADES[grade].minimumBoardSize.width.format(p);
  $("#minimum-board-size").text(`${heightStr} × ${widthStr}`);
  let sm = getSM(board);
  $("#required-cutting-units").text(sm * GRADES[grade].yieldFactor);
}

main(BOARD, $("select#side")[0].value);
updateGradeInfo($("select#grade")[0].value, BOARD);

$("select#side").on("change", (event) => {
  main(BOARD, defects[event.target.value]);
});

$("select#grade").on("change", (event) => {
  updateGradeInfo(event.target.value, BOARD);
});
