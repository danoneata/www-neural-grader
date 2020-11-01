// TODO
// [x] Boundaries: board
// [x] Allow multiple cuts
// [ ] Boundaries: defects
// [ ] Boundaries: other cuts
// [x] Show cut info: location, area, has min. size, etc.
// [ ] Update existing cut
// [ ] Load board
// [ ] Minimum cut size
// [ ] Select grade
// [ ] Show board information: name, size, surface measure
// [ ] Show grade information: name, minumum board size, minimum cut size, required cutting units, number of cuts

var board = { left: 0, top: 0, right: 1536, bottom: 132 };
var defects = [
  { left: 1188.0, top: 0.0, right: 1536.0, bottom: 4.0 },
  { left: 1320.0, top: 112.0, right: 1536.0, bottom: 132.0 },
];

const δ = 15;
const K = 1.5;
const resolution = math.unit(0.0625, "inch");
const MODE_HELP = {
  "add-cut": "add cuts on the board by dragging rectangles",
  "edit": "resize or delete existing cuts on the board",
};

var COLORS = {
  board: "rgb(222, 184, 135)",
  defect: "rgb(45, 32, 27)",
  cut: "rgb(130, 173, 215)",
  cutBorder: "rgb(7, 57, 12)",
};

var draw = SVG()
  .addTo("#canvas")
  .size(board.right / K + 2 * δ, board.bottom / K + 2 * δ);

var mode = "add-cut";

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function drawBox(box) {
  let x = box.left / K;
  let y = box.top / K;
  let w = (box.right - box.left) / K;
  let h = (box.bottom - box.top) / K;
  return draw.rect({ x: x + δ, y: y + δ, width: w, height: h });
}

function getCuttingUnits(cut) {
  let ww = math
      .multiply(cut.attr("height") * K, resolution)
      .to("inch")
      .toNumber(),
    ll = math
      .multiply(cut.attr("width") * K, resolution)
      .to("feet")
      .toNumber();
  return ww * ll;
}

function updateCutsTable(cut) {
  let x = cut.attr("x") - δ,
    y = cut.attr("y") - δ,
    w = cut.attr("width"),
    h = cut.attr("height");
  let ww = math
      .multiply(h * K, resolution)
      .to("inch")
      .toNumber(),
    ll = math
      .multiply(w * K, resolution)
      .to("feet")
      .toNumber(),
    aa = ww * ll;
  var row = $("table#cuts")[0].insertRow();
  row.innerHTML =
    `<td>${i}</td>` +
    `<td>${x.toFixed(2)}, ${y.toFixed(2)}, ${w.toFixed(2)}, ${h.toFixed(2)}</td>` +
    `<td>${ww.toFixed(2)}</td>` +
    `<td>${ll.toFixed(2)}</td>` +
    `<td>${aa.toFixed(2)}</td>`;
}

function updateTotalCuttingUnits(cuts) {
  let totalCuttingUnits = cuts.map(getCuttingUnits).reduce((a, b) => a + b, 0);
  $("#total-cutting-units").text(totalCuttingUnits.toFixed(2));
}

var boardSvg = drawBox(board);
boardSvg.attr({
  fill: COLORS.board,
});

for (defect of defects) {
  var b = drawBox(defect);
  b.attr({
    fill: COLORS.defect,
  });
}

var cuts = [];
var i = 0;

function getXY(event) {
    r = $("#canvas svg")[0].getBoundingClientRect();
  return [event.clientX - r.left, event.clientY - r.top];

}

$("#canvas svg").on("mousedown", (event) => {
  if (mode == "edit") return;
  var xy = getXY(event);
  var x = clamp(
    xy[0],
    boardSvg.attr("x"),
    boardSvg.attr("x") + boardSvg.attr("width")
  );
  var y = clamp(
    xy[1],
    boardSvg.attr("y"),
    boardSvg.attr("y") + boardSvg.attr("height")
  );
  if (!cuts[i]) {
    var cut = draw.rect({ x: x, y: y, width: 0, height: 0 }).fill(COLORS.cut);
    cuts.push(cut);
  }
});

$("#canvas svg").on("mousemove", (event) => {
  if (mode == "edit") return;
  if (cuts[i]) {
  var xy = getXY(event);
    var x = clamp(
      xy[0],
      boardSvg.attr("x"),
      boardSvg.attr("x") + boardSvg.attr("width")
    );
    var y = clamp(
      xy[1],
      boardSvg.attr("y"),
      boardSvg.attr("y") + boardSvg.attr("height")
    );
    // console.log(x, y);
    cuts[i].attr({
      width: x - cuts[i].attr("x"),
      height: y - cuts[i].attr("y"),
    });
  }
});

draw.on("mouseup", (event) => {
  if (mode == "edit") return;
  if (cuts[i].attr("width") <= 0 || cuts[i].attr("height") <= 0) {
    cuts.pop();
    return;
  }
  updateCutsTable(cuts[i]);
  updateTotalCuttingUnits(cuts);
  i += 1;
});

$("#mode").change((event) => {
  mode = event.target.value;
  $("#mode-help").text(MODE_HELP[mode]);
});
